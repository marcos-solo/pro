import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTerminalConfiguration,
  completeTerminalInput,
  generateCiscoConfig,
  parseCommandLine,
  prefixToMask,
  suggestCommand,
  terminalPrompt,
} from '../src/terminalEngine.js';

test('parses quoted terminal arguments and escaped characters', () => {
  assert.deepEqual(parseCommandLine('curl "example.com/network tools"'), ['curl', 'example.com/network tools']);
  assert.deepEqual(parseCommandLine("rule deny '10.0.0.50' port 80"), ['rule', 'deny', '10.0.0.50', 'port', '80']);
  assert.deepEqual(parseCommandLine('ping 192.168.1.4'), ['ping', '192.168.1.4']);
});

test('builds privilege prompts and command completions', () => {
  const pc = { name: 'Laptop', type: 'PC' };
  assert.equal(terminalPrompt(pc, 'user'), 'Laptop> ');
  assert.equal(terminalPrompt(pc, 'privileged'), 'Laptop# ');
  assert.equal(terminalPrompt(pc, 'config'), 'Laptop(config)# ');
  assert.equal(terminalPrompt(pc, 'config-if'), 'Laptop(config-if)# ');
  assert.equal(completeTerminalInput('p', pc, 'user'), 'ping');
});

test('suggests close command names', () => {
  assert.equal(suggestCommand('pign', ['ping', 'ipconfig', 'route print']), 'ping');
  assert.equal(suggestCommand('totally-unknown', ['ping', 'ipconfig']), null);
});

test('mutates IP configuration and interface state', () => {
  const nodes = [{ id: 1, name: 'PC', type: 'PC', ip: '192.168.1.10', prefixLength: 24, interfaces: [{ name: 'Fa0', ip: '192.168.1.10', prefixLength: 24 }] }];
  const result = applyTerminalConfiguration({
    nodes,
    nodeId: 1,
    mode: 'config-if',
    interfaceName: 'Fa0',
    parts: ['ip', 'address', '192.168.1.20/24'],
  });
  assert.equal(result.changed, true);
  assert.equal(result.nodes[0].ip, '192.168.1.20');
  assert.equal(result.nodes[0].interfaces[0].prefixLength, 24);
});

test('adds VLAN, route, and firewall policy configuration', () => {
  const switchNode = { id: 2, name: 'Switch', type: 'Switch', interfaces: [] };
  const vlanResult = applyTerminalConfiguration({
    nodes: [switchNode],
    nodeId: 2,
    mode: 'config',
    parts: ['vlan', '20', 'name', 'Engineering'],
  });
  assert.deepEqual(vlanResult.nodes[0].vlans, [{ id: 20, name: 'Engineering' }]);

  const router = { id: 3, name: 'Router', type: 'Router', interfaces: [], routes: [] };
  const routeResult = applyTerminalConfiguration({
    nodes: [router],
    nodeId: 3,
    mode: 'config',
    parts: ['ip', 'route', '172.16.0.0', '255.255.255.0', '10.0.0.2'],
  });
  assert.equal(routeResult.nodes[0].routes[0].nextHop, '10.0.0.2');
  assert.equal(routeResult.nodes[0].routes[0].prefixLength, 24);

  const narrowRoute = applyTerminalConfiguration({
    nodes: [router],
    nodeId: 3,
    mode: 'config',
    parts: ['ip', 'route', '172.16.0.0', '255.255.255.128', '10.0.0.2'],
  });
  assert.equal(narrowRoute.nodes[0].routes[0].prefixLength, 25);

  const firewall = { id: 4, name: 'Firewall', type: 'Firewall', interfaces: [], rules: [] };
  const ruleResult = applyTerminalConfiguration({
    nodes: [firewall],
    nodeId: 4,
    mode: 'config',
    parts: ['rule', 'deny', '10.0.0.50', 'port', '80'],
  });
  assert.equal(ruleResult.nodes[0].rules[0].action, 'deny');
  assert.equal(ruleResult.nodes[0].rules[0].targetIp, '10.0.0.50');
  assert.equal(ruleResult.nodes[0].rules[0].port, 80);
});

test('converts CIDR prefix to subnet mask and generates Cisco IOS config', () => {
  assert.equal(prefixToMask(24), '255.255.255.0');
  assert.equal(prefixToMask(30), '255.255.255.252');
  assert.equal(prefixToMask(16), '255.255.0.0');

  const router = {
    name: 'Edge-Router',
    type: 'Router',
    interfaces: [
      { name: 'Gi0/0', ip: '192.168.1.1', prefixLength: 24, enabled: true },
      { name: 'Gi0/1', ip: '10.0.0.1', prefixLength: 30, enabled: true },
    ],
    routes: [
      { network: '172.16.0.0', prefixLength: 24, nextHop: '10.0.0.2' },
    ],
  };
  const config = generateCiscoConfig(router);
  assert.ok(config.includes('hostname Edge-Router'));
  assert.ok(config.includes('interface Gi0/0'));
  assert.ok(config.includes('ip address 192.168.1.1 255.255.255.0'));
  assert.ok(config.includes('ip route 172.16.0.0 255.255.255.0 10.0.0.2'));
});

test('executes Cisco switchport commands and show verification commands', () => {
  const switchNode = {
    id: 10,
    name: 'CoreSwitch',
    type: 'Switch',
    interfaces: [{ name: 'Fa0/1', mac: '02:00:00:00:00:10' }],
    vlans: [{ id: 10, name: 'Sales' }],
  };

  // switchport mode access & switchport access vlan 10
  const portResult = applyTerminalConfiguration({
    nodes: [switchNode],
    nodeId: 10,
    mode: 'config-if',
    interfaceName: 'Fa0/1',
    parts: ['switchport', 'access', 'vlan', '10'],
  });
  assert.equal(portResult.changed, true);
  assert.equal(portResult.nodes[0].interfaces[0].vlan, 10);
  assert.equal(portResult.nodes[0].interfaces[0].mode, 'access');

  // show vlan brief
  const showVlan = applyTerminalConfiguration({
    nodes: portResult.nodes,
    nodeId: 10,
    mode: 'privileged',
    parts: ['show', 'vlan', 'brief'],
  });
  assert.ok(showVlan.output.some((line) => line.includes('Sales')));

  // show running-config
  const showRun = applyTerminalConfiguration({
    nodes: portResult.nodes,
    nodeId: 10,
    mode: 'privileged',
    parts: ['show', 'running-config'],
  });
  assert.ok(showRun.output.some((line) => line.includes('hostname CoreSwitch')));
  assert.ok(showRun.output.some((line) => line.includes('switchport access vlan 10')));

  // write memory
  const wr = applyTerminalConfiguration({
    nodes: portResult.nodes,
    nodeId: 10,
    mode: 'privileged',
    parts: ['write', 'memory'],
  });
  assert.deepEqual(wr.output, ['Building configuration...', '[OK]']);
});
