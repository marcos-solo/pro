const DEFAULT_PREFIX_LENGTH = 24;
const DEFAULT_TTL = 8;

function ipv4ToNumber(address) {
  const octets = address.split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) return null;
  const numbers = octets.map(Number);
  if (numbers.some((octet) => octet < 0 || octet > 255)) return null;
  return numbers.reduce((result, octet) => ((result << 8) | octet) >>> 0, 0);
}

function prefixMatches(address, networkAddress, prefixLength) {
  const addressNumber = ipv4ToNumber(address);
  const networkNumber = ipv4ToNumber(networkAddress);
  if (addressNumber === null || networkNumber === null || prefixLength < 0 || prefixLength > 32) return false;
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (addressNumber & mask) === (networkNumber & mask);
}

function interfacesFor(node) {
  if (Array.isArray(node.interfaces) && node.interfaces.length) {
    return node.interfaces.map((networkInterface, index) => ({
      ...networkInterface,
      prefixLength: networkInterface.prefixLength ?? DEFAULT_PREFIX_LENGTH,
      mac: networkInterface.mac ?? macFor(node.id, index),
    }));
  }
  return [{
    ip: node.ip,
    prefixLength: node.prefixLength ?? DEFAULT_PREFIX_LENGTH,
    mac: node.mac ?? macFor(node.id, 0),
  }];
}

function macFor(nodeId, interfaceIndex) {
  const suffix = (Number(nodeId) * 16 + interfaceIndex).toString(16).padStart(4, '0');
  return `02:00:00:00:${suffix.slice(0, 2)}:${suffix.slice(2)}`;
}

function primaryInterface(node) {
  return interfacesFor(node)[0];
}

function findInterfaceByIp(nodes, address) {
  for (const node of nodes) {
    const networkInterface = interfacesFor(node).find((candidate) => candidate.ip === address);
    if (networkInterface) return { node, networkInterface };
  }
  return null;
}

function findLayer2Path(nodes, links, sourceId, destinationId) {
  const queue = [[sourceId]];
  const visited = new Set([sourceId]);

  while (queue.length) {
    const path = queue.shift();
    const currentId = path[path.length - 1];
    if (currentId === destinationId) return path;

    const neighbors = links.flatMap(({ from, to }) => (
      from === currentId ? [to] : to === currentId ? [from] : []
    ));

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

function findRouterRoute(router, destinationIp) {
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

export function simulatePacket({ nodes, links, sourceId, destinationId }) {
  const events = [];
  const source = nodes.find((node) => node.id === sourceId);
  const destination = nodes.find((node) => node.id === destinationId);
  const switchTables = new Map(nodes.filter((node) => node.type === 'Switch').map((node) => [node.id, new Map()]));
  const arpCache = new Map();
  let packetTtl = DEFAULT_TTL;

  const addEvent = (nodeId, title, description, kind = 'forward', fromId = null) => {
    events.push({ nodeId, title, description, kind, fromId });
  };

  const fail = (nodeId, message) => {
    addEvent(nodeId, 'Packet stopped', message, 'error');
    return { events, error: message };
  };

  if (!source || !destination) {
    return { events, error: 'Choose a source and destination that exist on the network.' };
  }
  if (sourceId === destinationId) {
    return { events, error: 'Choose different source and destination devices.' };
  }
  if (source.type === 'Switch') {
    return { events, error: 'A switch forwards Ethernet frames; it is not configured as a packet source.' };
  }
  if (destination.type === 'Switch') {
    return { events, error: 'A switch forwards Ethernet frames; choose an end device as the destination.' };
  }
  if (ipv4ToNumber(source.ip) === null || ipv4ToNumber(destination.ip) === null) {
    return { events, error: 'The source or destination has an invalid IPv4 address.' };
  }

  const initialSourceInterface = primaryInterface(source);
  let currentNode = source;
  let nextHopIp;
  let ipDestinationNode = destination;
  let firstForward = true;
  const visitedRouters = new Set();

  addEvent(
    source.id,
    'Check destination',
    `The packet is addressed to ${destination.ip}. The source checks whether it is on the same subnet.`,
    'forward',
  );

  const sendFrame = (fromNode, toNode, fromInterface, toInterface, destinationMac, frameDescription) => {
    const path = findLayer2Path(nodes, links, fromNode.id, toNode.id);
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
      );
    }
    addEvent(toNode.id, 'Frame received', frameDescription, 'forward', path.length > 1 ? path[path.length - 2] : fromNode.id);
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

  while (true) {
    if (currentNode.type !== 'Router') {
      const currentInterface = primaryInterface(currentNode);
      const sameSubnet = prefixMatches(
        destination.ip,
        currentInterface.ip,
        currentInterface.prefixLength,
      );
      if (sameSubnet) {
        nextHopIp = destination.ip;
        ipDestinationNode = destination;
      } else {
        nextHopIp = currentNode.gateway;
        if (!nextHopIp || ipv4ToNumber(nextHopIp) === null) {
          return fail(currentNode.id, `${currentNode.name} sees that ${destination.ip} is outside its subnet, but it has no valid default gateway.`);
        }
        addEvent(
          currentNode.id,
          'Use default gateway',
          `${destination.ip} is outside ${currentNode.ip}/${currentInterface.prefixLength}; send the frame to the default gateway ${nextHopIp}. The IP packet keeps its original destination.`,
        );
        const gatewayRecord = findInterfaceByIp(nodes, nextHopIp);
        if (!gatewayRecord || gatewayRecord.node.type !== 'Router') {
          return fail(currentNode.id, `The configured gateway ${nextHopIp} is not a router on this network.`);
        }
        ipDestinationNode = destination;
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
        `The Ethernet frame carries an IP packet from ${source.ip} to ${destination.ip}.`,
      )) return fail(currentNode.id, `No Layer 2 path connects ${currentNode.name} to ${nextHopRecord.node.name}.`);
      currentNode = nextHopRecord.node;
      if (currentNode.id === ipDestinationNode.id) {
        addEvent(destination.id, 'Packet delivered', `${destination.name} receives the packet addressed to ${destination.ip}.`, 'delivery', currentNode.id);
        return { events, error: null };
      }
      firstForward = false;
      continue;
    }

    const router = currentNode;
    if (visitedRouters.has(router.id)) {
      return fail(router.id, `${router.name} detected a routing loop and dropped the packet.`);
    }
    visitedRouters.add(router.id);
    if (!firstForward) {
      packetTtl -= 1;
      if (packetTtl <= 0) return fail(router.id, `${router.name} dropped the packet because its TTL expired.`);
    }

    const route = findRouterRoute(router, destination.ip);
    if (!route) {
      return fail(router.id, `${router.name} has no route to ${destination.ip} and drops the packet.`);
    }
    const routerInterface = interfacesFor(router).find((networkInterface) => (
      route.nextHop
        ? prefixMatches(route.nextHop, networkInterface.ip, networkInterface.prefixLength)
        : prefixMatches(destination.ip, networkInterface.ip, networkInterface.prefixLength)
    ));
    if (!routerInterface) {
      return fail(router.id, `${router.name} has a route to ${destination.ip}, but no matching outgoing interface.`);
    }

    const targetIp = route.nextHop ?? destination.ip;
    const targetRecord = findInterfaceByIp(nodes, targetIp)
      ?? (targetIp === destination.ip ? { node: destination, networkInterface: primaryInterface(destination) } : null);
    if (!targetRecord) {
      return fail(router.id, `${router.name} cannot resolve the route's next hop ${targetIp}.`);
    }
    addEvent(
      router.id,
      'Route packet',
      `${router.name} matches ${destination.ip} to ${route.network}/${route.prefixLength}${route.nextHop ? ` via ${route.nextHop}` : ' (directly connected)'}. It decrements TTL to ${packetTtl} and prepares a new Ethernet frame.`,
    );
    const macAddress = resolveArp(router, targetIp, targetRecord, routerInterface);
    if (!macAddress) return fail(router.id, `No Layer 2 path connects ${router.name} to ${targetRecord.node.name}.`);
    if (!sendFrame(
      router,
      targetRecord.node,
      routerInterface,
      targetRecord.networkInterface,
      macAddress,
      `The new Ethernet frame carries the same IP packet, still addressed to ${source.ip} → ${destination.ip}; TTL is ${packetTtl}.`,
    )) return fail(router.id, `No Layer 2 path connects ${router.name} to ${targetRecord.node.name}.`);

    currentNode = targetRecord.node;
    if (currentNode.id === destination.id) {
      addEvent(destination.id, 'Packet delivered', `${destination.name} receives the packet addressed to ${destination.ip}.`, 'delivery', currentNode.id);
      return { events, error: null };
    }
    if (currentNode.type !== 'Router') {
      return fail(currentNode.id, `${currentNode.name} is not the packet destination and cannot forward IP packets.`);
    }
    firstForward = false;
  }
}
