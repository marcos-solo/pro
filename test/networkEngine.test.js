import assert from 'node:assert/strict';
import test from 'node:test';
import { simulatePacket } from '../src/networkEngine.js';

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
