export function parseCommandLine(input) {
  const parts = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (escaped) current += '\\';
  if (current) parts.push(current);
  return parts;
}

export const parseCommand = parseCommandLine;

export function terminalPrompt(node, mode = 'user', _interfaceName = '') {
  const host = (node?.name || 'device').replace(/\s+/g, '-');
  if (mode === 'config-if') return `${host}(config-if)# `;
  if (mode === 'config') return `${host}(config)# `;
  if (mode === 'privileged') return `${host}# `;
  return `${host}> `;
}

export function levenshteinDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => []);
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = 1 + j - 1;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = left[i - 1] === right[j - 1]
        ? rows[i - 1][j - 1]
        : 1 + Math.min(rows[i - 1][j], rows[i][j - 1], rows[i - 1][j - 1]);
    }
  }
  return rows[left.length][right.length];
}

export function suggestCommand(input, candidates) {
  const command = input.trim().split(/\s+/)[0]?.toLowerCase();
  if (!command) return null;
  const exact = candidates.find((candidate) => candidate.split(/\s+/)[0] === command);
  if (exact) return null;
  return candidates
    .map((candidate) => ({ candidate, distance: levenshteinDistance(command, candidate.split(/\s+/)[0]) }))
    .filter((entry) => entry.distance <= 2)
    .sort((a, b) => a.distance - b.distance)[0]?.candidate || null;
}

export function prefixToMask(prefix) {
  const p = Number(prefix) || 24;
  if (p <= 0) return '0.0.0.0';
  if (p >= 32) return '255.255.255.255';
  const mask = (0xffffffff << (32 - p)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255,
  ].join('.');
}

export function generateCiscoConfig(node) {
  if (!node) return '! No device selected';
  const lines = [
    '!',
    'version 15.4',
    'service timestamps debug datetime msec',
    'service timestamps log datetime msec',
    'no service password-encryption',
    '!',
    `hostname ${(node.name || 'Device').replace(/\s+/g, '-')}`,
    '!',
    'boot-start-marker',
    'boot-end-marker',
    '!',
    'no aaa new-model',
    'ip cef',
    '!',
  ];

  if (node.type === 'Switch' || node.type === 'L3Switch') {
    lines.push('spanning-tree mode pvst', 'spanning-tree extend system-id', '!');
    if (Array.isArray(node.vlans) && node.vlans.length > 0) {
      node.vlans.forEach((vlan) => {
        lines.push(`vlan ${vlan.id}`, ` name ${vlan.name || `VLAN${vlan.id}`}`, '!');
      });
    }
  }

  const interfaces = node.interfaces && node.interfaces.length > 0
    ? node.interfaces
    : [{ name: 'FastEthernet0/1', ip: node.ip, prefixLength: node.prefixLength || 24, enabled: true }];

  interfaces.forEach((intf) => {
    lines.push(`interface ${intf.name || 'FastEthernet0/1'}`);
    if (intf.mode === 'trunk') {
      lines.push(' switchport mode trunk');
      if (intf.allowedVlans) lines.push(` switchport trunk allowed vlan ${intf.allowedVlans}`);
    } else if (intf.vlan || intf.mode === 'access') {
      lines.push(' switchport mode access');
      if (intf.vlan) lines.push(` switchport access vlan ${intf.vlan}`);
    }

    if (intf.ip && intf.ip !== '0.0.0.0') {
      lines.push(` ip address ${intf.ip} ${prefixToMask(intf.prefixLength || 24)}`);
    } else if (node.type !== 'Switch') {
      lines.push(' no ip address');
    }

    lines.push(intf.enabled === false ? ' shutdown' : ' no shutdown');
    lines.push('!');
  });

  if (Array.isArray(node.routes) && node.routes.length > 0) {
    node.routes.forEach((route) => {
      lines.push(`ip route ${route.network} ${prefixToMask(route.prefixLength || 24)} ${route.nextHop}`);
    });
    lines.push('!');
  }

  if (Array.isArray(node.rules) && node.rules.length > 0) {
    node.rules.forEach((rule, idx) => {
      const num = 100 + (idx % 99);
      const action = rule.action === 'deny' ? 'deny' : 'permit';
      const portSpec = rule.port ? ` eq ${rule.port}` : '';
      lines.push(`access-list ${num} ${action} ip any ${rule.targetIp === 'any' ? 'any' : `host ${rule.targetIp}`}${portSpec}`);
    });
    lines.push('!');
  }

  lines.push('line con 0', ' logging synchronous', 'line vty 0 4', ' login', '!', 'end');
  return lines.join('\n');
}

export function getDeviceCommands(node, mode = 'user') {
  const common = ['help', 'clear', 'capture start', 'capture stop', 'capture show', 'show running-config', 'exit'];
  const base = ['ping', 'traceroute', 'tracert', 'curl', 'nslookup', 'ipconfig', 'arp', 'route print', 'enable'];
  let commands = [...base, ...common];

  if (node?.type === 'PC' || node?.type === 'WirelessClient') {
    commands.push('set ip', 'set gateway', 'ip address');
  }

  if (mode !== 'user') {
    commands.push(
      'configure terminal',
      'disable',
      'show ip interface brief',
      'show running-config',
      'write memory',
      'copy running-config startup-config',
      'interface',
    );
  }
  if (mode === 'config' || mode === 'config-if') {
    commands.push('interface', 'exit', 'end');
  }
  if (mode === 'config-if') {
    commands.push(
      'ip address',
      'no ip address',
      'shutdown',
      'no shutdown',
      'switchport mode access',
      'switchport mode trunk',
      'switchport access vlan',
    );
  }

  if (node?.type === 'Switch' || node?.type === 'L3Switch') {
    commands.push('show vlan', 'show vlan brief', 'show mac-address-table', 'vlan', 'no vlan');
  }
  if (node?.type === 'Router' || node?.type === 'L3Switch') {
    commands.push('show ip route', 'ip route', 'no ip route');
  }
  if (node?.type === 'Firewall') {
    commands.push('show access-list', 'show rules', 'rule permit', 'rule deny', 'no rule', 'access-list permit', 'access-list deny', 'no access-list');
  }
  return [...new Set(commands)];
}

export function completeTerminalInput(input, node, mode = 'user', _interfaceName = '') {
  const candidates = getDeviceCommands(node, mode);
  const trimmed = input.trimStart();
  const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(trimmed.toLowerCase()));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return matches;
  return [];
}

function networkPrefix(ipOrCidr, prefixLength) {
  if (String(ipOrCidr).includes('/')) {
    const [network, prefix] = String(ipOrCidr).split('/');
    return { network, prefix: Number(prefix) || 24 };
  }
  return { network: ipOrCidr, prefix: Number(prefixLength) || 24 };
}

export function applyTerminalConfiguration({ nodes, nodeId, mode, interfaceName = '', parts }) {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return { nodes, mode, interfaceName, output: ['Device not found.'], changed: false };

  const command = (parts[0] || '').toLowerCase();
  const args = parts.slice(1);
  let nextMode = mode;
  let nextInterface = interfaceName;
  let output = [];
  let changed = false;

  const updateNode = (updater) => {
    nodes = nodes.map((item) => item.id === nodeId ? updater({ ...item, interfaces: item.interfaces ? item.interfaces.map((intf) => ({ ...intf })) : item.interfaces }) : item);
  };

  if (command === 'set' && args[0]?.toLowerCase() === 'ip') {
    const [address, prefixText] = String(args[1] || '').split('/');
    if (!address) output = ['Usage: set ip <address>/<prefix>'];
    else {
      const prefix = Number(prefixText) || 24;
      updateNode((item) => ({
        ...item,
        ip: address,
        prefixLength: prefix,
        interfaces: (item.interfaces || []).map((intf, index) => index === 0 ? { ...intf, ip: address, prefixLength: prefix } : intf),
      }));
      output = [`IP address set to ${address}/${prefix}.`];
      changed = true;
    }
  } else if (command === 'set' && args[0]?.toLowerCase() === 'gateway') {
    if (!args[1]) output = ['Usage: set gateway <ip>'];
    else {
      updateNode((item) => ({ ...item, gateway: args[1] }));
      output = [`Default gateway set to ${args[1]}.`];
      changed = true;
    }
  } else if (command === 'enable') {
    if (mode === 'user') nextMode = 'privileged';
    output = ['Entered privileged EXEC mode.'];
  } else if (command === 'disable') {
    nextMode = 'user';
    nextInterface = '';
    output = ['Returned to user EXEC mode.'];
  } else if (command === 'configure' && args[0]?.toLowerCase() === 'terminal') {
    if (mode !== 'privileged') output = ['% Enter privileged EXEC mode with `enable` first.'];
    else {
      nextMode = 'config';
      output = ['Entered global configuration mode.'];
    }
  } else if (command === 'interface') {
    if (mode === 'config' || mode === 'privileged') {
      if (!args[0]) output = ['Usage: interface <name>'];
      else {
        const name = args.join(' ');
        const interfaces = node.interfaces ? [...node.interfaces] : [];
        if (!interfaces.some((intf) => intf.name === name)) interfaces.push({ name, ip: '0.0.0.0', prefixLength: 24, mac: node.mac });
        updateNode((item) => ({ ...item, interfaces }));
        nextMode = 'config-if';
        nextInterface = name;
        output = [`Entered interface configuration: ${name}`];
        changed = true;
      }
    } else output = ['% Use this command from global configuration mode.'];
  } else if (command === 'exit') {
    if (mode === 'config-if') {
      nextMode = 'config';
      nextInterface = '';
      output = ['Returned to global configuration mode.'];
    } else if (mode === 'config') {
      nextMode = 'privileged';
      output = ['Returned to privileged EXEC mode.'];
    } else if (mode === 'privileged') {
      nextMode = 'user';
      output = ['Returned to user EXEC mode.'];
    } else output = ['Already in user EXEC mode.'];
  } else if (command === 'end') {
    nextMode = 'privileged';
    nextInterface = '';
    output = ['Returned to privileged EXEC mode.'];
  } else if (command === 'no' && args[0]?.toLowerCase() === 'shutdown') {
    if (mode === 'config-if' && nextInterface) {
      updateNode((item) => ({ ...item, interfaces: (item.interfaces || []).map((intf) => intf.name === nextInterface ? { ...intf, enabled: true } : intf) }));
      output = [`Interface ${nextInterface} is administratively up.`];
      changed = true;
    } else output = ['Usage: no shutdown (from interface configuration)'];
  } else if (command === 'shutdown') {
    if (mode === 'config-if' && nextInterface) {
      updateNode((item) => ({ ...item, interfaces: (item.interfaces || []).map((intf) => intf.name === nextInterface ? { ...intf, enabled: false } : intf) }));
      output = [`Interface ${nextInterface} is administratively down.`];
      changed = true;
    } else output = ['Usage: shutdown (from interface configuration)'];
  } else if (command === 'ip' && args[0]?.toLowerCase() === 'address') {
    if (mode !== 'config-if' && !['PC', 'WirelessClient', 'Server'].includes(node.type)) {
      output = ['% Enter interface configuration mode first.'];
    } else {
      const value = args[1];
      if (!value || value.toLowerCase() === 'dhcp') {
        output = ['Usage: ip address <address>/<prefix>'];
      } else {
        const [address, prefixText] = value.split('/');
        const prefix = Number(prefixText || args[2]) || 24;
        updateNode((item) => {
          const interfaces = nextInterface
            ? (item.interfaces || []).map((intf) => intf.name === nextInterface
              ? { ...intf, ip: address, prefixLength: prefix, enabled: true }
              : intf)
            : (item.interfaces || []).map((intf, index) => index === 0 ? { ...intf, ip: address, prefixLength: prefix } : intf);
          if (nextInterface && !interfaces.some((intf) => intf.name === nextInterface)) {
            interfaces.push({ name: nextInterface, ip: address, prefixLength: prefix, mac: item.mac });
          }
          return { ...item, ip: address, interfaces };
        });
        output = [`Set ${nextInterface || node.name} to ${address}/${prefix}.`];
        changed = true;
      }
    }
  } else if (command === 'no' && args[0]?.toLowerCase() === 'ip' && args[1]?.toLowerCase() === 'address') {
    if (mode !== 'config-if') output = ['% Enter interface configuration mode first.'];
    else {
      updateNode((item) => ({ ...item, interfaces: (item.interfaces || []).map((intf) => intf.name === nextInterface ? { ...intf, ip: '0.0.0.0', prefixLength: 24 } : intf) }));
      output = [`Removed IP address from ${nextInterface}.`];
      changed = true;
    }
  } else if (command === 'vlan') {
    const vlanId = Number(args[0]);
    if (!vlanId) output = ['Usage: vlan <id> [name <name>]'];
    else {
      const nameIndex = args.findIndex((arg) => arg.toLowerCase() === 'name');
      const vlanName = nameIndex >= 0 ? args.slice(nameIndex + 1).join(' ') : `VLAN${vlanId}`;
      updateNode((item) => {
        const vlans = (item.vlans || []).filter((vlan) => vlan.id !== vlanId);
        return { ...item, vlans: [...vlans, { id: vlanId, name: vlanName }] };
      });
      output = [`VLAN ${vlanId} ${vlanName} created.`];
      changed = true;
    }
  } else if (command === 'no' && args[0]?.toLowerCase() === 'vlan') {
    const vlanId = Number(args[1]);
    updateNode((item) => ({ ...item, vlans: (item.vlans || []).filter((vlan) => vlan.id !== vlanId) }));
    output = vlanId ? [`VLAN ${vlanId} removed.`] : ['Usage: no vlan <id>'];
    changed = Boolean(vlanId);
  } else if (command === 'ip' && args[0]?.toLowerCase() === 'route') {
    const networkArg = args[1];
    const maskOrPrefix = args[2];
    const nextHop = args[3];
    if (!networkArg || !maskOrPrefix || !nextHop) output = ['Usage: ip route <network> <prefix-or-mask> <next-hop>'];
    else {
      const prefix = String(maskOrPrefix).includes('.') ? Number(maskOrPrefix.split('.').reduce((count, octet) => count + ((Number(octet) ? Math.clz32((~Number(octet) & 255) & 255) : 0)), 0)) : Number(maskOrPrefix);
      const normalizedPrefix = String(maskOrPrefix).includes('.') ? maskToPrefix(maskOrPrefix) : prefix;
      updateNode((item) => {
        const routes = (item.routes || []).filter((route) => route.network !== networkArg);
        return { ...item, routes: [...routes, { network: networkArg, prefixLength: normalizedPrefix, nextHop }] };
      });
      output = [`Route ${networkArg}/${normalizedPrefix} via ${nextHop} added.`];
      changed = true;
    }
  } else if (command === 'no' && args[0]?.toLowerCase() === 'ip' && args[1]?.toLowerCase() === 'route') {
    const networkArg = args[2];
    const prefixArg = args[3];
    const nextHop = args[4];
    updateNode((item) => ({
      ...item,
      routes: (item.routes || []).filter((route) => {
        if (networkArg && route.network !== networkArg) return true;
        if (prefixArg && route.prefixLength !== Number(prefixArg) && route.prefixLength !== undefined) return true;
        if (nextHop && route.nextHop !== nextHop) return true;
        return false;
      }),
    }));
    output = networkArg ? [`Route ${networkArg} removed.`] : ['Usage: no ip route <network> <prefix-or-mask> <next-hop>'];
    changed = Boolean(networkArg);
  } else if (command === 'route' && args[0]?.toLowerCase() === 'add') {
    const cidr = networkPrefix(args[1], 24);
    const nextHop = args[args.findIndex((arg) => arg.toLowerCase() === 'via') + 1];
    if (!cidr.network || !nextHop) output = ['Usage: route add <network>/<prefix> via <next-hop>'];
    else {
      updateNode((item) => ({ ...item, routes: [...(item.routes || []).filter((route) => route.network !== cidr.network), { network: cidr.network, prefixLength: cidr.prefix, nextHop }] }));
      output = [`Route ${cidr.network}/${cidr.prefix} via ${nextHop} added.`];
      changed = true;
    }
  } else if (command === 'switchport') {
    if (mode !== 'config-if' || !nextInterface) {
      output = ['% Enter interface configuration mode first.'];
    } else {
      const sub = args[0]?.toLowerCase();
      if (sub === 'mode') {
        const portMode = args[1]?.toLowerCase();
        if (portMode === 'access' || portMode === 'trunk') {
          updateNode((item) => ({
            ...item,
            interfaces: (item.interfaces || []).map((intf) => (
              intf.name === nextInterface ? { ...intf, mode: portMode } : intf
            )),
          }));
          output = [`Interface ${nextInterface} switchport mode set to ${portMode}.`];
          changed = true;
        } else {
          output = ['Usage: switchport mode access|trunk'];
        }
      } else if (sub === 'access' && args[1]?.toLowerCase() === 'vlan') {
        const vlanId = Number(args[2]);
        if (!vlanId) {
          output = ['Usage: switchport access vlan <id>'];
        } else {
          updateNode((item) => ({
            ...item,
            interfaces: (item.interfaces || []).map((intf) => (
              intf.name === nextInterface ? { ...intf, vlan: vlanId, mode: 'access' } : intf
            )),
          }));
          output = [`Interface ${nextInterface} assigned to VLAN ${vlanId}.`];
          changed = true;
        }
      } else if (sub === 'trunk' && args[1]?.toLowerCase() === 'allowed' && args[2]?.toLowerCase() === 'vlan') {
        const allowed = args.slice(3).join(' ');
        updateNode((item) => ({
          ...item,
          interfaces: (item.interfaces || []).map((intf) => (
            intf.name === nextInterface ? { ...intf, allowedVlans: allowed, mode: 'trunk' } : intf
          )),
        }));
        output = [`Interface ${nextInterface} allowed trunk VLANs set to: ${allowed}.`];
        changed = true;
      } else {
        output = ['Usage: switchport mode <access|trunk> | switchport access vlan <id>'];
      }
    }
  } else if (command === 'show' || command === 'sh') {
    const target = args.map((a) => a.toLowerCase()).join(' ');
    if (target === 'ip interface brief' || target === 'ip int brief' || target === 'ip int br' || target === 'ip interface') {
      const header = 'Interface                  IP-Address      OK? Method Status                Protocol';
      const intfs = node.interfaces && node.interfaces.length > 0
        ? node.interfaces
        : [{ name: 'FastEthernet0/1', ip: node.ip || 'unassigned', prefixLength: node.prefixLength, enabled: true }];
      const rows = intfs.map((intf) => {
        const name = (intf.name || 'Fa0/1').padEnd(27, ' ');
        const ip = (intf.ip && intf.ip !== '0.0.0.0' ? intf.ip : 'unassigned').padEnd(16, ' ');
        const ok = 'YES ';
        const method = 'manual ';
        const status = (intf.enabled === false ? 'administratively down' : 'up').padEnd(22, ' ');
        const proto = (intf.enabled === false ? 'down' : 'up');
        return `${name}${ip}${ok}${method}${status}${proto}`;
      });
      output = [header, ...rows];
    } else if (target === 'ip route' || target === 'ip ro') {
      const lines = [
        'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
        '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
        'Gateway of last resort is not set',
        '',
      ];
      const intfs = (node.interfaces || []).filter((i) => i.ip && i.ip !== '0.0.0.0');
      if (intfs.length > 0) {
        intfs.forEach((intf) => {
          const prefix = intf.prefixLength || 24;
          lines.push(`C        ${intf.ip}/${prefix} is directly connected, ${intf.name || 'FastEthernet0/1'}`);
          lines.push(`L        ${intf.ip}/32 is directly connected, ${intf.name || 'FastEthernet0/1'}`);
        });
      }
      if (Array.isArray(node.routes) && node.routes.length > 0) {
        node.routes.forEach((route) => {
          const code = route.protocol === 'OSPF' ? 'O' : route.protocol === 'RIP' ? 'R' : 'S';
          lines.push(`${code}        ${route.network}/${route.prefixLength || 24} [1/0] via ${route.nextHop}`);
        });
      }
      output = lines;
    } else if (target.includes('mac') || target.includes('mac-address-table')) {
      const lines = [
        '          Mac Address Table',
        '-------------------------------------------',
        'Vlan    Mac Address       Type        Ports',
        '----    -----------       --------    -----',
      ];
      const intfs = node.interfaces || [{ name: 'Fa0/1', mac: node.mac || '02:00:00:00:00:31' }];
      intfs.forEach((intf, idx) => {
        const vlan = String(intf.vlan || 1).padStart(4, ' ');
        const mac = (intf.mac || `02:00:00:00:00:${(idx + 1).toString(16).padStart(2, '0')}`).padEnd(17, ' ');
        const port = (intf.name || `Fa0/${idx + 1}`).padEnd(8, ' ');
        lines.push(`${vlan}    ${mac} DYNAMIC     ${port}`);
      });
      lines.push(`Total Mac Addresses for this criterion: ${intfs.length}`);
      output = lines;
    } else if (target === 'vlan brief' || target === 'vlan') {
      const lines = [
        'VLAN Name                             Status    Ports',
        '---- -------------------------------- --------- -------------------------------',
        '1    default                          active    Fa0/1, Fa0/2, Fa0/3, Fa0/4',
      ];
      if (Array.isArray(node.vlans) && node.vlans.length > 0) {
        node.vlans.forEach((v) => {
          const id = String(v.id).padEnd(4, ' ');
          const name = (v.name || `VLAN${v.id}`).padEnd(32, ' ');
          lines.push(`${id} ${name} active    Fa0/5, Fa0/6`);
        });
      }
      output = lines;
    } else if (target === 'running-config' || target === 'run') {
      output = generateCiscoConfig(node).split('\n');
    } else if (target.includes('access-list') || target === 'rules') {
      if (!Array.isArray(node.rules) || node.rules.length === 0) {
        output = ['% No access-lists configured.'];
      } else {
        const lines = ['Standard IP access list 101'];
        node.rules.forEach((rule, idx) => {
          const seq = (idx + 1) * 10;
          const action = rule.action === 'deny' ? 'deny' : 'permit';
          const port = rule.port ? ` eq ${rule.port}` : '';
          lines.push(`    ${seq} ${action} ip ${rule.targetIp === 'any' ? 'any' : `host ${rule.targetIp}`}${port}`);
        });
        output = lines;
      }
    } else {
      output = [`% Invalid show command 'show ${target}'. Try: show ip interface brief, show ip route, show mac-address-table, show vlan brief, show running-config`];
    }
  } else if (command === 'write' || command === 'copy' || command === 'wr') {
    if (command === 'wr' || (command === 'write' && args[0]?.toLowerCase() === 'memory') || (command === 'copy' && args.join(' ').toLowerCase().includes('run'))) {
      output = ['Building configuration...', '[OK]'];
    } else {
      output = ['Usage: write memory | copy running-config startup-config'];
    }
  } else if (command === 'rule' || (command === 'access-list')) {
    const action = args[0]?.toLowerCase();
    const targetIp = args[1];
    const portIndex = args.findIndex((arg) => arg.toLowerCase() === 'port');
    const portArg = portIndex >= 0 ? args[portIndex + 1] : args.find((arg) => /^\d+$/.test(arg));
    const port = portArg ? Number(portArg) : undefined;
    if (!['permit', 'deny', 'allow', 'block'].includes(action) || !targetIp) {
      output = ['Usage: rule permit|deny <ip> [port <number>]'];
    } else {
      updateNode((item) => {
        const rules = [...(item.rules || [])];
        rules.push({
          id: `rule-${Date.now()}`,
          name: `${action} ${targetIp}${port ? `:${port}` : ''}`,
          action: action === 'allow' || action === 'permit' ? 'permit' : 'deny',
          targetIp,
          port,
        });
        return { ...item, rules };
      });
      output = [`Firewall rule ${action} ${targetIp}${port ? ` port ${port}` : ''} added.`];
      changed = true;
    }
  } else if (command === 'no' && (args[0]?.toLowerCase() === 'rule' || args[0]?.toLowerCase() === 'access-list')) {
    const targetIp = args[1];
    updateNode((item) => ({ ...item, rules: targetIp ? (item.rules || []).filter((rule) => rule.targetIp !== targetIp) : [] }));
    output = [targetIp ? `Firewall rules targeting ${targetIp} removed.` : 'Firewall rules cleared.'];
    changed = true;
  }

  return { nodes, mode: nextMode, interfaceName: nextInterface, output, changed };
}

function maskToPrefix(mask) {
  const octets = String(mask).split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return 0;
  }

  let prefix = 0;
  let seenZero = false;
  for (const octet of octets) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      const one = (octet & (1 << bit)) !== 0;
      if (seenZero && one) return 0;
      if (one) prefix += 1;
      else seenZero = true;
    }
  }
  return prefix;
}
