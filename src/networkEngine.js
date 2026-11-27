const DEFAULT_PREFIX_LENGTH = 24;
const DEFAULT_TTL = 8;

export function ipv4ToNumber(address) {
  if (typeof address !== 'string') return null;
  const octets = address.trim().split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) return null;
  const numbers = octets.map(Number);
  if (numbers.some((octet) => octet < 0 || octet > 255)) return null;
  return numbers.reduce((result, octet) => ((result << 8) | octet) >>> 0, 0);
}

export function numberToIpv4(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0.0.0.0';
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

export function calculateSubnet(ipStr, prefix = 24) {
  const ipNum = ipv4ToNumber(ipStr);
  if (ipNum === null || prefix < 0 || prefix > 32) return null;
  const maskNum = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcardNum = (~maskNum) >>> 0;
  const networkNum = (ipNum & maskNum) >>> 0;
  const broadcastNum = (networkNum | wildcardNum) >>> 0;

  const totalHosts = prefix === 32 ? 1 : Math.pow(2, 32 - prefix);
  const usableHosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : Math.max(0, totalHosts - 2);
  const firstHostNum = prefix >= 31 ? networkNum : networkNum + 1;
  const lastHostNum = prefix >= 31 ? broadcastNum : Math.max(firstHostNum, broadcastNum - 1);

  // Determine IP classification
  const firstOctet = (ipNum >>> 24) & 255;
  let ipClass = 'Unknown';
  if (firstOctet >= 1 && firstOctet <= 126) ipClass = 'Class A';
  else if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'Class B';
  else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'Class C';
  else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'Class D (Multicast)';
  else if (firstOctet >= 240) ipClass = 'Class E (Experimental)';

  // Private vs Public check (RFC 1918 & RFC 6598)
  let scope = 'Public';
  if (
    (ipNum >= ipv4ToNumber('10.0.0.0') && ipNum <= ipv4ToNumber('10.255.255.255')) ||
    (ipNum >= ipv4ToNumber('172.16.0.0') && ipNum <= ipv4ToNumber('172.31.255.255')) ||
    (ipNum >= ipv4ToNumber('192.168.0.0') && ipNum <= ipv4ToNumber('192.168.255.255'))
  ) {
    scope = 'Private (RFC 1918)';
  } else if (ipNum >= ipv4ToNumber('127.0.0.0') && ipNum <= ipv4ToNumber('127.255.255.255')) {
    scope = 'Loopback (RFC 1122)';
  } else if (ipNum >= ipv4ToNumber('169.254.0.0') && ipNum <= ipv4ToNumber('169.254.255.255')) {
    scope = 'Link-Local / APIPA (RFC 3927)';
  }

  return {
    ip: ipStr,
    prefix,
    mask: numberToIpv4(maskNum),
    wildcard: numberToIpv4(wildcardNum),
    network: numberToIpv4(networkNum),
    broadcast: numberToIpv4(broadcastNum),
    firstHost: numberToIpv4(firstHostNum),
    lastHost: numberToIpv4(lastHostNum),
    totalHosts,
    usableHosts,
    ipClass,
    scope,
    binaryMask: maskNum.toString(2).padStart(32, '0').match(/.{8}/g).join('.'),
    binaryIp: ipNum.toString(2).padStart(32, '0').match(/.{8}/g).join('.'),
  };
}

export function prefixMatches(address, networkAddress, prefixLength) {
  const addressNumber = ipv4ToNumber(address);
  const networkNumber = ipv4ToNumber(networkAddress);
  if (addressNumber === null || networkNumber === null || prefixLength < 0 || prefixLength > 32) return false;
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (addressNumber & mask) === (networkNumber & mask);
}

export function interfacesFor(node) {
  if (Array.isArray(node.interfaces) && node.interfaces.length) {
    return node.interfaces.map((networkInterface, index) => ({
      ...networkInterface,
      prefixLength: networkInterface.prefixLength ?? DEFAULT_PREFIX_LENGTH,
      mac: networkInterface.mac ?? macFor(node.id, index),
    }));
  }
  return [{
    name: 'eth0',
    ip: node.ip,
    prefixLength: node.prefixLength ?? DEFAULT_PREFIX_LENGTH,
    mac: node.mac ?? macFor(node.id, 0),
  }];
}

export function macFor(nodeId, interfaceIndex) {
  const suffix = (Number(nodeId) * 16 + interfaceIndex).toString(16).padStart(4, '0');
  return `02:00:00:00:${suffix.slice(0, 2)}:${suffix.slice(2)}`;
}

export function primaryInterface(node) {
  return interfacesFor(node)[0];
}

export function findInterfaceByIp(nodes, address) {
  for (const node of nodes) {
    const networkInterface = interfacesFor(node).find((candidate) => candidate.ip === address);
    if (networkInterface) return { node, networkInterface };
  }
  return null;
}

export function findLayer2Path(nodes, links, sourceId, destinationId, linkStates = null) {
  const queue = [[sourceId]];
  const visited = new Set([sourceId]);

  while (queue.length) {
    const path = queue.shift();
    const currentId = path[path.length - 1];
    if (currentId === destinationId) return path;

    const neighbors = links.flatMap(({ from, to }) => {
      if (linkStates) {
        const linkKey = `${Math.min(from, to)}-${Math.max(from, to)}`;
        if (linkStates[linkKey] === 'blocking') return [];
      }
      return from === currentId ? [to] : to === currentId ? [from] : [];
    });

    for (const neighborId of neighbors) {
      const neighbor = nodes.find((node) => node.id === neighborId);
      if (!neighbor || visited.has(neighborId)) continue;
      if (neighborId !== destinationId && neighbor.type !== 'Switch') continue;
      visited.add(neighborId);
      queue.push([...path, neighborId]);
    }
  }

  return [];
}

export function findRouterRoute(router, destinationIp) {
  const connectedRoutes = interfacesFor(router).map((networkInterface) => ({
    network: networkInterface.ip,
    prefixLength: networkInterface.prefixLength,
    nextHop: null,
  }));
  const staticRoutes = (router.routes ?? []).map((route) => ({
    ...route,
    prefixLength: route.prefixLength ?? DEFAULT_PREFIX_LENGTH,
  }));
  const matches = [...connectedRoutes, ...staticRoutes]
    .filter((route) => prefixMatches(destinationIp, route.network, route.prefixLength))
    .sort((a, b) => b.prefixLength - a.prefixLength);
  return matches[0] ?? null;
}

function buildPacketDetails({
  srcMac = 'AA:BB:CC:00:00:01',
  dstMac = 'AA:BB:CC:00:00:02',
  isArp = false,
  srcIp = '0.0.0.0',
  dstIp = '0.0.0.0',
  ttl = DEFAULT_TTL,
  protocol = 'ICMP',
  isEchoReply = false,
  tcpFlags = null,
  srcPort = 49152,
  dstPort = 80,
  natNote = null,
}) {
  return {
    frame: {
      srcMac,
      dstMac,
      etherType: isArp ? '0x0806 (ARP)' : '0x0800 (IPv4)',
      length: isArp ? '42 bytes' : protocol === 'TCP' ? '74 bytes' : '64 bytes',
    },
    ip: isArp ? null : {
      version: 4,
      headerLength: '20 bytes',
      srcIp,
      dstIp,
      ttl,
      protocol: `${protocol} (${protocol === 'ICMP' ? '1' : protocol === 'TCP' ? '6' : '17'})`,
      checksum: '0x3a4b',
      natTranslation: natNote,
    },
    transport: isArp ? null : protocol === 'TCP' ? {
      type: 'TCP',
      srcPort,
      dstPort,
      flags: tcpFlags || 'ACK',
      sequenceNumber: '1001',
      ackNumber: '1',
      summary: `TCP [${tcpFlags || 'ACK'}] Port ${srcPort} → ${dstPort}`,
    } : {
      type: protocol,
      summary: isEchoReply ? 'ICMP Echo Reply (Type 0, Code 0)' : 'ICMP Echo Request (Type 8, Code 0)',
      identifier: '0x1c3a',
      sequenceNumber: '1',
    },
  };
}

/* ------------------------------------------------------------------ */
/*  DHCP Simulation (DORA Process)                                    */
/* ------------------------------------------------------------------ */

export function simulateDhcpLease(nodes, links, clientId) {
  const client = nodes.find((n) => n.id === clientId);
  if (!client) return { success: false, error: 'Client device not found.', events: [] };

  // Find an available DHCP server reachable via L2 or direct link
  // Candidates: Router or Server on the same network
  const server = nodes.find((n) => {
    if (n.id === clientId) return false;
    if (n.type === 'Router' || n.type === 'Firewall' || (n.type === 'Server' && n.isDhcp)) {
      const path = findLayer2Path(nodes, links, clientId, n.id);
      return path.length > 0;
    }
    return false;
  });

  if (!server) {
    return {
      success: false,
      error: 'No active DHCP server or default router found on the local broadcast domain.',
      events: [
        {
          nodeId: clientId,
          title: 'DHCP Discover',
          description: `${client.name} broadcasts DHCP Discover to 255.255.255.255 searching for a DHCP server.`,
          kind: 'forward',
          packetDetails: buildPacketDetails({
            srcMac: client.mac || '02:00:00:00:00:01',
            dstMac: 'ff:ff:ff:ff:ff:ff',
            srcIp: '0.0.0.0',
            dstIp: '255.255.255.255',
            protocol: 'UDP',
          }),
        },
        {
          nodeId: clientId,
          title: 'DHCP Timeout',
          description: 'No DHCP Offer received. Client assigns APIPA address 169.254.x.x (RFC 3927).',
          kind: 'error',
        },
      ],
    };
  }

  // Determine IP to lease based on server's subnet
  const serverIntf = primaryInterface(server);
  const serverIpNum = ipv4ToNumber(serverIntf.ip || '192.168.1.1');
  const basePrefix = serverIntf.prefixLength || 24;
  const mask = (0xffffffff << (32 - basePrefix)) >>> 0;
  const netNum = (serverIpNum & mask) >>> 0;
  const leasedIp = numberToIpv4(netNum + 50 + (clientId % 100));
  const gateway = serverIntf.ip || '192.168.1.1';
  const dns = '8.8.8.8';

  const events = [
    {
      nodeId: clientId,
      title: 'DHCP Discover (Broadcast)',
      description: `${client.name} broadcasts DHCP Discover (0.0.0.0:68 → 255.255.255.255:67) asking for an IP address.`,
      kind: 'forward',
      packetDetails: buildPacketDetails({
        srcMac: client.mac || 'AA:BB:CC:00:00:01',
        dstMac: 'ff:ff:ff:ff:ff:ff',
        srcIp: '0.0.0.0',
        dstIp: '255.255.255.255',
        protocol: 'UDP',
      }),
    },
    {
      nodeId: server.id,
      title: 'DHCP Offer',
      description: `${server.name} receives the broadcast and offers lease: IP ${leasedIp}/${basePrefix}, Gateway ${gateway}, DNS ${dns}.`,
      kind: 'forward',
      packetDetails: buildPacketDetails({
        srcMac: serverIntf.mac || '02:00:00:00:00:21',
        dstMac: client.mac || 'AA:BB:CC:00:00:01',
        srcIp: gateway,
        dstIp: leasedIp,
        protocol: 'UDP',
      }),
    },
    {
      nodeId: clientId,
      title: 'DHCP Request',
      description: `${client.name} accepts the offer and broadcasts DHCP Request formally claiming ${leasedIp}.`,
      kind: 'forward',
      packetDetails: buildPacketDetails({
        srcMac: client.mac || 'AA:BB:CC:00:00:01',
        dstMac: 'ff:ff:ff:ff:ff:ff',
        srcIp: '0.0.0.0',
        dstIp: '255.255.255.255',
        protocol: 'UDP',
      }),
    },
    {
      nodeId: server.id,
      title: 'DHCP ACK (Lease Granted)',
      description: `${server.name} commits the lease and sends DHCP ACK. ${client.name} is now online with IP ${leasedIp}.`,
      kind: 'delivery',
      packetDetails: buildPacketDetails({
        srcMac: serverIntf.mac || '02:00:00:00:00:21',
        dstMac: client.mac || 'AA:BB:CC:00:00:01',
        srcIp: gateway,
        dstIp: leasedIp,
        protocol: 'UDP',
      }),
    },
  ];

  return {
    success: true,
    offeredIp: leasedIp,
    prefixLength: basePrefix,
    gateway,
    dns,
    events,
  };
}

/* ------------------------------------------------------------------ */
/*  DNS Resolution Simulation                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_DNS_RECORDS = {
  'example.com': '93.184.216.34',
  'netwise.io': '104.21.48.1',
  'api.internal': '10.0.1.80',
  'database.local': '10.0.1.90',
  'router.local': '192.168.1.1',
  'gateway.corp': '10.0.0.1',
};

export function resolveDns(domain, customRecords = {}) {
  const table = { ...DEFAULT_DNS_RECORDS, ...customRecords };
  const cleaned = (domain || '').trim().toLowerCase();
  return table[cleaned] || null;
}

export function simulateDnsQuery(nodes, links, sourceId, domain) {
  const source = nodes.find((n) => n.id === sourceId);
  if (!source) return { success: false, error: 'Source node not found.', events: [] };

  const cleanedDomain = (domain || '').trim().toLowerCase();
  const resolvedIp = resolveDns(cleanedDomain);

  // Find a DNS Server node or Router
  const dnsServer = nodes.find((n) => n.type === 'Server' && (n.isDns || n.name.toLowerCase().includes('dns')))
    || nodes.find((n) => n.type === 'Router')
    || { id: 999, name: 'Public DNS (8.8.8.8)', ip: '8.8.8.8' };

  const events = [
    {
      nodeId: source.id,
      title: 'DNS Query (Port 53)',
      description: `${source.name} queries ${dnsServer.name} for A record: "${cleanedDomain}" over UDP port 53.`,
      kind: 'forward',
      packetDetails: buildPacketDetails({
        srcMac: source.mac || 'AA:BB:CC:00:00:01',
        dstMac: '02:00:00:00:00:99',
        srcIp: source.ip || '192.168.1.4',
        dstIp: dnsServer.ip || '8.8.8.8',
        protocol: 'UDP',
        srcPort: 52144,
        dstPort: 53,
      }),
    },
  ];

  if (!resolvedIp) {
    events.push({
      nodeId: dnsServer.id,
      title: 'DNS NXDOMAIN',
      description: `DNS server could not resolve domain "${cleanedDomain}". No matching DNS record found.`,
      kind: 'error',
    });
    return { success: false, error: `Name or service not known: ${cleanedDomain}`, events };
  }

  events.push({
    nodeId: dnsServer.id,
    title: 'DNS Response',
    description: `${dnsServer.name} responds: "${cleanedDomain}" IN A ${resolvedIp} (TTL: 300s).`,
    kind: 'delivery',
    packetDetails: buildPacketDetails({
      srcMac: '02:00:00:00:00:99',
      dstMac: source.mac || 'AA:BB:CC:00:00:01',
      srcIp: dnsServer.ip || '8.8.8.8',
      dstIp: source.ip || '192.168.1.4',
      protocol: 'UDP',
      srcPort: 53,
      dstPort: 52144,
    }),
  });

  return { success: true, resolvedIp, events };
}

/* ------------------------------------------------------------------ */
/*  Main Packet Simulation (with NAT, TCP, Firewalls)                 */
/* ------------------------------------------------------------------ */

export function simulatePacket({
  nodes,
  links,
  sourceId,
  destinationId,
  twoWay = false,
  protocol = 'ICMP',
  port = 80,
}) {
  const events = [];
  const switchTables = new Map(nodes.filter((node) => node.type === 'Switch').map((node) => [node.id, new Map()]));
  const arpCache = new Map();
  const natTable = new Map(); // Router ID -> [{ internal, external }]
  const stpResult = calculateSpanningTree(nodes, links);

  const runOneWay = (srcNode, dstNode, isReturn = false) => {
    let packetTtl = DEFAULT_TTL;
    const visitedRouters = new Set();
    let firstForward = true;
    let currentSrcIp = srcNode.ip;
    let natApplied = null;

    const addEvent = (nodeId, title, description, kind = 'forward', fromId = null, extraDetails = {}) => {
      const currentDev = nodes.find((n) => n.id === nodeId);
      const fromDev = fromId != null ? nodes.find((n) => n.id === fromId) : null;
      const details = buildPacketDetails({
        srcMac: fromDev?.mac || currentDev?.mac || '02:00:00:00:00:01',
        dstMac: currentDev?.mac || '02:00:00:00:00:02',
        isArp: title.includes('ARP'),
        srcIp: currentSrcIp,
        dstIp: dstNode.ip,
        ttl: packetTtl,
        protocol,
        isEchoReply: isReturn,
        srcPort: protocol === 'TCP' ? 49152 : undefined,
        dstPort: protocol === 'TCP' ? port : undefined,
        natNote: natApplied,
        ...extraDetails,
      });
      events.push({ nodeId, title, description, kind, fromId, isReturn, packetDetails: details });
    };

    const fail = (nodeId, message) => {
      addEvent(nodeId, 'Packet stopped', message, 'error');
      return { events, error: message };
    };

    if (!srcNode || !dstNode) {
      return { events, error: 'Choose a source and destination that exist on the network.' };
    }
    if (srcNode.id === dstNode.id) {
      return { events, error: 'Choose different source and destination devices.' };
    }
    if (srcNode.type === 'Switch') {
      return { events, error: 'A switch forwards Ethernet frames; it is not configured as a packet source.' };
    }
    if (dstNode.type === 'Switch') {
      return { events, error: 'A switch forwards Ethernet frames; choose an end device as the destination.' };
    }
    if (ipv4ToNumber(srcNode.ip) === null || ipv4ToNumber(dstNode.ip) === null) {
      return { events, error: 'The source or destination has an invalid IPv4 address.' };
    }

    if (!isReturn) {
      const startTitle = protocol === 'TCP' ? 'Initiate TCP Handshake [SYN]' : 'Check destination';
      const startDesc = protocol === 'TCP'
        ? `${srcNode.name} initiates TCP 3-way handshake to ${dstNode.ip}:${port} [SYN, Seq=0].`
        : `The packet is addressed to ${dstNode.ip}. The source checks whether it is on the same subnet.`;
      addEvent(srcNode.id, startTitle, startDesc, 'forward', null, { tcpFlags: 'SYN' });
    } else {
      const returnTitle = protocol === 'TCP' ? 'TCP Handshake [SYN-ACK]' : 'Send ICMP Echo Reply';
      const returnDesc = protocol === 'TCP'
        ? `${srcNode.name} accepts TCP connection and sends [SYN, ACK, Seq=0, Ack=1].`
        : `${srcNode.name} received the request and sends an ICMP Echo Reply back to ${dstNode.ip}.`;
      addEvent(srcNode.id, returnTitle, returnDesc, 'forward', null, { tcpFlags: 'SYN-ACK' });
    }

    const sendFrame = (fromNode, toNode, fromInterface, toInterface, destinationMac, frameDescription) => {
      const path = findLayer2Path(nodes, links, fromNode.id, toNode.id, stpResult.linkStates);
      if (!path.length) return false;
      for (let index = 1; index < path.length - 1; index += 1) {
        const switchId = path[index];
        const switchTable = switchTables.get(switchId);
        const ingressId = path[index - 1];
        const egressId = path[index + 1];
        const knownPort = switchTable.get(destinationMac);
        switchTable.set(fromInterface.mac, ingressId);
        const action = destinationMac === 'ff:ff:ff:ff:ff:ff'
          ? 'broadcast frame; flood it out the other eligible ports'
          : knownPort
            ? `forward the frame to its learned port${knownPort === egressId ? '' : ` (the selected path continues through ${nodes.find((node) => node.id === egressId)?.name})`}`
            : 'learn the source MAC, then flood because the destination MAC is not known yet';
        addEvent(
          switchId,
          'Switch forwards frame',
          `${nodes.find((node) => node.id === switchId)?.name} learns ${fromInterface.mac} on the port toward ${nodes.find((node) => node.id === ingressId)?.name} and ${action}. ${frameDescription}`,
          'forward',
          ingressId,
          { srcMac: fromInterface.mac, dstMac: destinationMac },
        );
      }
      addEvent(
        toNode.id,
        'Frame received',
        frameDescription,
        'forward',
        path.length > 1 ? path[path.length - 2] : fromNode.id,
        { srcMac: fromInterface.mac, dstMac: destinationMac },
      );
      return true;
    };

    const resolveArp = (fromNode, targetIp, targetRecord, fromInterface) => {
      const cacheKey = `${fromNode.id}:${targetIp}`;
      if (arpCache.has(cacheKey)) return arpCache.get(cacheKey);

      const targetInterface = targetRecord.networkInterface;
      addEvent(
        fromNode.id,
        'ARP request',
        `${fromNode.name} does not know the MAC address for ${targetIp}, so it broadcasts an ARP request on the local network.`,
        'forward',
        null,
        { isArp: true, dstMac: 'ff:ff:ff:ff:ff:ff' },
      );
      if (!sendFrame(
        fromNode,
        targetRecord.node,
        fromInterface,
        targetInterface,
        'ff:ff:ff:ff:ff:ff',
        `ARP asks: “Who has ${targetIp}?”`,
      )) return null;

      if (!sendFrame(
        targetRecord.node,
        fromNode,
        targetInterface,
        fromInterface,
        fromInterface.mac,
        `${targetRecord.node.name} replies that ${targetIp} is at ${targetInterface.mac}.`,
      )) return null;

      addEvent(fromNode.id, 'ARP reply', `The reply reaches ${fromNode.name}; it caches ${targetIp} → ${targetInterface.mac}.`);
      arpCache.set(cacheKey, targetInterface.mac);
      return targetInterface.mac;
    };

    let currentNode = srcNode;
    let nextHopIp;
    let ipDestinationNode = dstNode;

    while (true) {
      // Check firewall policy if current node is a Firewall
      if (currentNode.type === 'Firewall' && Array.isArray(currentNode.rules) && currentNode.rules.length > 0) {
        const deniedRule = currentNode.rules.find((r) => {
          if (r.action !== 'deny') return false;
          if (r.targetIp && r.targetIp !== dstNode.ip) return false;
          if (r.port && Number(r.port) !== Number(port)) return false;
          return true;
        });
        if (deniedRule) {
          return fail(currentNode.id, `${currentNode.name} firewall blocked the packet (rule "${deniedRule.name || 'Block'}").`);
        }
      }

      if (currentNode.type !== 'Router' && currentNode.type !== 'Firewall') {
        const currentInterface = primaryInterface(currentNode);
        const sameSubnet = prefixMatches(
          dstNode.ip,
          currentInterface.ip,
          currentInterface.prefixLength,
        );
        if (sameSubnet) {
          if (currentNode.vlan && dstNode.vlan && currentNode.vlan !== dstNode.vlan) {
            return fail(currentNode.id, `VLAN Isolation: ${currentNode.name} (VLAN ${currentNode.vlan}) and ${dstNode.name} (VLAN ${dstNode.vlan}) are in different VLANs and cannot communicate without an L3 router.`);
          }
          nextHopIp = dstNode.ip;
          ipDestinationNode = dstNode;
        } else {
          nextHopIp = currentNode.gateway;
          if (!nextHopIp || ipv4ToNumber(nextHopIp) === null) {
            return fail(currentNode.id, `${currentNode.name} sees that ${dstNode.ip} is outside its subnet, but it has no valid default gateway.`);
          }
          addEvent(
            currentNode.id,
            'Use default gateway',
            `${dstNode.ip} is outside ${currentNode.ip}/${currentInterface.prefixLength}; send the frame to the default gateway ${nextHopIp}. The IP packet keeps its original destination.`,
          );
          const gatewayRecord = findInterfaceByIp(nodes, nextHopIp);
          if (!gatewayRecord || (gatewayRecord.node.type !== 'Router' && gatewayRecord.node.type !== 'Firewall')) {
            return fail(currentNode.id, `The configured gateway ${nextHopIp} is not a router on this network.`);
          }
          ipDestinationNode = dstNode;
        }

        const nextHopRecord = findInterfaceByIp(nodes, nextHopIp);
        if (!nextHopRecord) {
          return fail(currentNode.id, `No device has the next-hop address ${nextHopIp}.`);
        }
        const macAddress = resolveArp(currentNode, nextHopIp, nextHopRecord, currentInterface);
        if (!macAddress) return fail(currentNode.id, `No Layer 2 path connects ${currentNode.name} to ${nextHopRecord.node.name}.`);
        if (!sendFrame(
          currentNode,
          nextHopRecord.node,
          currentInterface,
          nextHopRecord.networkInterface,
          macAddress,
          `The Ethernet frame carries an IP packet from ${currentSrcIp} to ${dstNode.ip}.`,
        )) return fail(currentNode.id, `No Layer 2 path connects ${currentNode.name} to ${nextHopRecord.node.name}.`);
        currentNode = nextHopRecord.node;
        if (currentNode.id === ipDestinationNode.id) {
          const deliveryMsg = isReturn
            ? `${dstNode.name} receives the response! Round-trip time 24ms (0% packet loss).`
            : `${dstNode.name} receives the packet addressed to ${dstNode.ip}.`;
          addEvent(dstNode.id, isReturn ? 'Communication successful' : 'Packet delivered', deliveryMsg, 'delivery', currentNode.id);
          return { events, error: null, natTable };
        }
        firstForward = false;
        continue;
      }

      // Router / Firewall forwarding
      const router = currentNode;
      if (visitedRouters.has(router.id)) {
        return fail(router.id, `${router.name} detected a routing loop and dropped the packet.`);
      }
      visitedRouters.add(router.id);
      if (!firstForward) {
        packetTtl -= 1;
        if (packetTtl <= 0) return fail(router.id, `${router.name} dropped the packet because its TTL expired.`);
      }

      // Access Control List (ACL) inspection on router
      if (Array.isArray(router.rules) && router.rules.length > 0) {
        const deniedRule = router.rules.find((r) => {
          if (r.action !== 'deny') return false;
          if (r.targetIp && r.targetIp !== 'any' && r.targetIp !== dstNode.ip && currentSrcIp !== r.targetIp) return false;
          if (r.port && Number(r.port) !== Number(port)) return false;
          return true;
        });
        if (deniedRule) {
          addEvent(
            router.id,
            'ACL Deny',
            `${router.name} dropped the packet matching Access Control List (ACL) rule "${deniedRule.name || 'Deny'}".`,
            'error',
          );
          return fail(router.id, `${router.name} Access Control List (ACL) dropped packet (rule "${deniedRule.name || 'Deny'}").`);
        }
      }

      const route = findRouterRoute(router, dstNode.ip);
      if (!route) {
        return fail(router.id, `${router.name} has no route to ${dstNode.ip} and drops the packet.`);
      }
      const routerInterface = interfacesFor(router).find((networkInterface) => (
        route.nextHop
          ? prefixMatches(route.nextHop, networkInterface.ip, networkInterface.prefixLength)
          : prefixMatches(dstNode.ip, networkInterface.ip, networkInterface.prefixLength)
      ));
      if (!routerInterface) {
        return fail(router.id, `${router.name} has a route to ${dstNode.ip}, but no matching outgoing interface.`);
      }

      // NAT Translation check (RFC 1918 private source to public destination)
      const srcIsPrivate = currentSrcIp.startsWith('192.168.') || currentSrcIp.startsWith('10.') || currentSrcIp.startsWith('172.');
      const dstIsPublic = !dstNode.ip.startsWith('192.168.') && !dstNode.ip.startsWith('10.') && !dstNode.ip.startsWith('172.');
      if (srcIsPrivate && dstIsPublic && router.nat !== false) {
        const translatedIp = routerInterface.ip;
        natApplied = `${currentSrcIp}:51234 → ${translatedIp}:40001 (PAT)`;
        currentSrcIp = translatedIp;
        addEvent(
          router.id,
          'NAT (Network Address Translation)',
          `${router.name} applies PAT: translates private source ${srcNode.ip} to outgoing interface public IP ${translatedIp}.`,
          'forward',
          null,
          { natNote: natApplied },
        );
      }

      const targetIp = route.nextHop ?? dstNode.ip;
      const targetRecord = findInterfaceByIp(nodes, targetIp)
        ?? (targetIp === dstNode.ip ? { node: dstNode, networkInterface: primaryInterface(dstNode) } : null);
      if (!targetRecord) {
        return fail(router.id, `${router.name} cannot resolve the route's next hop ${targetIp}.`);
      }
      addEvent(
        router.id,
        'Route packet',
        `${router.name} matches ${dstNode.ip} to ${route.network}/${route.prefixLength}${route.nextHop ? ` via ${route.nextHop}` : ' (directly connected)'}. It decrements TTL to ${packetTtl} and prepares a new Ethernet frame.`,
      );
      const macAddress = resolveArp(router, targetIp, targetRecord, routerInterface);
      if (!macAddress) return fail(router.id, `No Layer 2 path connects ${router.name} to ${targetRecord.node.name}.`);
      if (!sendFrame(
        router,
        targetRecord.node,
        routerInterface,
        targetRecord.networkInterface,
        macAddress,
        `The new Ethernet frame carries the same IP packet, addressed to ${currentSrcIp} → ${dstNode.ip}; TTL is ${packetTtl}.`,
      )) return fail(router.id, `No Layer 2 path connects ${router.name} to ${targetRecord.node.name}.`);

      currentNode = targetRecord.node;
      if (currentNode.id === dstNode.id) {
        const deliveryMsg = isReturn
          ? `${dstNode.name} receives the response! Round-trip time 24ms (0% packet loss).`
          : `${dstNode.name} receives the packet addressed to ${dstNode.ip}.`;
        addEvent(dstNode.id, isReturn ? 'Communication successful' : 'Packet delivered', deliveryMsg, 'delivery', currentNode.id);
        return { events, error: null, natTable };
      }
      if (currentNode.type !== 'Router' && currentNode.type !== 'Firewall') {
        return fail(currentNode.id, `${currentNode.name} is not the packet destination and cannot forward IP packets.`);
      }
      firstForward = false;
    }
  };

  const source = nodes.find((node) => node.id === sourceId);
  const destination = nodes.find((node) => node.id === destinationId);

  // 1. Run forward trip
  const forwardResult = runOneWay(source, destination, false);
  if (forwardResult.error || !twoWay) {
    return forwardResult;
  }

  // 2. Run return trip if twoWay is enabled
  const returnResult = runOneWay(destination, source, true);
  return returnResult;
}

/* ------------------------------------------------------------------ */
/*  VLSM (Variable Length Subnet Masking) Calculation                 */
/* ------------------------------------------------------------------ */

export function calculateVlsm(baseIpStr, basePrefix, subnetRequests = []) {
  const baseIpNum = ipv4ToNumber(baseIpStr);
  if (baseIpNum === null || basePrefix < 1 || basePrefix > 30) {
    return { error: 'Invalid base IP or prefix length (1–30).' };
  }

  const baseTotalHosts = Math.pow(2, 32 - basePrefix);
  const baseMask = (0xffffffff << (32 - basePrefix)) >>> 0;
  const baseNetNum = (baseIpNum & baseMask) >>> 0;

  // Filter and sort requests descending by required host count
  const sorted = [...subnetRequests]
    .map((r, i) => ({
      name: r.name || `Subnet ${i + 1}`,
      hostsNeeded: Math.max(1, Number(r.hostsNeeded) || 1),
      originalIndex: i,
    }))
    .sort((a, b) => b.hostsNeeded - a.hostsNeeded);

  let currentIpNum = baseNetNum;
  let totalAllocatedHosts = 0;
  const allocatedSubnets = [];

  for (const req of sorted) {
    // Hosts needed + 2 (network & broadcast)
    // Minimum 2 host bits for /30 (4 total addresses, 2 usable)
    const needed = req.hostsNeeded + 2;
    const hostBits = Math.max(2, Math.ceil(Math.log2(needed)));
    const prefix = 32 - hostBits;
    const blockSize = Math.pow(2, hostBits);

    // Boundary alignment
    const remainder = currentIpNum % blockSize;
    if (remainder !== 0) {
      currentIpNum += blockSize - remainder;
    }

    if (currentIpNum + blockSize > baseNetNum + baseTotalHosts) {
      return {
        error: `Insufficient address space in ${baseIpStr}/${basePrefix} for "${req.name}" (needs ${req.hostsNeeded} hosts).`,
        allocatedSubnets,
      };
    }

    const netNum = currentIpNum;
    const broadcastNum = netNum + blockSize - 1;
    const firstHostNum = netNum + 1;
    const lastHostNum = broadcastNum - 1;
    const maskNum = (0xffffffff << (32 - prefix)) >>> 0;

    allocatedSubnets.push({
      name: req.name,
      hostsNeeded: req.hostsNeeded,
      prefix,
      network: numberToIpv4(netNum),
      mask: numberToIpv4(maskNum),
      firstHost: numberToIpv4(firstHostNum),
      lastHost: numberToIpv4(lastHostNum),
      broadcast: numberToIpv4(broadcastNum),
      totalHosts: blockSize,
      usableHosts: blockSize - 2,
      efficiency: Math.round((req.hostsNeeded / (blockSize - 2)) * 100),
    });

    currentIpNum += blockSize;
    totalAllocatedHosts += blockSize;
  }

  return {
    baseNetwork: numberToIpv4(baseNetNum),
    basePrefix,
    baseTotalHosts,
    totalAllocatedHosts,
    remainingHosts: baseTotalHosts - totalAllocatedHosts,
    allocatedSubnets,
  };
}

/* ------------------------------------------------------------------ */
/*  Route Summarization (CIDR Aggregation / Supernetting)              */
/* ------------------------------------------------------------------ */

export function calculateRouteSummary(cidrList = []) {
  const validRanges = [];

  for (const cidr of cidrList) {
    const parts = cidr.trim().split('/');
    if (parts.length !== 2) continue;
    const ipNum = ipv4ToNumber(parts[0]);
    const prefix = Number(parts[1]);
    if (ipNum === null || isNaN(prefix) || prefix < 0 || prefix > 32) continue;

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const netNum = (ipNum & mask) >>> 0;
    const broadcastNum = (netNum | ((~mask) >>> 0)) >>> 0;
    validRanges.push({ netNum, broadcastNum });
  }

  if (validRanges.length === 0) {
    return { error: 'Please provide at least one valid CIDR address (e.g. 192.168.0.0/24).' };
  }

  const minIp = Math.min(...validRanges.map((r) => r.netNum));
  const maxIp = Math.max(...validRanges.map((r) => r.broadcastNum));

  // Find common binary prefix
  let commonBits = 0;
  for (let bit = 31; bit >= 0; bit -= 1) {
    const minBit = (minIp >>> bit) & 1;
    const maxBit = (maxIp >>> bit) & 1;
    if (minBit === maxBit) {
      commonBits += 1;
    } else {
      break;
    }
  }

  const summaryPrefix = commonBits;
  const summaryMaskNum = summaryPrefix === 0 ? 0 : (0xffffffff << (32 - summaryPrefix)) >>> 0;
  const summaryNetNum = (minIp & summaryMaskNum) >>> 0;

  return {
    summaryCidr: `${numberToIpv4(summaryNetNum)}/${summaryPrefix}`,
    summaryNetwork: numberToIpv4(summaryNetNum),
    summaryPrefix,
    summaryMask: numberToIpv4(summaryMaskNum),
    subnetsCount: validRanges.length,
    coveredAddresses: Math.pow(2, 32 - summaryPrefix),
  };
}

/* ------------------------------------------------------------------ */
/*  IPv6 Parser & Visualizer                                          */
/* ------------------------------------------------------------------ */

export function parseIpv6(input) {
  const clean = (input || '').trim().toLowerCase();
  if (!clean || !/^[0-9a-f:]+$/.test(clean) || clean.includes(':::')) {
    return null;
  }

  // Handle double colon expansion
  let parts = clean.split('::');
  if (parts.length > 2) return null;

  let blocks = [];
  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    blocks = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    blocks = clean.split(':');
  }

  if (blocks.length !== 8 || blocks.some((b) => b.length > 4)) return null;

  // Normalize to 4 hex digits per hextet
  const normalized = blocks.map((b) => b.padStart(4, '0'));
  const expanded = normalized.join(':');

  // Classification
  let classification = 'Global Unicast (2000::/3)';
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') {
    classification = 'Loopback (::1)';
  } else if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') {
    classification = 'Unspecified (::)';
  } else if (normalized[0].startsWith('fe8') || normalized[0].startsWith('fe9') || normalized[0].startsWith('fea') || normalized[0].startsWith('feb')) {
    classification = 'Link-Local Unicast (fe80::/10)';
  } else if (normalized[0].startsWith('fc') || normalized[0].startsWith('fd')) {
    classification = 'Unique Local Address / ULA (fc00::/7)';
  } else if (normalized[0].startsWith('ff')) {
    classification = 'Multicast (ff00::/8)';
  }

  return {
    raw: input,
    expanded,
    compressed: clean,
    classification,
    hextets: normalized,
  };
}

/**
 * Calculates Spanning Tree Protocol (802.1D STP) states across switches.
 * Elects the switch with the lowest numeric ID as the Root Bridge.
 * Links in the shortest-path tree are 'forwarding'; redundant loop links are 'blocking'.
 */
export function calculateSpanningTree(nodes = [], links = []) {
  const switches = nodes.filter((n) => n.type === 'Switch');
  if (switches.length <= 1) {
    return {
      rootBridgeId: switches[0]?.id ?? null,
      linkStates: {},
    };
  }

  // Elect Root Bridge: lowest switch ID
  const sortedSwitches = [...switches].sort((a, b) => a.id - b.id);
  const rootBridge = sortedSwitches[0];
  const switchIds = new Set(switches.map((s) => s.id));
  const linkStates = {};

  const visited = new Set([rootBridge.id]);
  const queue = [rootBridge.id];
  const treeLinks = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    const incidentLinks = links.filter(
      (l) => (l.from === current && switchIds.has(l.to)) || (l.to === current && switchIds.has(l.from)),
    );

    for (const l of incidentLinks) {
      const neighbor = l.from === current ? l.to : l.from;
      const linkKey = `${Math.min(l.from, l.to)}-${Math.max(l.from, l.to)}`;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        treeLinks.add(linkKey);
        queue.push(neighbor);
      }
    }
  }

  // Assign forwarding vs blocking on all switch-to-switch links
  links.forEach((l) => {
    if (switchIds.has(l.from) && switchIds.has(l.to)) {
      const linkKey = `${Math.min(l.from, l.to)}-${Math.max(l.from, l.to)}`;
      linkStates[linkKey] = treeLinks.has(linkKey) ? 'forwarding' : 'blocking';
    }
  });

  return {
    rootBridgeId: rootBridge.id,
    linkStates,
  };
}

/**
 * Automatically calculates dynamic routing entries (OSPF/RIP simulation)
 * between interconnected routers across direct interfaces.
 */
export function calculateDynamicRoutes(nodes = [], links = [], protocol = 'OSPF') {
  const routers = nodes.filter((n) => n.type === 'Router' || n.type === 'L3Switch');
  if (routers.length <= 1) return nodes;

  // Build network map of connected subnets per router
  const routerSubnets = new Map();
  routers.forEach((r) => {
    const subnets = interfacesFor(r).map((intf) => ({
      network: calculateSubnet(intf.ip, intf.prefixLength)?.network || intf.ip,
      prefixLength: intf.prefixLength,
      interfaceIp: intf.ip,
    }));
    routerSubnets.set(r.id, subnets);
  });

  return nodes.map((node) => {
    if (node.type !== 'Router' && node.type !== 'L3Switch') return node;
    const existing = node.routes || [];
    const dynamicRoutes = [];

    // Find routes learned from neighbor routers
    routers.forEach((other) => {
      if (other.id === node.id) return;
      const otherSubnets = routerSubnets.get(other.id) || [];
      otherSubnets.forEach((sub) => {
        const isLocal = (node.interfaces || []).some((i) => prefixMatches(i.ip, sub.network, sub.prefixLength));
        if (!isLocal && !existing.some((r) => r.network === sub.network)) {
          dynamicRoutes.push({
            network: sub.network,
            prefixLength: sub.prefixLength,
            nextHop: sub.interfaceIp,
            protocol,
          });
        }
      });
    });

    return {
      ...node,
      routes: [...existing, ...dynamicRoutes],
    };
  });
}
