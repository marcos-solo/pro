import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateRouteSummary,
  calculateSubnet,
  calculateVlsm,
  parseIpv6,
  simulateDhcpLease,
  simulateDnsQuery,
  simulatePacket,
} from '../src/networkEngine.js';

const nodes = [
  { id: 1, name: 'Laptop', type: 'Device', ip: '192.168.1.4', prefixLength: 24, gateway: '192.168.1.1' },
  {
    id: 2,
    name: 'Router',
    type: 'Router',
    ip: '192.168.1.1',
    interfaces: [
      { ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:21' },
      { ip: '93.184.216.1', prefixLength: 24, mac: '02:00:00:00:00:22' },
    ],
  },
  { id: 3, name: 'Switch', type: 'Switch', ip: '192.168.1.2' },
  { id: 4, name: 'Web server', type: 'Server', ip: '93.184.216.34', prefixLength: 24, gateway: '93.184.216.1' },
];

const links = [
  { from: 1, to: 3 },
  { from: 3, to: 2 },

  { from: 2, to: 4 },
];

test('forwards an off-subnet packet through the switch and router', () => {
  const result = simulatePacket({ nodes, links, sourceId: 1, destinationId: 4 });

  assert.equal(result.error, null);
  assert.equal(result.events.at(-1).kind, 'delivery');
  assert.ok(result.events.some((event) => event.title === 'ARP request'));
  assert.ok(result.events.some((event) => event.nodeId === 3 && event.title === 'Switch forwards frame'));
  assert.ok(result.events.some((event) => event.nodeId === 2 && event.description.includes('decrements TTL to 7')));
  assert.ok(result.events.some((event) => event.nodeId === 1 && event.title === 'Use default gateway'));
});

test('delivers on the local subnet without routing through a gateway', () => {
  const localNodes = [
    nodes[0],
    { id: 4, name: 'Printer', type: 'Device', ip: '192.168.1.50', prefixLength: 24 },
    nodes[2],
  ];
  const result = simulatePacket({
    nodes: localNodes,
    links: [{ from: 1, to: 3 }, { from: 3, to: 4 }],
    sourceId: 1,
    destinationId: 4,
  });

  assert.equal(result.error, null);
  assert.equal(result.events.at(-1).kind, 'delivery');
  assert.ok(!result.events.some((event) => event.title === 'Use default gateway'));
  assert.ok(!result.events.some((event) => event.title === 'Route packet'));
});

test('reports when an off-subnet destination has no default gateway', () => {
  const localNodes = [{ ...nodes[0], gateway: undefined }, nodes[1], nodes[2], nodes[3]];
  const result = simulatePacket({ nodes: localNodes, links, sourceId: 1, destinationId: 4 });

  assert.match(result.error, /no valid default gateway/);
  assert.equal(result.events.at(-1).kind, 'error');
});

test('reports when a router has no route to the destination network', () => {
  const localNodes = [
    nodes[0],
    { ...nodes[1], interfaces: [nodes[1].interfaces[0]] },
    nodes[2],
    nodes[3],
  ];
  const result = simulatePacket({ nodes: localNodes, links, sourceId: 1, destinationId: 4 });

  assert.match(result.error, /has no route/);
  assert.equal(result.events.at(-1).nodeId, 2);
});

test('learns MAC addresses and forwards a later unicast to the known port', () => {
  const result = simulatePacket({ nodes, links, sourceId: 1, destinationId: 4 });
  const switchEvents = result.events.filter((event) => event.nodeId === 3);

  assert.ok(switchEvents.some((event) => event.description.includes('broadcast frame; flood it')));
  assert.ok(switchEvents.some((event) => event.description.includes('forward the frame to its learned port')));
});

test('handles two-way round-trip ping correctly', () => {
  const result = simulatePacket({ nodes, links, sourceId: 1, destinationId: 4, twoWay: true });

  assert.equal(result.error, null);
  assert.ok(result.events.some((e) => e.title.includes('Send ICMP Echo Reply')));
  assert.ok(result.events.some((e) => e.title.includes('Communication successful') || e.title.includes('Ping successful')));
  assert.equal(result.events.at(-1).nodeId, 1);
});

test('calculates subnet details accurately', () => {
  const sub = calculateSubnet('192.168.1.100', 24);
  assert.equal(sub.network, '192.168.1.0');
  assert.equal(sub.broadcast, '192.168.1.255');
  assert.equal(sub.mask, '255.255.255.0');
  assert.equal(sub.firstHost, '192.168.1.1');
  assert.equal(sub.lastHost, '192.168.1.254');
  assert.equal(sub.usableHosts, 254);
  assert.equal(sub.scope, 'Private (RFC 1918)');
});

test('calculates VLSM allocations accurately', () => {
  const res = calculateVlsm('192.168.10.0', 24, [
    { name: 'Engineering', hostsNeeded: 60 },
    { name: 'Sales', hostsNeeded: 25 },
    { name: 'Support', hostsNeeded: 12 },
    { name: 'WAN Link', hostsNeeded: 2 },
  ]);

  assert.equal(res.error, undefined);
  assert.equal(res.allocatedSubnets.length, 4);
  assert.equal(res.allocatedSubnets[0].name, 'Engineering');
  assert.equal(res.allocatedSubnets[0].prefix, 26); // 64 hosts
  assert.equal(res.allocatedSubnets[0].network, '192.168.10.0');

  assert.equal(res.allocatedSubnets[1].name, 'Sales');
  assert.equal(res.allocatedSubnets[1].prefix, 27); // 32 hosts
  assert.equal(res.allocatedSubnets[1].network, '192.168.10.64');

  assert.equal(res.allocatedSubnets[2].name, 'Support');
  assert.equal(res.allocatedSubnets[2].prefix, 28); // 16 hosts
  assert.equal(res.allocatedSubnets[2].network, '192.168.10.96');

  assert.equal(res.allocatedSubnets[3].name, 'WAN Link');
  assert.equal(res.allocatedSubnets[3].prefix, 30); // 4 hosts
  assert.equal(res.allocatedSubnets[3].network, '192.168.10.112');
});

test('calculates CIDR route summarization accurately', () => {
  const res = calculateRouteSummary([
    '192.168.0.0/24',
    '192.168.1.0/24',
    '192.168.2.0/24',
    '192.168.3.0/24',
  ]);

  assert.equal(res.summaryCidr, '192.168.0.0/22');
  assert.equal(res.summaryMask, '255.255.252.0');
  assert.equal(res.coveredAddresses, 1024);
});

test('parses and classifies IPv6 addresses correctly', () => {
  const res = parseIpv6('2001:db8::1');
  assert.ok(res);
  assert.equal(res.expanded, '2001:0db8:0000:0000:0000:0000:0000:0001');
  assert.match(res.classification, /Global Unicast/);

  const loopback = parseIpv6('::1');
  assert.ok(loopback);
  assert.match(loopback.classification, /Loopback/);

  const linkLocal = parseIpv6('fe80::4a2b');
  assert.ok(linkLocal);
  assert.match(linkLocal.classification, /Link-Local/);
});

test('simulates DHCP lease handshake (DORA)', () => {
  const res = simulateDhcpLease(nodes, links, 1);
  assert.equal(res.success, true);
  assert.ok(res.offeredIp.startsWith('192.168.1.'));
  assert.equal(res.gateway, '192.168.1.1');
  assert.equal(res.events.length, 4);
  assert.equal(res.events[0].title, 'DHCP Discover (Broadcast)');
  assert.equal(res.events[3].title, 'DHCP ACK (Lease Granted)');
});

test('simulates DNS domain resolution', () => {
  const res = simulateDnsQuery(nodes, links, 1, 'example.com');
  assert.equal(res.success, true);
  assert.equal(res.resolvedIp, '93.184.216.34');
  assert.ok(res.events.some((e) => e.title.includes('DNS Query')));
  assert.ok(res.events.some((e) => e.title.includes('DNS Response')));
});
