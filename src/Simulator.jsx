import { useEffect, useMemo, useRef, useState } from 'react';
import { CHALLENGES } from './Challenges.jsx';
import {
  calculateDynamicRoutes,
  calculateSpanningTree,
  calculateSubnet,
  primaryInterface,
  resolveDns,
  simulateDhcpLease,
  simulateDnsQuery,
  simulatePacket,
} from './networkEngine.js';
import {
  isSoundEnabled,
  playPacketDrop,
  playPacketHop,
  playPingSuccess,
  toggleSound,
} from './soundEngine.js';
import {
  loadProfile,
  markChallengeSolved,
  recordChallengeAttempt,
  saveProfile,
} from './progressStore.js';
import {
  applyTerminalConfiguration,
  completeTerminalInput,
  generateCiscoConfig,
  getDeviceCommands,
  parseCommandLine,
  suggestCommand,
  terminalPrompt,
} from './terminalEngine.js';
import { LabBuilderModal } from './LabBuilderModal.jsx';
import { WalkthroughTour } from './WalkthroughTour.jsx';

/* ------------------------------------------------------------------ */
/*  Device catalog & initial topologies                                */
/* ------------------------------------------------------------------ */

const initialNodes = [
  {
    id: 1, name: 'Laptop', type: 'PC', x: 18, y: 52,
    ip: '192.168.1.4', prefixLength: 24, gateway: '192.168.1.1',
    mac: 'AA:BB:CC:00:00:01',
    interfaces: [{ name: 'Fa0', ip: '192.168.1.4', prefixLength: 24, mac: 'AA:BB:CC:00:00:01' }],
  },
  {
    id: 2, name: 'Router', type: 'Router', x: 67, y: 35,
    interfaces: [
      { name: 'Gi0/0', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:21' },
      { name: 'Gi0/1', ip: '93.184.216.1', prefixLength: 24, mac: '02:00:00:00:00:22' },
    ],
  },
  {
    id: 3, name: 'L2 Switch', type: 'Switch', x: 43, y: 52,
    switchMode: 'L2',
    interfaces: [{ name: 'Fa0/1', mac: '02:00:00:00:00:31' }],
  },
  {
    id: 4, name: 'Web server', type: 'Server', x: 84, y: 72,
    ip: '93.184.216.34', prefixLength: 24, gateway: '93.184.216.1',
    mac: 'AA:BB:CC:00:00:04',
  },
  {
    id: 5, name: 'L3 Switch', type: 'L3Switch', x: 43, y: 72,
    switchMode: 'L3', routing: true,
    interfaces: [
      { name: 'Vlan1', ip: '192.168.1.254', prefixLength: 24, mac: '02:00:00:00:00:51' },
    ],
  },
  {
    id: 6, name: 'Wireless AP', type: 'AccessPoint', x: 28, y: 84,
    ssid: 'HomeNet', security: 'WPA2',
    ip: '192.168.1.2', prefixLength: 24, mac: '02:00:00:00:00:61',
  },
  {
    id: 7, name: 'Tablet', type: 'WirelessClient', x: 14, y: 84,
    ip: '192.168.1.20', prefixLength: 24, gateway: '192.168.1.1',
    mac: 'AA:BB:CC:00:00:07', wireless: true, ssid: 'HomeNet',
  },
  {
    id: 8, name: 'Firewall', type: 'Firewall', x: 55, y: 20,
    interfaces: [
      { name: 'outside', ip: '93.184.216.1', prefixLength: 24, mac: '02:00:00:00:00:81' },
      { name: 'inside', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:82' },
    ],
    rules: [],
  },
];

const initialLinks = [
  { from: 1, to: 3, cable: 'straightThrough' },
  { from: 3, to: 2, cable: 'straightThrough' },
  { from: 2, to: 4, cable: 'straightThrough' },
  { from: 6, to: 7, cable: 'wireless' },
];

const TOPOLOGY_PRESETS = {
  default: {
    name: 'Small Office (Default)',
    nodes: initialNodes,
    links: initialLinks,
    sourceId: 1,
    destinationId: 4,
  },
  dualSubnet: {
    name: 'Two Subnets with Router',
    nodes: [
      { id: 1, name: 'Finance PC', type: 'PC', x: 18, y: 35, ip: '192.168.10.5', prefixLength: 24, gateway: '192.168.10.1', mac: 'AA:BB:CC:00:00:10', interfaces: [{ name: 'Fa0', ip: '192.168.10.5', prefixLength: 24, mac: 'AA:BB:CC:00:00:10' }] },
      { id: 2, name: 'Finance Switch', type: 'Switch', x: 38, y: 35, mac: '02:00:00:00:00:20', interfaces: [{ name: 'Fa0/1', mac: '02:00:00:00:00:20' }] },
      {
        id: 3, name: 'Core Router', type: 'Router', x: 55, y: 50,
        interfaces: [
          { name: 'Gi0/0', ip: '192.168.10.1', prefixLength: 24, mac: '02:00:00:00:00:31' },
          { name: 'Gi0/1', ip: '192.168.20.1', prefixLength: 24, mac: '02:00:00:00:00:32' },
        ],
      },
      { id: 4, name: 'Dev Switch', type: 'Switch', x: 72, y: 65, mac: '02:00:00:00:00:40', interfaces: [{ name: 'Fa0/1', mac: '02:00:00:00:00:40' }] },
      { id: 5, name: 'Dev Workstation', type: 'PC', x: 88, y: 65, ip: '192.168.20.15', prefixLength: 24, gateway: '192.168.20.1', mac: 'AA:BB:CC:00:00:50', interfaces: [{ name: 'Fa0', ip: '192.168.20.15', prefixLength: 24, mac: 'AA:BB:CC:00:00:50' }] },
    ],
    links: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
      { from: 3, to: 4, cable: 'straightThrough' },
      { from: 4, to: 5, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destinationId: 5,
  },
  homeWifi: {
    name: 'Home Wi-Fi & Internet',
    nodes: [
      { id: 1, name: 'Smartphone', type: 'WirelessClient', x: 18, y: 40, ip: '192.168.1.101', prefixLength: 24, gateway: '192.168.1.1', mac: 'AA:BB:CC:00:00:11', wireless: true, ssid: 'HomeNet', interfaces: [{ name: 'Wlan0', ip: '192.168.1.101', prefixLength: 24, mac: 'AA:BB:CC:00:00:11' }] },
      { id: 2, name: 'Wi-Fi AP', type: 'AccessPoint', x: 38, y: 40, ip: '192.168.1.2', prefixLength: 24, ssid: 'HomeNet', security: 'WPA2', mac: '02:00:00:00:00:21', interfaces: [{ name: 'Gi0', ip: '192.168.1.2', prefixLength: 24, mac: '02:00:00:00:00:21' }] },
      {
        id: 3, name: 'Home Gateway', type: 'Router', x: 58, y: 40,
        interfaces: [
          { name: 'LAN', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:31' },
          { name: 'WAN', ip: '198.51.100.2', prefixLength: 24, mac: '02:00:00:00:00:32' },
        ],
      },
      { id: 4, name: 'Public DNS Server', type: 'Server', x: 82, y: 40, ip: '198.51.100.8', prefixLength: 24, gateway: '198.51.100.2', mac: 'AA:BB:CC:00:00:41', interfaces: [{ name: 'eth0', ip: '198.51.100.8', prefixLength: 24, mac: 'AA:BB:CC:00:00:41' }] },
    ],
    links: [
      { from: 1, to: 2, cable: 'wireless' },
      { from: 2, to: 3, cable: 'straightThrough' },
      { from: 3, to: 4, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destinationId: 4,
  },
  dmzSecurity: {
    name: 'Enterprise DMZ & Firewall',
    nodes: [
      { id: 1, name: 'Internet Client', type: 'PC', x: 15, y: 50, ip: '203.0.113.15', prefixLength: 24, gateway: '203.0.113.1', mac: 'AA:BB:CC:00:00:15', interfaces: [{ name: 'eth0', ip: '203.0.113.15', prefixLength: 24, mac: 'AA:BB:CC:00:00:15' }] },
      {
        id: 2, name: 'Perimeter Firewall', type: 'Firewall', x: 42, y: 50,
        interfaces: [
          { name: 'WAN', ip: '203.0.113.1', prefixLength: 24, mac: '02:00:00:00:00:21' },
          { name: 'DMZ', ip: '10.0.1.1', prefixLength: 24, mac: '02:00:00:00:00:22' },
        ],
        rules: [],
      },
      { id: 3, name: 'DMZ Web Server', type: 'Server', x: 70, y: 35, ip: '10.0.1.80', prefixLength: 24, gateway: '10.0.1.1', mac: 'AA:BB:CC:00:00:80', interfaces: [{ name: 'eth0', ip: '10.0.1.80', prefixLength: 24, mac: 'AA:BB:CC:00:00:80' }] },
      { id: 4, name: 'Internal DB Server', type: 'Server', x: 88, y: 65, ip: '10.0.1.90', prefixLength: 24, gateway: '10.0.1.1', mac: 'AA:BB:CC:00:00:90', interfaces: [{ name: 'eth0', ip: '10.0.1.90', prefixLength: 24, mac: 'AA:BB:CC:00:00:90' }] },
    ],
    links: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
      { from: 2, to: 4, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destinationId: 3,
  },
  routingLoop: {
    name: 'Routing Loop & Expired TTL',
    nodes: [
      { id: 1, name: 'PC A', type: 'PC', x: 15, y: 50, ip: '192.168.1.10', prefixLength: 24, gateway: '192.168.1.1', mac: 'AA:BB:CC:00:00:01', interfaces: [{ name: 'eth0', ip: '192.168.1.10', prefixLength: 24, mac: 'AA:BB:CC:00:00:01' }] },
      {
        id: 2, name: 'Router 1', type: 'Router', x: 38, y: 35,
        interfaces: [
          { name: 'Gi0/0', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:21' },
          { name: 'Gi0/1', ip: '10.0.0.1', prefixLength: 24, mac: '02:00:00:00:00:22' },
        ],
        routes: [{ network: '172.16.0.0', prefixLength: 24, nextHop: '10.0.0.2' }],
      },
      {
        id: 3, name: 'Router 2', type: 'Router', x: 65, y: 35,
        interfaces: [
          { name: 'Gi0/0', ip: '10.0.0.2', prefixLength: 24, mac: '02:00:00:00:00:31' },
          { name: 'Gi0/1', ip: '10.1.0.1', prefixLength: 24, mac: '02:00:00:00:00:32' },
        ],
        routes: [{ network: '172.16.0.0', prefixLength: 24, nextHop: '10.1.0.2' }],
      },
      {
        id: 4, name: 'Router 3 (Loop)', type: 'Router', x: 50, y: 70,
        interfaces: [
          { name: 'Gi0/0', ip: '10.1.0.2', prefixLength: 24, mac: '02:00:00:00:00:41' },
          { name: 'Gi0/1', ip: '10.2.0.1', prefixLength: 24, mac: '02:00:00:00:00:42' },
        ],
        routes: [{ network: '172.16.0.0', prefixLength: 24, nextHop: '10.0.0.1' }],
      },
      { id: 5, name: 'Remote Server', type: 'Server', x: 88, y: 50, ip: '172.16.0.50', prefixLength: 24, gateway: '172.16.0.1', mac: 'AA:BB:CC:00:00:50', interfaces: [{ name: 'eth0', ip: '172.16.0.50', prefixLength: 24, mac: 'AA:BB:CC:00:00:50' }] },
    ],
    links: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'serial' },
      { from: 3, to: 4, cable: 'serial' },
      { from: 4, to: 2, cable: 'serial' },
    ],
    sourceId: 1,
    destinationId: 5,
  },
};

const DEVICE_CATALOG = [
  { group: 'End devices', items: ['PC', 'Server', 'WirelessClient'] },
  { group: 'Network devices', items: ['Switch', 'L3Switch', 'Router'] },
  { group: 'Wireless', items: ['AccessPoint'] },
  { group: 'Security / WAN', items: ['Firewall', 'Modem'] },
];

const SHELF_CATEGORIES = [
  { id: 'all', label: '📦 All Hardware' },
  { id: 'network', label: '🌐 Network Devices' },
  { id: 'end', label: '💻 End Devices' },
  { id: 'wireless', label: '📡 Wireless' },
  { id: 'security', label: '🛡️ Security & WAN' },
  { id: 'cables', label: '⚡ Connections' },
];

const nodePositions = [
  { x: 15, y: 25 }, { x: 50, y: 25 }, { x: 85, y: 25 },
  { x: 15, y: 75 }, { x: 50, y: 75 }, { x: 85, y: 75 },
];

const CABLE_TYPES = {
  straightThrough: {
    id: 'straightThrough', label: 'Straight-through (Cat6)',
    color: '#3b82f6',
    description: 'Connects unlike devices (PC↔Switch, Switch↔Router)',
  },
  crossover: {
    id: 'crossover', label: 'Crossover (Cat6)',
    color: '#f59e0b',
    description: 'Connects like devices (Switch↔Switch, Router↔Router)',
  },
  fiber: {
    id: 'fiber', label: 'Fiber (OM4)',
    color: '#10b981',
    description: 'Long-distance uplinks, high speed',
  },
  serial: {
    id: 'serial', label: 'Serial (DCE/DTE)',
    color: '#8b5cf6',
    description: 'WAN links between routers',
  },
  wireless: {
    id: 'wireless', label: 'Wireless (802.11ac)',
    color: '#06b6d4',
    description: 'Client to Access Point only',
  },
  console: {
    id: 'console', label: 'Console (rollover)',
    color: '#6b7280',
    description: 'Management only (no data)',
  },
};

const normalizeType = (t) => {
  if (t === 'L3Switch' || t === 'Firewall' || t === 'Modem') return 'Router';
  return t;
};

function suggestCable(fromType, toType) {
  if (fromType === 'WirelessClient' || toType === 'WirelessClient') {
    return (fromType === 'AccessPoint' || toType === 'AccessPoint') ? 'wireless' : null;
  }
  const a = normalizeType(fromType);
  const b = normalizeType(toType);
  if (a === 'Router' && b === 'Router') return 'serial';
  if (a === 'Switch' && b === 'Switch') return 'crossover';
  if (a === b && (a === 'PC' || a === 'Server')) return 'crossover';
  return 'straightThrough';
}

function validateCable(fromNode, toNode, cableType) {
  if (!fromNode || !toNode) return null;
  if (cableType === 'wireless') {
    const isAP = fromNode.type === 'AccessPoint' || toNode.type === 'AccessPoint';
    const isClient = fromNode.type === 'WirelessClient' || toNode.type === 'WirelessClient';
    if (!isAP || !isClient) return 'Wireless connections require an Access Point and a Wireless Client.';
  }
  if (cableType === 'serial') {
    const a = normalizeType(fromNode.type);
    const b = normalizeType(toNode.type);
    if (a !== 'Router' || b !== 'Router') return 'Serial cables connect routers or WAN gateways together.';
  }
  return null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function snap(val, step = 5) {
  return Math.round(val / step) * step;
}

function makeDevice(type, id, position) {
  const base = { id, name: `${type} ${id}`, type, x: position.x, y: position.y };
  if (type === 'PC' || type === 'WirelessClient') {
    return {
      ...base,
      ip: `192.168.1.${10 + id}`, prefixLength: 24, gateway: '192.168.1.1',
      mac: `AA:BB:CC:00:00:${id.toString(16).padStart(2, '0')}`,
      wireless: type === 'WirelessClient',
      interfaces: [{ name: 'eth0', ip: `192.168.1.${10 + id}`, prefixLength: 24, mac: `AA:BB:CC:00:00:${id.toString(16).padStart(2, '0')}` }],
    };
  }
  if (type === 'Server') {
    return {
      ...base,
      ip: `192.168.1.${50 + id}`, prefixLength: 24, gateway: '192.168.1.1',
      mac: `AA:BB:CC:00:00:${id.toString(16).padStart(2, '0')}`,
      interfaces: [{ name: 'eth0', ip: `192.168.1.${50 + id}`, prefixLength: 24, mac: `AA:BB:CC:00:00:${id.toString(16).padStart(2, '0')}` }],
    };
  }
  if (type === 'Router' || type === 'Firewall') {
    return {
      ...base,
      interfaces: [
        { name: 'Gi0/0', ip: `192.168.${id}.1`, prefixLength: 24, mac: `02:00:00:00:${id.toString(16).padStart(2, '0')}:01` },
        { name: 'Gi0/1', ip: `10.${id}.0.1`, prefixLength: 24, mac: `02:00:00:00:${id.toString(16).padStart(2, '0')}:02` },
      ],
      rules: [],
    };
  }
  if (type === 'Switch' || type === 'L3Switch') {
    return {
      ...base,
      switchMode: type === 'L3Switch' ? 'L3' : 'L2',
      interfaces: [{ name: 'Fa0/1', mac: `02:00:00:00:${id.toString(16).padStart(2, '0')}:01` }],
    };
  }
  if (type === 'AccessPoint') {
    return {
      ...base,
      ssid: 'HomeNet', security: 'WPA2', ip: `192.168.1.${200 + id}`, prefixLength: 24,
      mac: `02:00:00:00:${id.toString(16).padStart(2, '0')}:01`,
    };
  }
  return base;
}

const deviceIconShapes = {
  PC: (
    <>
      <rect x="4" y="3" width="16" height="12" rx="1.8" />
      <path d="M9 19h6m-3-4v4M2.5 19h19" />
    </>
  ),
  Server: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 9h14m-14 6h14" />
      <circle cx="8" cy="6" r=".7" />
      <circle cx="8" cy="12" r=".7" />
      <circle cx="8" cy="18" r=".7" />
    </>
  ),
  Router: (
    <>
      <rect x="3" y="11" width="18" height="8" rx="2" />
      <path d="M7 11V7m10 4V7M8 7a5.7 5.7 0 0 1 8 0M10 5a2.8 2.8 0 0 1 4 0" />
      <circle cx="8" cy="15" r=".7" />
      <circle cx="12" cy="15" r=".7" />
      <circle cx="16" cy="15" r=".7" />
    </>
  ),
  Switch: (
    <>
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 11v3m4-3v3m4-3v3m4-3v3" />
    </>
  ),
  L3Switch: (
    <>
      <rect x="3" y="8" width="18" height="10" rx="2" />
      <path d="M7 12v3m4-3v3m4-3v3m4-3v3M8 5h8m-3-3 3 3-3 3" />
    </>
  ),
  AccessPoint: (
    <>
      <path d="M3 11a13 13 0 0 1 18 0M6.5 14a8 8 0 0 1 11 0M10 17a3 3 0 0 1 4 0" />
      <path d="M12 17v4m-5 0h10" />
      <circle cx="12" cy="19" r=".6" />
    </>
  ),
  WirelessClient: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M10 5h4m-3 13.5h2" />
    </>
  ),
  Firewall: (
    <>
      <path d="M12 2.5 20 6v5.5c0 4.7-3.2 8-8 10-4.8-2-8-5.3-8-10V6l8-3.5Z" />
      <path d="M7 9h4m2 0h4M6.5 12h3m5 0h3m-9 3h4m2 0h2" />
    </>
  ),
  Modem: (
    <>
      <rect x="3" y="10" width="18" height="9" rx="2" />
      <path d="M7 10V6m10 4V6m-7 7h.01m4 0h.01m-4 3h.01m4 0h.01" />
      <path d="M9 6a4 4 0 0 1 6 0" />
    </>
  ),
};

function DeviceIcon({ type }) {
  return (
    <svg className="device-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {deviceIconShapes[type] || deviceIconShapes.PC}
    </svg>
  );
}

function getInitialChallengeState() {
  try {
    const rawChallenge = typeof window !== 'undefined' ? sessionStorage.getItem('netwise.simulator.loadChallenge') : null;
    if (rawChallenge) {
      const parsed = JSON.parse(rawChallenge);
      const match = CHALLENGES.find((c) => c.id === parsed.challengeId);
      if (match) {
        sessionStorage.removeItem('netwise.simulator.loadChallenge');
        return {
          challenge: match,
          nodes: parsed.nodes,
          links: parsed.links,
          sourceId: parsed.sourceId,
          destinationId: parsed.destId,
        };
      }
    }
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const challengeParam = urlParams?.get('challenge');
    if (challengeParam) {
      const match = CHALLENGES.find((c) => c.id === challengeParam);
      if (match) {
        return {
          challenge: match,
          nodes: match.initialNodes,
          links: match.initialLinks,
          sourceId: match.sourceId,
          destinationId: match.destId,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function loadSimulatorAutosave() {
  try {
    const saved = JSON.parse(localStorage.getItem('netwise.simulator.autosave') || 'null');
    return saved && Array.isArray(saved.nodes) && Array.isArray(saved.links) ? saved : null;
  } catch {
    return null;
  }
}

function Simulator() {
  const [initChallenge] = useState(getInitialChallengeState);
  const [autosave] = useState(loadSimulatorAutosave);
  const [nodes, setNodes] = useState(() => initChallenge?.nodes ?? autosave?.nodes ?? initialNodes);
  const [links, setLinks] = useState(() => initChallenge?.links ?? autosave?.links ?? initialLinks);
  const [nextNodeId, setNextNodeId] = useState(() => (initChallenge ? 12 : 9));
  const [selectedNodeId, setSelectedNodeId] = useState(() => initChallenge?.sourceId ?? 1);
  const [sourceId, setSourceId] = useState(() => initChallenge?.sourceId ?? 1);
  const [destinationId, setDestinationId] = useState(() => initChallenge?.destinationId ?? 4);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState(null);
  const [simMessage, setSimMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentHop, setCurrentHop] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTwoWay, setIsTwoWay] = useState(false);
  const [simProtocol, setSimProtocol] = useState('ICMP'); // 'ICMP' | 'TCP'
  const [speed, setSpeed] = useState(1);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  // History for Undo / Redo
  const [history, setHistory] = useState(() => [{ nodes: initChallenge?.nodes ?? initialNodes, links: initChallenge?.links ?? initialLinks }]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Inspector Tabs: 'config' | 'terminal'
  const [inspectorTab, setInspectorTab] = useState('config');
  const [terminalLogs, setTerminalLogs] = useState({});
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [terminalModes, setTerminalModes] = useState({});
  const [terminalInterfaces, setTerminalInterfaces] = useState({});
  const [terminalHistories, setTerminalHistories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('netwise.terminal.histories') || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  });
  const [terminalHistoryPointers, setTerminalHistoryPointers] = useState({});
  const [terminalPaletteOpen, setTerminalPaletteOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Modals & Panels
  const [pendingConnect, setPendingConnect] = useState(null);
  const [pendingCable, setPendingCable] = useState('straightThrough');
  const [cablePickerOpen, setCablePickerOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [inspectorModalOpen, setInspectorModalOpen] = useState(false);
  const [inspectorViewMode, setInspectorViewMode] = useState('layers');
  const [showWireshark, setShowWireshark] = useState(false);
  const [packetFilter, setPacketFilter] = useState('');

  // Challenge Mode State
  const [activeChallenge, setActiveChallenge] = useState(() => initChallenge?.challenge ?? null);
  const [challengeSolvedMsg, setChallengeSolvedMsg] = useState('');
  const [challengeErrorMsg, setChallengeErrorMsg] = useState('');
  const [challengeHintVisible, setChallengeHintVisible] = useState(false);
  const [customTopologies, setCustomTopologies] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('netwise.simulator.savedTopologies') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // Canvas transform
  const canvasRef = useRef(null);
  const cableDialogRef = useRef(null);
  const terminalBottomRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  // Drag / connect / pan state
  const [drag, setDrag] = useState(null);
  const [linkDrag, setLinkDrag] = useState(null);
  const [pan, setPan] = useState(null);

  // Canvas Sticky Notes
  const [notes, setNotes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('netwise.simulator.notes') || 'null');
      return Array.isArray(saved) ? saved : [
        { id: 1, x: 22, y: 18, text: 'VLAN 10 - Sales Subnet\n192.168.1.0/24', color: 'yellow' },
      ];
    } catch {
      return [{ id: 1, x: 22, y: 18, text: 'VLAN 10 - Sales Subnet\n192.168.1.0/24', color: 'yellow' }];
    }
  });
  const [noteDrag, setNoteDrag] = useState(null);

  // Packet Tracer Bottom Equipment Shelf
  const [activeShelfCategory, setActiveShelfCategory] = useState('all');
  const [shelfCollapsed, setShelfCollapsed] = useState(false);

  // Modals & Guided Tour
  const [labBuilderOpen, setLabBuilderOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Spanning Tree Protocol calculation
  const stpState = useMemo(() => calculateSpanningTree(nodes, links), [nodes, links]);

  useEffect(() => {
    try {
      localStorage.setItem('netwise.simulator.notes', JSON.stringify(notes));
    } catch {
      // Storage optional
    }
  }, [notes]);

  useEffect(() => {
    if (activeChallenge) return undefined;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem('netwise.simulator.autosave', JSON.stringify({
          nodes,
          links,
          sourceId,
          destinationId,
          savedAt: new Date().toISOString(),
        }));
      } catch {
        // Autosave is optional when browser storage is unavailable.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [nodes, links, sourceId, destinationId, activeChallenge]);

  const pushState = (newNodes, newLinks) => {
    const updatedHistory = history.slice(0, historyIdx + 1);
    updatedHistory.push({ nodes: newNodes, links: newLinks });
    setHistory(updatedHistory);
    setHistoryIdx(updatedHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setNodes(prev.nodes);
      setLinks(prev.links);
      setHistoryIdx(historyIdx - 1);
      resetSimulation();
      setSimMessage('Undo action');
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setNodes(next.nodes);
      setLinks(next.links);
      setHistoryIdx(historyIdx + 1);
      resetSimulation();
      setSimMessage('Redo action');
    }
  };

  const simulation = useMemo(
    () => simulatePacket({
      nodes,
      links,
      sourceId,
      destinationId,
      twoWay: isTwoWay,
      protocol: simProtocol,
    }),
    [nodes, links, sourceId, destinationId, isTwoWay, simProtocol],
  );

  const trace = simulation.events;
  const currentEvent = trace[currentHop];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const currentNode = currentEvent ? nodes.find((node) => node.id === currentEvent.nodeId) : null;
  const isFinished = isRunning && currentHop === trace.length - 1;
  const isDelivered = isFinished && currentEvent?.kind === 'delivery';
  const isFailed = isFinished && currentEvent?.kind === 'error';

  const resetSimulation = () => {
    setIsRunning(false);
    setCurrentHop(0);
    setIsPaused(false);
  };

  // Subnet visual grouping (Broadcast Domain Clouds)
  const subnetGroups = useMemo(() => {
    const groups = new Map();
    nodes.forEach((n) => {
      const intf = primaryInterface(n);
      if (intf?.ip && intf.ip !== '0.0.0.0') {
        const sub = calculateSubnet(intf.ip, intf.prefixLength || 24);
        if (sub) {
          const key = `${sub.network}/${sub.prefix}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(n);
        }
      }
    });

    const result = [];
    groups.forEach((groupNodes, subnetId) => {
      if (groupNodes.length >= 2) {
        const xs = groupNodes.map((n) => n.x);
        const ys = groupNodes.map((n) => n.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        result.push({
          subnetId,
          x: Math.max(2, minX - 6),
          y: Math.max(4, minY - 6),
          width: Math.min(94, maxX - minX + 12),
          height: Math.min(92, maxY - minY + 12),
          nodesCount: groupNodes.length,
        });
      }
    });
    return result;
  }, [nodes]);

  // Audio effects during packet transit
  useEffect(() => {
    if (!isRunning) return;
    if (isDelivered) {
      playPingSuccess();
    } else if (isFailed) {
      playPacketDrop();
    } else if (currentHop > 0) {
      playPacketHop();
    }
  }, [isRunning, currentHop, isDelivered, isFailed]);

  // Simulation timer
  useEffect(() => {
    if (!isRunning || isPaused || isFinished) return undefined;
    const interval = Math.max(280, 1050 / speed);
    const timer = window.setTimeout(() => {
      setCurrentHop((hop) => Math.min(hop + 1, trace.length - 1));
    }, interval);
    return () => window.clearTimeout(timer);
  }, [isRunning, isPaused, isFinished, currentHop, trace.length, speed]);

  useEffect(() => {
    if (inspectorTab === 'terminal') {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, inspectorTab, selectedNodeId]);

  /* -------- Coordinate conversion -------- */
  const toCanvasPercent = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const vx = (clientX - rect.left - view.x) / view.scale;
    const vy = (clientY - rect.top - view.y) / view.scale;
    return {
      x: clamp((vx / rect.width) * 100, 0, 100),
      y: clamp((vy / rect.height) * 100, 0, 100),
    };
  };

  /* -------- Node drag -------- */
  const handleNodePointerDown = (event, node) => {
    if (event.button !== 0) return;
    if (connectMode) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey) {
      const point = toCanvasPercent(event.clientX, event.clientY);
      setLinkDrag({ fromId: node.id, pointerId: event.pointerId, currentX: point.x, currentY: point.y });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    setSelectedNodeId(node.id);
    setDrag({
      nodeId: node.id, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      startLeft: node.x, startTop: node.y, moved: false,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleNotePointerDown = (event, note) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setNoteDrag({
      id: note.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: note.x,
      startTop: note.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (drag) {
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((event.clientX - drag.startX) / view.scale / rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / view.scale / rect.height) * 100;
      let nx = drag.startLeft + dx;
      let ny = drag.startTop + dy;
      if (event.shiftKey) { nx = snap(nx); ny = snap(ny); }
      nx = clamp(nx, 4, 96); ny = clamp(ny, 6, 94);
      setNodes((current) => current.map((n) => (
        n.id === drag.nodeId ? { ...n, x: nx, y: ny } : n
      )));
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        setDrag((d) => d && { ...d, moved: true });
      }
      return;
    }

    if (noteDrag) {
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((event.clientX - noteDrag.startX) / view.scale / rect.width) * 100;
      const dy = ((event.clientY - noteDrag.startY) / view.scale / rect.height) * 100;
      const nx = clamp(noteDrag.startLeft + dx, 2, 92);
      const ny = clamp(noteDrag.startTop + dy, 2, 92);
      setNotes((current) => current.map((n) => (n.id === noteDrag.id ? { ...n, x: nx, y: ny } : n)));
      return;
    }

    if (linkDrag) {
      const point = toCanvasPercent(event.clientX, event.clientY);
      setLinkDrag((d) => d && { ...d, currentX: point.x, currentY: point.y });
      return;
    }

    if (pan) {
      setView((v) => ({
        ...v,
        x: pan.startViewX + (event.clientX - pan.startX),
        y: pan.startViewY + (event.clientY - pan.startY),
      }));
    }
  };

  const handlePointerUp = () => {
    if (drag) {
      if (!drag.moved && connectMode) handleNodeClickForConnect(drag.nodeId);
      if (drag.moved) pushState(nodes, links);
      setDrag(null);
    }

    if (noteDrag) {
      setNoteDrag(null);
    }

    if (linkDrag) {
      const point = { x: linkDrag.currentX, y: linkDrag.currentY };
      const hit = nodes.find((n) => (
        Math.abs(n.x - point.x) < 6 && Math.abs(n.y - point.y) < 8
      ));
      if (hit && hit.id !== linkDrag.fromId) {
        const fromNode = nodes.find((n) => n.id === linkDrag.fromId);
        const suggested = suggestCable(fromNode.type, hit.type) || 'straightThrough';
        setPendingCable(suggested);
        setPendingConnect({ fromId: linkDrag.fromId, toId: hit.id });
        setCablePickerOpen(true);
      }
      setLinkDrag(null);
    }

    if (pan) setPan(null);
  };

  const addNote = () => {
    const newNote = {
      id: Date.now(),
      x: clamp(30 - view.x / 10, 8, 75),
      y: clamp(25 - view.y / 10, 8, 75),
      text: 'New Subnet Note',
      color: 'yellow',
    };
    setNotes((prev) => [...prev, newNote]);
    setSimMessage('Added sticky note to canvas.');
  };

  const updateNote = (id, field, value) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)));
  };

  const deleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const startConnectModeWithCable = (cableId) => {
    setConnectMode(true);
    setConnectFromId(null);
    setPendingCable(cableId || 'straightThrough');
    const cableLabel = CABLE_TYPES[cableId]?.label || 'cable';
    setSimMessage(`Connect Mode: Click first device, then second device (${cableLabel}).`);
  };

  const getFilteredDevices = (cat) => {
    if (cat === 'network') return ['Router', 'Switch', 'L3Switch'];
    if (cat === 'end') return ['PC', 'Server', 'WirelessClient'];
    if (cat === 'wireless') return ['AccessPoint', 'WirelessClient'];
    if (cat === 'security') return ['Firewall', 'Modem'];
    return ['PC', 'Server', 'Switch', 'L3Switch', 'Router', 'Firewall', 'AccessPoint', 'WirelessClient', 'Modem'];
  };

  /* -------- Connect-mode click flow -------- */
  const handleNodeClickForConnect = (nodeId) => {
    if (connectFromId === null) {
      setConnectFromId(nodeId);
      setSelectedNodeId(nodeId);
      setSimMessage('Now choose another device to connect.');
      return;
    }
    if (connectFromId === nodeId) {
      setConnectFromId(null);
      setSimMessage('Choose a different device to make a connection.');
      return;
    }
    const fromNode = nodes.find((n) => n.id === connectFromId);
    const toNode = nodes.find((n) => n.id === nodeId);
    const suggested = suggestCable(fromNode.type, toNode.type) || 'straightThrough';
    setPendingCable(suggested);
    setPendingConnect({ fromId: connectFromId, toId: nodeId });
    setCablePickerOpen(true);
    setConnectFromId(null);
  };

  const commitConnection = () => {
    if (!pendingConnect) return;
    const exists = links.some(({ from, to }) => (
      (from === pendingConnect.fromId && to === pendingConnect.toId) ||
      (from === pendingConnect.toId && to === pendingConnect.fromId)
    ));
    if (exists) {
      setSimMessage('Those devices are already connected.');
    } else {
      resetSimulation();
      const updatedLinks = [...links, {
        from: pendingConnect.fromId,
        to: pendingConnect.toId,
        cable: pendingCable,
      }];
      setLinks(updatedLinks);
      pushState(nodes, updatedLinks);
      setSimMessage(`${CABLE_TYPES[pendingCable].label} added.`);
    }
    setCablePickerOpen(false);
    setPendingConnect(null);
    setConnectMode(false);
  };

  const cancelCablePicker = () => {
    setCablePickerOpen(false);
    setPendingConnect(null);
    setConnectFromId(null);
    setConnectMode(false);
    setSimMessage('');
  };

  /* -------- Auto Layout -------- */
  const handleAutoLayout = () => {
    const tier1 = []; // Internet / Cloud / Public Server
    const tier2 = []; // Routers / Firewalls
    const tier3 = []; // Switches / APs
    const tier4 = []; // End devices

    nodes.forEach((n) => {
      if (n.type === 'Modem' || n.name.toLowerCase().includes('cloud') || n.name.toLowerCase().includes('public')) {
        tier1.push(n);
      } else if (n.type === 'Router' || n.type === 'Firewall' || n.type === 'L3Switch') {
        tier2.push(n);
      } else if (n.type === 'Switch' || n.type === 'AccessPoint') {
        tier3.push(n);
      } else {
        tier4.push(n);
      }
    });

    const placeTier = (tier, y) => {
      const count = tier.length;
      if (count === 0) return [];
      const step = 70 / Math.max(1, count);
      const startX = 15 + step / 2;
      return tier.map((n, i) => ({
        ...n,
        x: Math.round(startX + i * step),
        y,
      }));
    };

    const placedNodes = [
      ...placeTier(tier1, 18),
      ...placeTier(tier2, 38),
      ...placeTier(tier3, 62),
      ...placeTier(tier4, 82),
    ];
    const newNodes = calculateDynamicRoutes(placedNodes, links, 'OSPF');

    resetSimulation();
    setNodes(newNodes);
    pushState(newNodes, links);
    setSimMessage('Canvas automatically organized by network tier with OSPF routes.');
  };

  /* -------- Canvas pan/zoom -------- */
  const handleCanvasClick = (event) => {
    if (event.target === canvasRef.current || event.target.tagName === 'svg') {
      if (connectMode) {
        setConnectMode(false);
        setConnectFromId(null);
        setSimMessage('');
      }
    }
  };

  const handleWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const delta = -event.deltaY * 0.001;
    const newScale = clamp(view.scale * (1 + delta), 0.5, 2.2);
    const ratio = newScale / view.scale;
    setView({
      scale: newScale,
      x: mx - (mx - view.x) * ratio,
      y: my - (my - view.y) * ratio,
    });
  };

  const zoomBy = (factor) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const newScale = clamp(view.scale * factor, 0.5, 2.2);
    const ratio = newScale / view.scale;
    setView({
      scale: newScale,
      x: mx - (mx - view.x) * ratio,
      y: my - (my - view.y) * ratio,
    });
  };

  const handleCanvasPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target !== canvasRef.current
      && event.target.tagName !== 'svg'
      && event.target.tagName !== 'line') return;
    if (event.shiftKey) return;

    setPan({
      pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      startViewX: view.x, startViewY: view.y,
    });
    canvasRef.current.setPointerCapture(event.pointerId);
  };

  /* -------- Topology Presets -------- */
  const handleLoadPreset = (key) => {
    const preset = TOPOLOGY_PRESETS[key];
    if (!preset) return;
    resetSimulation();
    setNodes(preset.nodes);
    setLinks(preset.links);
    pushState(preset.nodes, preset.links);
    setSourceId(preset.sourceId);
    setDestinationId(preset.destinationId);
    setSelectedNodeId(preset.sourceId);
    setNextNodeId(12);
    setView({ x: 0, y: 0, scale: 1 });
    setSimMessage(`Loaded preset: ${preset.name}`);
  };

  /* -------- CRUD -------- */
  const addNodeOfType = (type, customPos = null) => {
    if (nodes.length >= initialNodes.length + nodePositions.length + 15) {
      setSimMessage('Your network canvas is full.');
      return;
    }
    const id = nextNodeId;
    const position = customPos || nodePositions[(nodes.length - 2) % nodePositions.length] || { x: 50, y: 50 };
    const newDevice = makeDevice(type, id, position);
    resetSimulation();
    const updated = [...nodes, newDevice];
    setNodes(updated);
    pushState(updated, links);
    setSelectedNodeId(id);
    setNextNodeId((current) => current + 1);
    setSimMessage(`Added ${newDevice.name} to workspace.`);
    setCatalogOpen(false);
  };

  const deleteNode = (id) => {
    if (nodes.length <= 1) {
      setSimMessage('Keep at least one device on the canvas.');
      return;
    }
    resetSimulation();
    const updatedNodes = nodes.filter((n) => n.id !== id);
    const updatedLinks = links.filter(({ from, to }) => from !== id && to !== id);
    setNodes(updatedNodes);
    setLinks(updatedLinks);
    pushState(updatedNodes, updatedLinks);
    if (selectedNodeId === id) setSelectedNodeId(updatedNodes[0]?.id ?? 1);
    if (sourceId === id) setSourceId(updatedNodes[0]?.id ?? 1);
    if (destinationId === id) setDestinationId(updatedNodes[0]?.id ?? 1);
    setSimMessage('Device removed.');
  };

  const deleteLink = (from, to) => {
    resetSimulation();
    const updatedLinks = links.filter((l) => (
      !((l.from === from && l.to === to) || (l.from === to && l.to === from))
    ));
    setLinks(updatedLinks);
    pushState(nodes, updatedLinks);
    setSimMessage('Connection removed.');
  };

  /* -------- Export / Import -------- */
  const saveCustomTopology = () => {
    const name = window.prompt('Name this topology', 'My network');
    if (!name?.trim()) return;
    const savedTopology = {
      id: `topology-${Date.now()}`,
      name: name.trim(),
      nodes,
      links,
      sourceId,
      destinationId,
      savedAt: new Date().toISOString(),
    };
    const next = [savedTopology, ...customTopologies].slice(0, 12);
    setCustomTopologies(next);
    try {
      localStorage.setItem('netwise.simulator.savedTopologies', JSON.stringify(next));
    } catch {
      setSimMessage('Topology could not be saved to browser storage.');
      return;
    }
    setSimMessage(`Saved topology: ${savedTopology.name}`);
  };

  const loadCustomTopology = (id) => {
    const saved = customTopologies.find((topology) => topology.id === id);
    if (!saved) return;
    resetSimulation();
    setNodes(saved.nodes);
    setLinks(saved.links);
    pushState(saved.nodes, saved.links);
    setSourceId(saved.sourceId);
    setDestinationId(saved.destinationId);
    setSelectedNodeId(saved.sourceId);
    setActiveChallenge(null);
    setSimMessage(`Loaded topology: ${saved.name}`);
  };

  const exportTopology = () => {
    const data = JSON.stringify({ nodes, links, sourceId, destinationId }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netwise-topology-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSimMessage('Topology exported as JSON.');
  };

  const exportPcapJson = () => {
    const pcapFrames = trace.map((evt, idx) => ({
      frameNumber: idx + 1,
      timestamp: (idx * 0.008).toFixed(6),
      nodeId: evt.nodeId,
      title: evt.title,
      srcMac: evt.packetDetails?.frame?.srcMac,
      dstMac: evt.packetDetails?.frame?.dstMac,
      etherType: evt.packetDetails?.frame?.etherType,
      srcIp: evt.packetDetails?.ip?.srcIp,
      dstIp: evt.packetDetails?.ip?.dstIp,
      protocol: evt.packetDetails?.ip?.protocol || evt.packetDetails?.transport?.type,
      length: evt.packetDetails?.frame?.length || '64 bytes',
      info: evt.description,
    }));
    const data = JSON.stringify({ captureSession: 'Netwise Simulated PCAP', frames: pcapFrames }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netwise-capture-${Date.now()}.pcap.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSimMessage('Packet capture exported as PCAP JSON.');
  };

  const exportDiagramSvg = () => {
    const width = 1200;
    const height = 800;
    const linesSvg = links.map(({ from, to, cable }) => {
      const fn = nodes.find((n) => n.id === from);
      const tn = nodes.find((n) => n.id === to);
      if (!fn || !tn) return '';
      const x1 = (fn.x / 100) * width;
      const y1 = (fn.y / 100) * height;
      const x2 = (tn.x / 100) * width;
      const y2 = (tn.y / 100) * height;
      const color = CABLE_TYPES[cable || 'straightThrough']?.color || '#2b6cb0';
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3" stroke-linecap="round" />`;
    }).join('\n');

    const nodesSvg = nodes.map((node) => {
      const cx = (node.x / 100) * width;
      const cy = (node.y / 100) * height;
      return `
        <g transform="translate(${cx}, ${cy})">
          <circle r="26" fill="#ffffff" stroke="#2563eb" stroke-width="2.5" />
          <text y="-32" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#0f172a">${node.name}</text>
          <text y="42" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle" fill="#64748b">${node.ip || node.type}</text>
        </g>
      `;
    }).join('\n');

    const notesSvg = notes.map((note) => {
      const nx = (note.x / 100) * width;
      const ny = (note.y / 100) * height;
      return `
        <g transform="translate(${nx}, ${ny})">
          <rect width="140" height="70" rx="6" fill="#fef08a" stroke="#eab308" stroke-width="1.5" />
          <text x="10" y="24" font-family="system-ui, sans-serif" font-size="11" fill="#713f12">${(note.text || '').replace(/\n/g, ' ')}</text>
        </g>
      `;
    }).join('\n');

    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#f8fafc;">
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#cbd5e1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <text x="30" y="40" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Netwise Network Topology</text>
      <text x="30" y="60" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">Generated by Netwise Educational Simulator</text>
      ${linesSvg}
      ${nodesSvg}
      ${notesSvg}
    </svg>`;

    const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netwise-topology-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setSimMessage('Exported network diagram as SVG.');
  };

  const exportCiscoConfigIos = (node) => {
    if (!node) return;
    const config = generateCiscoConfig(node);
    const blob = new Blob([config], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(node.name || 'device').replace(/\s+/g, '-').toLowerCase()}-running-config.ios`;
    a.click();
    URL.revokeObjectURL(url);
    setSimMessage(`Exported Cisco configuration for ${node.name}.`);
  };

  const importTopology = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.links)) {
          resetSimulation();
          setNodes(parsed.nodes);
          setLinks(parsed.links);
          pushState(parsed.nodes, parsed.links);
          if (parsed.sourceId) setSourceId(parsed.sourceId);
          if (parsed.destinationId) setDestinationId(parsed.destinationId);
          setSelectedNodeId(parsed.nodes[0]?.id ?? 1);
          setSimMessage('Topology loaded successfully.');
        } else {
          setSimMessage('Invalid topology file.');
        }
      } catch {
        setSimMessage('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  /* -------- Terminal Command Execution -------- */
  const executeTerminalCommand = (cmdText) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    const devId = selectedNode.id;
    const mode = terminalModes[devId] || 'user';
    const interfaceName = terminalInterfaces[devId] || '';
    const parts = parseCommandLine(trimmed);
    if (!parts.length) return;
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    const previousHistory = (terminalHistories[devId] || []).filter((entry) => entry !== trimmed);
    const nextHistory = [...previousHistory, trimmed];
    const updatedHistories = { ...terminalHistories, [devId]: nextHistory.slice(-100) };
    setTerminalHistories(updatedHistories);
    setTerminalHistoryPointers((prev) => ({ ...prev, [devId]: -1 }));
    try {
      localStorage.setItem('netwise.terminal.histories', JSON.stringify(updatedHistories));
    } catch {
      /* Storage is optional. */
    }

    const currentLogs = terminalLogs[devId] || [
      `Netwise OS v1.5 [${selectedNode.name} - ${selectedNode.type}]`,
      `Type 'help' for network commands (ping, traceroute, curl, nslookup, ipconfig, arp -a).`,
    ];
    const normalizeLog = (line) => (typeof line === 'string' ? { kind: 'output', text: line } : line);
    let output = [];

    const appendCommand = (lines) => {
      setTerminalLogs((prev) => ({
        ...prev,
        [devId]: [
          ...(prev[devId] || currentLogs),
          { kind: 'command', text: `${terminalPrompt(selectedNode, mode, interfaceName)}${trimmed}` },
          ...lines.map(normalizeLog),
        ],
      }));
    };

    switch (cmd) {
      case 'help':
        output = [
          'Available commands:',
          ...getDeviceCommands(selectedNode, mode).map((command) => `  ${command}`),
          '',
          'Tutorial: try `enable`, `configure terminal`, `interface <name>`, then `ip address <ip>/<prefix>`.',
        ];
        break;

      case 'clear':
        setTerminalLogs((prev) => ({ ...prev, [devId]: [] }));
        setTerminalInput('');
        return;

      case 'enable':
      case 'disable':
      case 'configure':
      case 'interface':
      case 'exit':
      case 'end':
      case 'shutdown':
      case 'no':
      case 'ip':
      case 'set':
      case 'vlan':
      case 'rule':
      case 'access-list': {
        const result = applyTerminalConfiguration({ nodes, nodeId: devId, mode, interfaceName, parts });
        setTerminalModes((prev) => ({ ...prev, [devId]: result.mode }));
        setTerminalInterfaces((prev) => ({ ...prev, [devId]: result.interfaceName }));
        if (result.changed) {
          setNodes(result.nodes);
          pushState(result.nodes, links);
          checkChallengeSolutionForNodes(result.nodes);
        }
        output = result.output;
        break;
      }

      case 'capture':
        if (args[0] === 'start') {
          setIsCapturing(true);
          setShowWireshark(true);
          output = [{ kind: 'success', text: 'Packet capture started. Opening live capture view.' }];
        } else if (args[0] === 'stop') {
          setIsCapturing(false);
          output = [{ kind: 'warning', text: 'Packet capture stopped.' }];
        } else if (args[0] === 'show') {
          setShowWireshark(true);
          output = [{ kind: 'info', text: `Packet capture view opened (${capturedFrames.length} frames).` }];
        } else {
          output = ['Usage: capture start | capture stop | capture show'];
        }
        break;

      case 'show': {
        const topic = args.join(' ').toLowerCase();
        if (topic === 'running-config') {
          output = [
            `! ${selectedNode.name} running configuration`,
            `hostname ${selectedNode.name.replace(/\s+/g, '-')}`,
            ...((selectedNode.interfaces || []).map((intf) => `interface ${intf.name || 'eth0'}\n ip address ${intf.ip || '0.0.0.0'} ${intf.prefixLength || 24}\n ${intf.enabled === false ? 'shutdown' : 'no shutdown'}`)),
            ...(selectedNode.vlans || []).map((vlan) => `vlan ${vlan.id}\n name ${vlan.name}`),
            ...(selectedNode.routes || []).map((route) => `ip route ${route.network} ${route.prefixLength || 24} ${route.nextHop}`),
            ...(selectedNode.rules || []).map((rule) => `access-list ${rule.action} ${rule.targetIp}${rule.port ? ` port ${rule.port}` : ''}`),
          ];
        } else if (topic === 'ip route') {
          output = ['IPv4 Route Table:', 'Network        Prefix  Next Hop'];
          ((selectedNode.routes || []).forEach((route) => output.push(`${route.network.padEnd(14)} ${String(route.prefixLength || 24).padEnd(7)} ${route.nextHop}`)));
        } else if (topic === 'vlan') {
          output = ['VLAN   Name', ...((selectedNode.vlans || []).map((vlan) => `${String(vlan.id).padEnd(6)} ${vlan.name}`))];
          if (!selectedNode.vlans?.length) output.push('No VLANs configured.');
        } else if (topic === 'mac-address-table') {
          output = ['Vlan  Mac Address          Type    Ports'];
          nodes.filter((node) => node.id !== devId && node.mac).slice(0, 8).forEach((node, index) => output.push(`1     ${node.mac.padEnd(20)} dynamic Fa0/${index + 1}`));
        } else if (topic === 'ip interface brief') {
          output = ['Interface        IP Address      Status'];
          (selectedNode.interfaces || []).forEach((intf) => output.push(`${(intf.name || 'eth0').padEnd(16)} ${(intf.ip || 'unassigned').padEnd(15)} ${intf.enabled === false ? 'down' : 'up'}`));
        } else if (topic === 'access-list' || topic === 'rules') {
          output = ['Firewall rules:', ...((selectedNode.rules || []).map((rule, index) => `${index + 1} ${rule.action} ${rule.targetIp}${rule.port ? ` port ${rule.port}` : ''}`))];
          if (!selectedNode.rules?.length) output.push('No firewall rules configured.');
        } else {
          output = [`Unrecognized show command: show ${topic || ''}`];
        }
        break;
      }

      case 'ipconfig':
      case 'ifconfig':
        if (args[0]?.toLowerCase() === '/renew') {
          const lease = simulateDhcpLease(nodes, links, selectedNode.id);
          if (lease.success) {
            updateSelectedNode('ip', lease.offeredIp);
            updateSelectedNode('prefixLength', lease.prefixLength);
            updateSelectedNode('gateway', lease.gateway);
            output = [
              { kind: 'info', text: `Renewing IP address for ${selectedNode.name} via DHCP...` },
              { kind: 'success', text: `Lease Granted: ${lease.offeredIp}/${lease.prefixLength}, gateway ${lease.gateway}, DNS ${lease.dns}` },
            ];
            checkChallengeSolutionForNodes(nodes.map((node) => node.id === devId ? { ...node, ip: lease.offeredIp, prefixLength: lease.prefixLength, gateway: lease.gateway } : node));
          } else {
            output = [{ kind: 'error', text: `DHCP renew failed: ${lease.error}` }];
          }
        } else if (args[0]?.toLowerCase() === '/release') {
          const released = nodes.map((node) => node.id === devId ? { ...node, ip: '0.0.0.0', gateway: '' } : node);
          setNodes(released);
          pushState(released, links);
          output = [{ kind: 'warning', text: `Released IP lease for ${selectedNode.name}.` }];
        } else {
          output = [
            `Interface Configuration for ${selectedNode.name}`,
            `  Host Type:       ${selectedNode.type}`,
            `  Primary MAC:     ${selectedNode.mac || '02:00:00:00:00:01'}`,
            `  IPv4 Address:    ${selectedNode.ip || 'Unassigned'}`,
            `  Subnet Mask:     /${selectedNode.prefixLength ?? 24}`,
            `  Default Gateway: ${selectedNode.gateway || 'None'}`,
          ];
          if (selectedNode.interfaces?.length) {
            selectedNode.interfaces.forEach((intf, idx) => {
              output.push(`  Interface ${intf.name || `eth${idx}`}: IP ${intf.ip || 'None'}/${intf.prefixLength ?? 24} (MAC: ${intf.mac})`);
            });
          }
        }
        break;

      case 'nslookup': {
        if (!args[0]) {
          output = ['Usage: nslookup <domain-name> (e.g. nslookup example.com)'];
          break;
        }
        const dnsRes = simulateDnsQuery(nodes, links, selectedNode.id, args[0]);
        if (dnsRes.success) {
          output = [
            { kind: 'info', text: 'Non-authoritative DNS answer:' },
            { kind: 'success', text: `Name: ${args[0]}  Address: ${dnsRes.resolvedIp}` },
          ];
        } else {
          output = [{ kind: 'error', text: `** server can't find ${args[0]}: NXDOMAIN` }];
        }
        break;
      }

      case 'curl': {
        if (!args[0]) {
          output = ['Usage: curl <url-or-domain> (e.g. curl example.com or curl 93.184.216.34)'];
          break;
        }
        let targetIp = args[0].replace(/^https?:\/\//, '').split('/')[0];
        if (!targetIp.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          const resolved = resolveDns(targetIp);
          if (!resolved) {
            output = [{ kind: 'error', text: `curl: Could not resolve host: ${targetIp}` }];
            break;
          }
          targetIp = resolved;
        }
        const targetNode = nodes.find((n) => n.ip === targetIp || n.interfaces?.some((i) => i.ip === targetIp));
        if (!targetNode) {
          output = [{ kind: 'error', text: `curl: Failed to connect to ${targetIp}: timed out` }];
          break;
        }
        const sim = simulatePacket({
          nodes,
          links,
          sourceId: selectedNode.id,
          destinationId: targetNode.id,
          protocol: 'TCP',
          twoWay: true,
        });
        if (sim.error) {
          output = [{ kind: 'error', text: `curl: Connection failed: ${sim.error}` }];
        } else {
          output = [
            { kind: 'success', text: `HTTP/1.1 200 OK — Connected to ${targetNode.name} (${targetIp})` },
            { kind: 'output', text: `<h1>Hello from ${targetNode.name}!</h1>` },
          ];
        }
        break;
      }

      case 'arp':
        output = [
          `ARP Table for ${selectedNode.name}:`,
          `  Internet Address      Physical Address      Type`,
        ];
        if (selectedNode.gateway) {
          const gw = nodes.find((n) => n.interfaces?.some((i) => i.ip === selectedNode.gateway) || n.ip === selectedNode.gateway);
          output.push(`  ${selectedNode.gateway.padEnd(20)}  ${(gw?.mac || '02:00:00:00:00:21').padEnd(20)}  dynamic`);
        }
        nodes.filter((n) => n.id !== selectedNode.id && n.ip).slice(0, 4).forEach((n) => {
          output.push(`  ${n.ip.padEnd(20)}  ${(n.mac || 'AA:BB:CC:00:00:01').padEnd(20)}  dynamic`);
        });
        break;

      case 'route':
        if (args[0]?.toLowerCase() === 'add') {
          const result = applyTerminalConfiguration({ nodes, nodeId: devId, mode, interfaceName, parts });
          setTerminalModes((prev) => ({ ...prev, [devId]: result.mode }));
          setTerminalInterfaces((prev) => ({ ...prev, [devId]: result.interfaceName }));
          if (result.changed) {
            setNodes(result.nodes);
            pushState(result.nodes, links);
            checkChallengeSolutionForNodes(result.nodes);
          }
          output = result.output;
          break;
        }
        output = [
          `IPv4 Routing Table for ${selectedNode.name}:`,
          `  Network Destination   Netmask          Gateway          Interface`,
        ];
        if (selectedNode.gateway) {
          output.push(`  0.0.0.0               0.0.0.0          ${selectedNode.gateway.padEnd(15)}  ${selectedNode.ip || '192.168.1.4'}`);
        }
        if (selectedNode.ip) {
          output.push(`  ${selectedNode.ip.replace(/\.\d+$/, '.0').padEnd(20)}  255.255.255.0    On-link          ${selectedNode.ip}`);
        }
        (selectedNode.routes || []).forEach((route) => {
          output.push(`  ${route.network.padEnd(20)}  ${route.prefixLength === 24 ? '255.255.255.0' : `/${route.prefixLength}`}  ${route.nextHop.padEnd(15)}  configured`);
        });
        break;

      case 'nat':
        output = [
          `NAT/PAT Translation Table:`,
          `  Protocol   Inside Global          Inside Local           Outside Local`,
          `  tcp        93.184.216.1:40001     192.168.1.4:51234      93.184.216.34:80`,
          `  icmp       93.184.216.1:1002      192.168.1.4:1002       93.184.216.34:1002`,
        ];
        break;

      case 'ping': {
        if (!args[0]) {
          output = ['Usage: ping <destination-ip>'];
          break;
        }
        const target = nodes.find((n) => n.ip === args[0] || n.interfaces?.some((i) => i.ip === args[0]));
        if (!target) {
          output = [
            { kind: 'error', text: `Pinging ${args[0]}: Request timed out (4/4 lost).` },
          ];
          break;
        }
        const sim = simulatePacket({ nodes, links, sourceId: selectedNode.id, destinationId: target.id, twoWay: true });
        if (sim.error) {
          output = [
            { kind: 'error', text: `Destination host unreachable: ${sim.error}` },
          ];
        } else {
          output = [
            { kind: 'success', text: `Reply from ${args[0]}: bytes=32 time=22ms TTL=7` },
            { kind: 'success', text: `Ping statistics: Sent=4 Received=4 Lost=0 (0% loss)` },
          ];
        }
        break;
      }

      case 'tracert':
      case 'traceroute': {
        if (!args[0]) {
          output = ['Usage: traceroute <destination-ip>'];
          break;
        }
        const target = nodes.find((n) => n.ip === args[0] || n.interfaces?.some((i) => i.ip === args[0]));
        if (!target) {
          output = [{ kind: 'error', text: `Tracing route to ${args[0]}: Request timed out.` }];
          break;
        }
        const sim = simulatePacket({ nodes, links, sourceId: selectedNode.id, destinationId: target.id });
        if (sim.error) {
          output = [{ kind: 'error', text: `Tracing route to ${args[0]}: ${sim.error}` }];
        } else {
          output = [{ kind: 'info', text: `Tracing route to ${target.name} [${args[0]}]` }];
          const visitedHops = [...new Set(sim.events.map((e) => e.nodeId))];
          visitedHops.forEach((hId, idx) => {
            const hNode = nodes.find((n) => n.id === hId);
            output.push({ kind: 'output', text: ` ${idx + 1}  ${hNode?.name || 'Hop'} [${hNode?.ip || '192.168.1.1'}]  ${(idx + 1) * 8} ms` });
          });
          output.push({ kind: 'success', text: 'Trace complete.' });
        }
        break;
      }

      default: {
        const suggestion = suggestCommand(cmd, getDeviceCommands(selectedNode, mode));
        output = [{ kind: 'error', text: `% Unknown command '${cmd}'.${suggestion ? ` Did you mean '${suggestion}'?` : " Type 'help' for commands."}` }];
      }
    }

    appendCommand(output);
    setTerminalInput('');
  };

  const terminalLogText = (terminalLogs[selectedNode?.id] || [])
    .map((line) => (typeof line === 'string' ? line : line.text))
    .join('\n');

  const copyTerminalOutput = async () => {
    const text = terminalLogText;
    try {
      await navigator.clipboard.writeText(text);
      setSimMessage('Terminal output copied.');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setSimMessage('Terminal output copied.');
    }
  };

  const downloadTerminalOutput = () => {
    const blob = new Blob([terminalLogText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `netwise-${selectedNode.name.replace(/\s+/g, '-').toLowerCase()}-terminal.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearTerminalOutput = () => {
    setTerminalLogs((prev) => ({ ...prev, [selectedNode.id]: [] }));
  };

  const resetTerminalDevice = () => {
    setTerminalLogs((prev) => ({
      ...prev, [selectedNode.id]: [
        `Netwise OS v1.5 [${selectedNode.name} - ${selectedNode.type}]`,
        'Terminal reset. Type `help` to begin.',
      ]
    }));
    setTerminalModes((prev) => ({ ...prev, [selectedNode.id]: 'user' }));
    setTerminalInterfaces((prev) => ({ ...prev, [selectedNode.id]: '' }));
    setTerminalInput('');
  };

  const renderTerminalText = (text) => {
    const parts = String(text).split(/((?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?)/g);
    return parts.map((part, index) => {
      if (/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(part)) {
        const ip = part.split('/')[0];
        return (
          <button
            type="button"
            key={`${part}-${index}`}
            className="terminal-address-link"
            title={`Use ${part}`}
            onClick={() => setTerminalInput((value) => value.trim() ? value : `ping ${ip}`)}
          >
            {part}
          </button>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  /* -------- Challenge Verification -------- */
  const checkChallengeSolutionForNodes = (candidateNodes) => {
    if (!activeChallenge) return;
    const res = activeChallenge.verify(candidateNodes, links);
    if (res.ok) {
      setChallengeSolvedMsg(`🎉 Congratulations! Challenge Solved: ${res.msg}`);
      setChallengeErrorMsg('');
      setChallengeHintVisible(false);
      playPingSuccess();
      try {
        const raw = window.localStorage.getItem('netwise.challenges.solved');
        const list = raw ? JSON.parse(raw) : [];
        if (!list.includes(activeChallenge.id)) {
          window.localStorage.setItem('netwise.challenges.solved', JSON.stringify([...list, activeChallenge.id]));
        }
        const profile = markChallengeSolved(loadProfile(), activeChallenge.id);
        saveProfile(profile);
      } catch {
        /* ignore */
      }
    } else {
      setChallengeErrorMsg(`❌ ${res.msg}`);
      setChallengeSolvedMsg('');
      setChallengeHintVisible(true);
      const profile = recordChallengeAttempt(loadProfile(), activeChallenge.id);
      saveProfile(profile);
      playPacketDrop();
    }
  };

  const checkChallengeSolution = () => checkChallengeSolutionForNodes(nodes);

  /* -------- Traffic Simulation Control -------- */
  const startTraffic = () => {
    if (sourceId === destinationId) {
      setSimMessage('Choose different devices for source and destination.');
      return;
    }
    const src = nodes.find((n) => n.id === sourceId);
    const dst = nodes.find((n) => n.id === destinationId);
    if (src?.type === 'Switch' || dst?.type === 'Switch') {
      setSimMessage('A switch cannot be a traffic source or destination.');
      return;
    }
    setCurrentHop(0);
    setIsPaused(false);
    setIsRunning(true);
    setSimMessage('');
  };

  const nextHop = () => {
    if (!isRunning) startTraffic();
    else setCurrentHop((hop) => Math.min(hop + 1, trace.length - 1));
  };

  const prevHop = () => {
    setCurrentHop((hop) => Math.max(hop - 1, 0));
  };

  const stopTraffic = () => {
    setIsRunning(false);
    setCurrentHop(0);
    setIsPaused(false);
  };

  const actionsRef = useRef({});
  useEffect(() => {
    actionsRef.current = {
      isRunning,
      selectedNodeId,
      nodes,
      undo: handleUndo,
      redo: handleRedo,
      runTraffic: startTraffic,
      removeNode: deleteNode,
      togglePause: () => setIsPaused((p) => !p),
    };
  });

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const {
        isRunning: running,
        selectedNodeId: selId,
        nodes: currentNodes,
        undo,
        redo,
        runTraffic,
        removeNode,
        togglePause,
      } = actionsRef.current;

      if (e.code === 'Space') {
        e.preventDefault();
        if (running) {
          togglePause?.();
        } else {
          runTraffic?.();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo?.();
        else undo?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo?.();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selId && currentNodes?.length > 1) {
          removeNode?.(selId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateSelectedNode = (field, value) => {
    const updated = nodes.map((node) => {
      if (node.id !== selectedNodeId) return node;
      const updatedNode = { ...node, [field]: value };
      if (field === 'ip') {
        if (node.interfaces?.length) {
          updatedNode.interfaces = node.interfaces.map((intf, index) => (
            index === 0 ? { ...intf, ip: value } : intf
          ));
        }
      }
      return updatedNode;
    });
    setNodes(updated);
    pushState(updated, links);
  };

  const updateInterface = (index, field, value) => {
    const updated = nodes.map((node) => {
      if (node.id !== selectedNodeId) return node;
      const interfaces = (node.interfaces || []).map((intf, i) => (
        i === index ? { ...intf, [field]: value } : intf
      ));
      return { ...node, interfaces };
    });
    setNodes(updated);
    pushState(updated, links);
  };

  const resetNetwork = () => {
    resetSimulation();
    setNodes(initialNodes);
    setLinks(initialLinks);
    pushState(initialNodes, initialLinks);
    setNextNodeId(9);
    setSelectedNodeId(1);
    setSourceId(1);
    setDestinationId(4);
    setConnectMode(false);
    setConnectFromId(null);
    setView({ x: 0, y: 0, scale: 1 });
    setTerminalLogs({});
    setTerminalModes({});
    setTerminalInterfaces({});
    setActiveChallenge(null);
    setChallengeSolvedMsg('');
    setChallengeErrorMsg('');
    setSimMessage('Network reset.');
  };

  const handleSelectSource = (event) => {
    resetSimulation();
    setSimMessage('');
    setSourceId(Number(event.target.value));
  };

  const handleSelectDestination = (event) => {
    resetSimulation();
    setSimMessage('');
    setDestinationId(Number(event.target.value));
  };

  /* Filtered packet capture frames */
  const capturedFrames = trace.map((evt, idx) => ({
    num: idx + 1,
    time: (idx * 0.012).toFixed(3),
    src: evt.packetDetails?.ip?.srcIp || evt.packetDetails?.frame?.srcMac || '0.0.0.0',
    dst: evt.packetDetails?.ip?.dstIp || evt.packetDetails?.frame?.dstMac || '0.0.0.0',
    protocol: evt.packetDetails?.transport?.type || (evt.packetDetails?.frame?.isArp ? 'ARP' : 'IPv4'),
    length: evt.packetDetails?.frame?.length || '64',
    info: evt.title + ' — ' + evt.description,
    nodeId: evt.nodeId,
  })).filter((f) => {
    if (!packetFilter.trim()) return true;
    const q = packetFilter.toLowerCase();
    return f.protocol.toLowerCase().includes(q) || f.src.includes(q) || f.dst.includes(q) || f.info.toLowerCase().includes(q);
  });

  /* -------- Render -------- */
  return (
    <section className="page-shell simulator-page">
      {/* Top Challenge Alert Banner */}
      {activeChallenge && (
        <div className="challenge-simulator-banner">
          <div className="ch-banner-content">
            <span className="ch-banner-tag">CHALLENGE {activeChallenge.level}</span>
            <h3>{activeChallenge.title}</h3>
            <p>{activeChallenge.brief}</p>
          </div>
          <div className="ch-banner-actions">
            <button className="button button-primary ch-check-btn" type="button" onClick={checkChallengeSolution}>
              ✓ Verify Solution
            </button>
            <a className="button button-secondary" href="/challenges">
              Exit Lab
            </a>
          </div>
        </div>
      )}

      {activeChallenge && challengeHintVisible && (
        <div className="challenge-banner-feedback feedback-hint" role="status">
          <strong>Targeted hint:</strong> {activeChallenge.hint}
        </div>
      )}

      {challengeSolvedMsg && (
        <div className="challenge-banner-feedback feedback-success">
          {challengeSolvedMsg}
        </div>
      )}
      {challengeErrorMsg && (
        <div className="challenge-banner-feedback feedback-error">
          {challengeErrorMsg}
        </div>
      )}

      <div className="simulator-actions" role="toolbar" aria-label="Topology controls">
        <div className="sim-actions">
          {/* Preset Topologies Selector */}
          <select
            className="preset-select"
            onChange={(e) => handleLoadPreset(e.target.value)}
            defaultValue=""
            aria-label="Load preset topology"
          >
            <option value="" disabled>📁 Topologies...</option>
            {Object.entries(TOPOLOGY_PRESETS).map(([k, p]) => (
              <option key={k} value={k}>{p.name}</option>
            ))}
          </select>

          {customTopologies.length > 0 && (
            <select
              className="preset-select"
              onChange={(e) => {
                loadCustomTopology(e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
              aria-label="Load saved topology"
            >
              <option value="" disabled>Saved networks...</option>
              {customTopologies.map((topology) => (
                <option key={topology.id} value={topology.id}>{topology.name}</option>
              ))}
            </select>
          )}

          <button
            className="button button-secondary"
            type="button"
            onClick={saveCustomTopology}
            title="Save this topology in your browser"
          >
            Save
          </button>

          <button
            className="button button-secondary"
            type="button"
            onClick={() => setCatalogOpen(true)}
            disabled={nodes.length >= initialNodes.length + nodePositions.length + 5}
            title="Browse device catalog"
          >
            ☰ Catalog
          </button>
          <button
            className={`button ${connectMode ? 'button-primary is-connect-active' : 'button-secondary'}`}
            type="button"
            onClick={() => {
              setConnectMode((enabled) => !enabled);
              setConnectFromId(null);
              setSimMessage(connectMode ? '' : 'Choose two devices on the canvas to connect them.');
            }}
            aria-pressed={connectMode}
          >
            {connectMode ? 'Select devices…' : '＋ Connect'}
          </button>

          {/* Undo / Redo */}
          <button
            className="button button-secondary"
            type="button"
            onClick={handleUndo}
            disabled={historyIdx <= 0}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={handleRedo}
            disabled={historyIdx >= history.length - 1}
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>

          {/* Auto Layout */}
          <button
            className="button button-secondary"
            type="button"
            onClick={handleAutoLayout}
            title="Auto organize canvas by network tier"
          >
            ⚡ Auto Layout
          </button>

          {/* Wireshark Panel Toggle */}
          <button
            className={`button ${showWireshark ? 'button-primary' : 'button-secondary'}`}
            type="button"
            onClick={() => setShowWireshark((w) => !w)}
            title="Toggle Wireshark-Lite Packet Capture"
          >
            🦈 Packet Capture
          </button>

          {/* Sound toggle */}
          <button
            className="button button-secondary sound-toggle-btn"
            type="button"
            onClick={() => setSoundOn(toggleSound())}
            title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
            aria-label={soundOn ? 'Mute audio' : 'Enable audio'}
          >
            {soundOn ? '🔊 Audio' : '🔇 Muted'}
          </button>

          <button className="button button-secondary" type="button" onClick={exportTopology} title="Export topology as JSON">
            Export JSON
          </button>
          <button className="button button-secondary" type="button" onClick={exportDiagramSvg} title="Export topology as SVG diagram">
            📷 Diagram
          </button>
          <button className="button button-secondary" type="button" onClick={() => setLabBuilderOpen(true)} title="Open Custom Lab Scenario Builder">
            🛠️ Lab Builder
          </button>
          <button className="button button-secondary" type="button" onClick={() => setTourOpen(true)} title="Start guided onboarding walkthrough">
            ❓ Tour
          </button>
          <label className="button button-secondary file-upload-btn" title="Import topology from JSON">
            Import JSON
            <input type="file" accept=".json" onChange={importTopology} style={{ display: 'none' }} />
          </label>

          <button className="button button-secondary reset-button" type="button" onClick={resetNetwork}>
            Reset
          </button>
        </div>
      </div>

      <div className="simulator-workspace">
        <div className="simulator-main-column">
          <section
            ref={canvasRef}
            className={`simulator-card network-canvas${connectMode ? ' connect-mode' : ''}${pan ? ' is-panning' : ''}`}
            aria-label="Interactive network canvas"
            onClick={handleCanvasClick}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const type = e.dataTransfer.getData('text/plain');
              if (type) {
                const point = toCanvasPercent(e.clientX, e.clientY);
                addNodeOfType(type, point);
              }
            }}
          >
            <div className="canvas-header">
              <span className="canvas-tag">INTERACTIVE TOPOLOGY</span>
              {simMessage && <span className="canvas-status" role="status">{simMessage}</span>}
            </div>

            <div className="canvas-controls" aria-label="Canvas controls">
              <button type="button" onClick={addNote} aria-label="Add sticky note" title="Add Sticky Note to canvas">📝 +Note</button>
              <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in">+</button>
              <span aria-live="polite">{Math.round(view.scale * 100)}%</span>
              <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out">−</button>
              <button type="button" onClick={() => setView({ x: 0, y: 0, scale: 1 })} aria-label="Reset canvas view" title="Reset view">↺</button>
            </div>

            <div className="canvas-view" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
              <svg className="connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {/* Subnet Broadcast Domain Visual Clouds */}
                <g className="subnet-clouds-group">
                  {subnetGroups.map((sg) => (
                    <g key={sg.subnetId}>
                      <rect
                        x={sg.x}
                        y={sg.y}
                        width={sg.width}
                        height={sg.height}
                        rx="4"
                        className="subnet-boundary-cloud"
                      />
                      <text
                        x={sg.x + 1.5}
                        y={sg.y + 3}
                        className="subnet-cloud-text"
                        fontSize="2.2"
                      >
                        Subnet {sg.subnetId}
                      </text>
                    </g>
                  ))}
                </g>

                {links.map(({ from, to, cable }) => {
                  const fromNode = nodes.find((node) => node.id === from);
                  const toNode = nodes.find((node) => node.id === to);
                  if (!fromNode || !toNode) return null;

                  const isActiveLink = isRunning && currentEvent?.fromId != null && (
                    (currentEvent?.fromId === from && currentEvent?.nodeId === to) ||
                    (currentEvent?.fromId === to && currentEvent?.nodeId === from)
                  );
                  const mx = (fromNode.x + toNode.x) / 2;
                  const my = (fromNode.y + toNode.y) / 2;
                  const cableType = cable || 'straightThrough';
                  const cableDef = CABLE_TYPES[cableType] || CABLE_TYPES.straightThrough;
                  const cableDash = {
                    wireless: '1.4 1.1',
                    serial: '2.8 1.2',
                    console: '1 1',
                  }[cableType];

                  // LED & STP status calculations
                  const mismatchErr = validateCable(fromNode, toNode, cableType);
                  const linkKey = `${Math.min(from, to)}-${Math.max(from, to)}`;
                  const isStpBlocking = stpState.linkStates?.[linkKey] === 'blocking';
                  const isStpForwarding = stpState.linkStates?.[linkKey] === 'forwarding';
                  const ledColor = mismatchErr ? '#ef4444' : isStpBlocking ? '#f59e0b' : '#22c55e';
                  const ledTitle = mismatchErr
                    ? 'Cable Mismatch'
                    : isStpBlocking
                      ? 'STP: Blocking (Loop Avoidance)'
                      : isStpForwarding
                        ? 'STP: Forwarding'
                        : 'Link Connected';

                  return (
                    <g key={`${from}-${to}`} className={isActiveLink ? 'link-active' : ''}>
                      <line
                        x1={fromNode.x} y1={fromNode.y}
                        x2={toNode.x} y2={toNode.y}
                        className="link-hit"
                      />
                      <line
                        x1={fromNode.x} y1={fromNode.y}
                        x2={toNode.x} y2={toNode.y}
                        className={`connection-line${isActiveLink ? ' is-active' : ''}${isStpBlocking ? ' is-blocking' : ''}`}
                        stroke={isActiveLink ? '#10b981' : isStpBlocking ? '#f59e0b' : cableDef.color}
                        strokeWidth={isActiveLink ? '0.95' : isStpBlocking ? '0.6' : '0.65'}
                        strokeDasharray={isStpBlocking ? '1.5 1.5' : cableDash}
                        strokeLinecap="round"
                      />

                      {/* Port Link Status LEDs */}
                      <circle
                        cx={fromNode.x + (toNode.x - fromNode.x) * 0.12}
                        cy={fromNode.y + (toNode.y - fromNode.y) * 0.12}
                        r={isStpBlocking ? '1.0' : '0.8'}
                        fill={ledColor}
                        className={`link-led${isStpBlocking ? ' is-blocking' : ''}`}
                      >
                        <title>{ledTitle}</title>
                      </circle>
                      <circle
                        cx={toNode.x + (fromNode.x - toNode.x) * 0.12}
                        cy={toNode.y + (fromNode.y - toNode.y) * 0.12}
                        r={isStpBlocking ? '1.0' : '0.8'}
                        fill={ledColor}
                        className={`link-led${isStpBlocking ? ' is-blocking' : ''}`}
                      >
                        <title>{ledTitle}</title>
                      </circle>

                      {isStpBlocking && (
                        <g transform={`translate(${mx}, ${my - 1.8})`}>
                          <rect x="-6" y="-1.8" width="12" height="3.6" rx="1.8" fill="#78350f" fillOpacity="0.85" />
                          <text x="0" y="0.8" fill="#fef3c7" fontSize="1.8" fontWeight="bold" textAnchor="middle">STP BLK</text>
                        </g>
                      )}

                      {/* Animated traveling wire packet pulse */}
                      {isActiveLink && (
                        <circle
                          cx={mx}
                          cy={my}
                          r="1.4"
                          fill="#10b981"
                          className="wire-packet-pulse"
                        />
                      )}

                      {!isRunning && (
                        <g
                          className="link-delete"
                          transform={`translate(${mx}, ${my})`}
                          onClick={(e) => { e.stopPropagation(); deleteLink(from, to); }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              deleteLink(from, to);
                            }
                          }}
                          role="button"
                          aria-label={`Remove ${cableDef.label} between ${fromNode.name} and ${toNode.name}`}
                          tabIndex={0}
                        >
                          <circle r="2.2" />
                          <line x1="-1" y1="-1" x2="1" y2="1" stroke="#fff" strokeWidth="0.5" />
                          <line x1="1" y1="-1" x2="-1" y2="1" stroke="#fff" strokeWidth="0.5" />
                        </g>
                      )}
                    </g>
                  );
                })}

                {linkDrag && nodes.find((n) => n.id === linkDrag.fromId) && (
                  <line
                    className="link-rubber"
                    x1={nodes.find((n) => n.id === linkDrag.fromId).x}
                    y1={nodes.find((n) => n.id === linkDrag.fromId).y}
                    x2={linkDrag.currentX}
                    y2={linkDrag.currentY}
                  />
                )}
              </svg>

              {nodes.map((node) => {
                const isCurrent = isRunning && currentEvent?.nodeId === node.id;
                const isVisited = isRunning && trace.slice(0, currentHop).some((event) => event.nodeId === node.id);
                const isSelected = selectedNodeId === node.id;
                const isDragging = drag?.nodeId === node.id && drag.moved;

                return (
                  <button
                    className={`network-node node-${node.type.toLowerCase()}${isCurrent ? ' is-current' : ''}${isVisited ? ' is-visited' : ''}${isSelected ? ' is-selected' : ''}${connectFromId === node.id ? ' connect-source' : ''}${isDragging ? ' is-dragging' : ''}`}
                    key={node.id}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (connectMode) handleNodeClickForConnect(node.id);
                      else setSelectedNodeId(node.id);
                    }}
                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                    aria-label={`${node.name}, ${node.type}, IP ${node.ip || 'unassigned'}${isSelected ? ', selected' : ''}`}
                    aria-pressed={isSelected}
                  >
                    <span className="node-symbol"><DeviceIcon type={node.type} /></span>
                    <span className="node-name">{node.name}</span>
                    <span className="node-type">{node.ip || node.type}</span>
                    {isCurrent && <span className="node-pulse" aria-hidden="true" />}
                  </button>
                );
              })}

              {isRunning && currentNode && (
                <span
                  className={`packet${isDelivered ? ' packet-delivered' : ''}`}
                  style={{ left: `${currentNode.x}%`, top: `${currentNode.y}%` }}
                  aria-label={isDelivered ? 'Packet delivered' : 'Packet in transit'}
                />
              )}

              {/* Canvas Sticky Notes */}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`canvas-note color-${note.color || 'yellow'}`}
                  style={{ left: `${note.x}%`, top: `${note.y}%` }}
                  onPointerDown={(e) => handleNotePointerDown(e, note)}
                >
                  <div className="note-header">
                    <div className="note-colors">
                      {['yellow', 'blue', 'green', 'pink', 'purple'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`note-color-dot ${c}${note.color === c ? ' is-active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateNote(note.id, 'color', c);
                          }}
                          aria-label={`Change note color to ${c}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="note-del-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      title="Delete note"
                      aria-label="Delete note"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    className="note-textarea"
                    value={note.text}
                    onChange={(e) => updateNote(note.id, 'text', e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="Note or subnet..."
                    rows={2}
                  />
                </div>
              ))}
            </div>

            <div className="canvas-hint" aria-hidden="true">
              <span aria-live="polite">
                {connectMode
                  ? 'Connect mode active: Click first device, then second device'
                  : 'Drag nodes to reposition • Shift+Drag from node to connect • Scroll to zoom'}
              </span>
            </div>
          </section>

          {/* Packet Tracer Bottom Equipment Shelf */}
          <section className="pt-bottom-device-shelf" aria-label="Packet Tracer Equipment Shelf">
            <div className="shelf-header">
              <div className="shelf-tabs">
                {SHELF_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`shelf-tab-btn ${activeShelfCategory === cat.id ? 'is-active' : ''}`}
                    onClick={() => setActiveShelfCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="shelf-header-actions">
                <span className="shelf-drag-hint">💡 Drag onto canvas or click to add</span>
                <button
                  type="button"
                  className="shelf-collapse-toggle"
                  onClick={() => setShelfCollapsed((c) => !c)}
                  title={shelfCollapsed ? 'Expand equipment shelf' : 'Collapse equipment shelf'}
                >
                  {shelfCollapsed ? '▲ Show Equipment Shelf' : '▼ Hide Shelf'}
                </button>
              </div>
            </div>

            {!shelfCollapsed && (
              <div className="shelf-body">
                <div className="shelf-items-rack">
                  {/* If not cables, show devices */}
                  {activeShelfCategory !== 'cables' && (
                    <>
                      {getFilteredDevices(activeShelfCategory).map((type) => (
                        <div
                          key={type}
                          className="shelf-device-card"
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', type);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => addNodeOfType(type)}
                          title={`Click or drag ${type} to canvas`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              addNodeOfType(type);
                            }
                          }}
                        >
                          <span className="shelf-icon"><DeviceIcon type={type} /></span>
                          <span className="shelf-name">{type}</span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* If cables or all, show cables */}
                  {(activeShelfCategory === 'cables' || activeShelfCategory === 'all') && (
                    <>
                      {Object.values(CABLE_TYPES).map((cable) => (
                        <div
                          key={cable.id}
                          className={`shelf-device-card shelf-cable-card ${connectMode && pendingCable === cable.id ? 'is-active' : ''}`}
                          onClick={() => startConnectModeWithCable(cable.id)}
                          title={`${cable.label} - ${cable.description}. Click to activate Connect Mode.`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              startConnectModeWithCable(cable.id);
                            }
                          }}
                        >
                          <span className="shelf-icon cable-icon" style={{ borderColor: cable.color }}>
                            ⚡
                          </span>
                          <span className="shelf-name">{cable.label.split(' ')[0]}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Wireshark-Lite Live Packet Capture Drawer */}
          {showWireshark && (
            <section className="simulator-card wireshark-panel" aria-label="Packet Capture Log">
              <div className="wireshark-header">
                <div className="wireshark-title-group">
                  <span className="wireshark-badge">PCAP</span>
                  <h4>Wireshark-Lite Live Packet Capture</h4>
                  <span className="pcap-count">({capturedFrames.length} frames)</span>
                </div>
                <div className="wireshark-controls">
                  <input
                    type="text"
                    className="pcap-filter-input"
                    placeholder="Filter packets (e.g. ARP, ICMP, TCP, IP)..."
                    value={packetFilter}
                    onChange={(e) => setPacketFilter(e.target.value)}
                  />
                  <button
                    type="button"
                    className="button button-secondary pcap-btn"
                    onClick={() => setIsCapturing(true)}
                  >
                    {isCapturing ? '● Capturing' : 'Start capture'}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary pcap-btn"
                    onClick={() => setIsCapturing(false)}
                    disabled={!isCapturing}
                  >
                    Stop
                  </button>
                  <button type="button" className="button button-secondary pcap-btn" onClick={exportPcapJson}>
                    💾 Export PCAP JSON
                  </button>
                  <button type="button" className="pcap-close-btn" onClick={() => setShowWireshark(false)}>
                    ×
                  </button>
                </div>
              </div>

              <div className="wireshark-table-wrapper">
                <table className="wireshark-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Time</th>
                      <th>Source</th>
                      <th>Destination</th>
                      <th>Protocol</th>
                      <th>Length</th>
                      <th>Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capturedFrames.map((frame, idx) => {
                      const isSelectedHop = isRunning && currentHop === idx;
                      return (
                        <tr
                          key={idx}
                          className={`${isSelectedHop ? 'is-selected-frame' : ''} proto-${frame.protocol.toLowerCase()}`}
                          onClick={() => {
                            if (!isRunning) startTraffic();
                            setCurrentHop(idx);
                          }}
                        >
                          <td>{frame.num}</td>
                          <td>{frame.time}s</td>
                          <td><code>{frame.src}</code></td>
                          <td><code>{frame.dst}</code></td>
                          <td><span className="proto-pill">{frame.protocol}</span></td>
                          <td>{frame.length}</td>
                          <td>{frame.info}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Simulation Controls Card */}
          <section className="simulator-card traffic-generator" aria-label="Packet generator">
            <div className="simulator-card-heading">
              <div>
                <p className="section-kicker">TRAFFIC FLOW & PROTOCOL SIMULATOR</p>
                <h2>Send Traffic</h2>
              </div>
            </div>

            <div className="traffic-inputs">
              <label>
                Source device
                <select value={sourceId} onChange={handleSelectSource} disabled={isRunning}>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id} disabled={node.type === 'Switch'}>
                      {node.name} ({node.ip || node.type})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Destination device
                <select value={destinationId} onChange={handleSelectDestination} disabled={isRunning}>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id} disabled={node.type === 'Switch'}>
                      {node.name} ({node.ip || node.type})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Protocol
                <select
                  value={simProtocol}
                  onChange={(e) => {
                    resetSimulation();
                    setSimProtocol(e.target.value);
                  }}
                  disabled={isRunning}
                >
                  <option value="ICMP">ICMP Echo (Ping)</option>
                  <option value="TCP">TCP Stream (HTTP port 80)</option>
                </select>
              </label>

              <div className="two-way-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={isTwoWay}
                    onChange={(e) => {
                      resetSimulation();
                      setIsTwoWay(e.target.checked);
                    }}
                    disabled={isRunning}
                  />
                  <span>Round-Trip (Echo Reply / ACK)</span>
                </label>
              </div>

              <div className="speed-control">
                <label htmlFor="speed-select">Speed:</label>
                <select
                  id="speed-select"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value={0.5}>0.5x (Slow)</option>
                  <option value={1}>1x (Normal)</option>
                  <option value={2}>2x (Fast)</option>
                  <option value={3}>3x (Instant)</option>
                </select>
              </div>
            </div>

            <div className="traffic-actions">
              {!isRunning ? (
                <>
                  <button className="button button-primary" type="button" onClick={startTraffic}>
                    Start simulation <span aria-hidden="true">→</span>
                  </button>
                  <button className="button button-secondary" type="button" onClick={nextHop}>
                    Step-by-step
                  </button>
                </>
              ) : (
                <>
                  <button className="button button-secondary" type="button" onClick={prevHop} disabled={currentHop === 0}>
                    ← Previous step
                  </button>
                  {!isFinished && (
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setIsPaused((paused) => !paused)}
                    >
                      {isPaused ? '▶ Resume' : 'Ⅱ Pause'}
                    </button>
                  )}
                  <button className="button button-secondary" type="button" onClick={nextHop} disabled={isFinished}>
                    Next step →
                  </button>
                  {isDelivered && (
                    <button className="button button-primary" type="button" onClick={startTraffic}>
                      ↻ Send again
                    </button>
                  )}
                  <button className="button button-secondary" type="button" onClick={stopTraffic}>
                    Stop
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Hop Explanation + Packet Inspector Trigger */}
          {isRunning && currentNode && (
            <section className="simulator-card hop-explanation" aria-live="polite" aria-label="Current packet hop">
              <div className="simulator-card-heading">
                <div>
                  <p className="section-kicker">
                    {isDelivered
                      ? isTwoWay ? 'PING / HANDSHAKE SUCCESSFUL' : 'DELIVERED'
                      : isFailed
                        ? 'PACKET STOPPED'
                        : `STEP ${currentHop + 1} OF ${trace.length}`}
                  </p>
                  <h2>{currentEvent.title}</h2>
                </div>
                <div className="hop-badge-group">
                  <span className="inspector-type">{currentNode.type}</span>
                  <button
                    type="button"
                    className="button button-secondary inspect-btn"
                    onClick={() => setInspectorModalOpen(true)}
                  >
                    🔍 Inspect Packet Headers
                  </button>
                </div>
              </div>
              <p>{currentEvent.description}</p>
              <div className="hop-progress" aria-label={`Step ${currentHop + 1} of ${trace.length}`}>
                {trace.map((event, index) => (
                  <span className={index <= currentHop ? 'is-complete' : ''} key={`${event.nodeId}-${event.title}-${index}`} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Device Inspector + Terminal */}
        <section className="simulator-card node-inspector" aria-label="Selected device settings">
          {selectedNode ? (
            <>
              <div className="inspector-tabs">
                <button
                  type="button"
                  className={`tab-btn ${inspectorTab === 'config' ? 'is-active' : ''}`}
                  onClick={() => setInspectorTab('config')}
                >
                  ⚙️ Settings
                </button>
                <button
                  type="button"
                  className={`tab-btn ${inspectorTab === 'terminal' ? 'is-active' : ''}`}
                  onClick={() => setInspectorTab('terminal')}
                >
                  💻 Terminal / CLI
                </button>
              </div>

              {inspectorTab === 'config' ? (
                <div className="inspector-config-body">
                  <div className="simulator-card-heading">
                    <div><p className="section-kicker">DEVICE DETAILS</p><h2>{selectedNode.name}</h2></div>
                    <span className="inspector-type">{selectedNode.type}</span>
                  </div>

                  <label>Device name
                    <input
                      value={selectedNode.name}
                      onChange={(event) => updateSelectedNode('name', event.target.value)}
                    />
                  </label>

                  {('ip' in selectedNode) && (
                    <label>IP address
                      <input
                        value={selectedNode.ip || ''}
                        onChange={(event) => updateSelectedNode('ip', event.target.value)}
                        inputMode="decimal"
                      />
                    </label>
                  )}

                  {('prefixLength' in selectedNode) && (
                    <label>Prefix length (/CIDR)
                      <input
                        value={selectedNode.prefixLength ?? ''}
                        onChange={(event) => updateSelectedNode('prefixLength', Number(event.target.value) || 0)}
                        inputMode="numeric"
                      />
                    </label>
                  )}

                  {('gateway' in selectedNode) && (
                    <label>Default gateway
                      <input
                        value={selectedNode.gateway || ''}
                        onChange={(event) => updateSelectedNode('gateway', event.target.value)}
                        inputMode="decimal"
                      />
                    </label>
                  )}

                  {selectedNode.type === 'Switch' && (
                    <label>Switch mode
                      <select
                        value={selectedNode.switchMode || 'L2'}
                        onChange={(e) => updateSelectedNode('switchMode', e.target.value)}
                      >
                        <option value="L2">Layer 2 (MAC only)</option>
                        <option value="L3">Layer 3 (routing)</option>
                      </select>
                    </label>
                  )}

                  {/* Multi-interface list for Routers */}
                  {Array.isArray(selectedNode.interfaces) && selectedNode.interfaces.length > 1 && (
                    <div className="interfaces-manager">
                      <h4>Interfaces ({selectedNode.interfaces.length})</h4>
                      {selectedNode.interfaces.map((intf, index) => (
                        <div key={index} className="interface-row">
                          <span className="intf-name">{intf.name || `eth${index}`}</span>
                          <input
                            value={intf.ip || ''}
                            placeholder="IP"
                            onChange={(e) => updateInterface(index, 'ip', e.target.value)}
                            inputMode="decimal"
                          />
                          <input
                            value={intf.prefixLength ?? ''}
                            placeholder="/"
                            onChange={(e) => updateInterface(index, 'prefixLength', Number(e.target.value) || 0)}
                            inputMode="numeric"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="inspector-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => exportCiscoConfigIos(selectedNode)}
                      title="Export Cisco IOS running-config (.ios)"
                    >
                      📄 Export Cisco Config (.ios)
                    </button>
                    <button
                      className="button button-secondary danger"
                      type="button"
                      onClick={() => deleteNode(selectedNode.id)}
                      disabled={nodes.length <= 1}
                    >
                      Delete device
                    </button>
                  </div>
                </div>
              ) : (
                /* CLI / Terminal Mode */
                <div className={`inspector-terminal-body${terminalExpanded ? ' is-expanded' : ''}`}>
                  <div className="terminal-header">
                    <span className="terminal-dot red" />
                    <span className="terminal-dot yellow" />
                    <span className="terminal-dot green" />
                    <span className="terminal-title">
                      {selectedNode.name} Console ({selectedNode.ip || 'no-ip'})
                      {' '}· {terminalModes[selectedNode.id] || 'user'} mode
                    </span>
                    <button
                      type="button"
                      className="terminal-action-btn"
                      onClick={() => setTerminalPaletteOpen((open) => !open)}
                      aria-expanded={terminalPaletteOpen}
                      title="Command palette"
                    >
                      ⌘ Commands
                    </button>
                    <button type="button" className="terminal-action-btn" onClick={() => exportCiscoConfigIos(selectedNode)} title="Export Cisco IOS running configuration">Export .ios</button>
                    <button type="button" className="terminal-action-btn" onClick={copyTerminalOutput} title="Copy terminal output">Copy</button>
                    <button type="button" className="terminal-action-btn" onClick={downloadTerminalOutput} title="Download terminal output">Download</button>
                    <button type="button" className="terminal-action-btn" onClick={clearTerminalOutput} title="Clear terminal output">Clear</button>
                    <button type="button" className="terminal-action-btn" onClick={resetTerminalDevice} title="Reset this device terminal">Reset</button>
                    <button
                      type="button"
                      className="terminal-expand-btn"
                      aria-label={terminalExpanded ? 'Collapse terminal' : 'Expand terminal'}
                      aria-expanded={terminalExpanded}
                      onClick={() => setTerminalExpanded((expanded) => !expanded)}
                    >
                      {terminalExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>

                  {terminalPaletteOpen && (
                    <div className="terminal-command-palette" aria-label="Terminal command palette">
                      {getDeviceCommands(selectedNode, terminalModes[selectedNode.id] || 'user').map((command) => (
                        <button
                          type="button"
                          key={command}
                          onClick={() => {
                            setTerminalInput(command);
                            setTerminalPaletteOpen(false);
                          }}
                        >
                          {command}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="terminal-screen" aria-label="Terminal output">
                    {(terminalLogs[selectedNode.id] || [
                      `Netwise OS v1.5 [${selectedNode.name}]`,
                      `Type 'help' for network commands (ping, curl, nslookup, ipconfig /renew, arp -a).`,
                    ]).map((line, idx) => (
                      <div
                        key={idx}
                        className={`terminal-line terminal-${typeof line === 'object' ? (line.kind || 'output') : 'output'}`}
                      >
                        {renderTerminalText(typeof line === 'string' ? line : line.text)}
                      </div>
                    ))}
                    <div ref={terminalBottomRef} />
                  </div>

                  {terminalInput && (
                    <div className="terminal-inline-hint" role="status">
                      {(() => {
                        const mode = terminalModes[selectedNode.id] || 'user';
                        const completed = completeTerminalInput(terminalInput, selectedNode, mode);
                        if (typeof completed === 'string') return `Tab: ${completed}`;
                        if (completed.length) return `Suggestions: ${completed.slice(0, 4).join(' · ')}`;
                        const suggested = suggestCommand(terminalInput, getDeviceCommands(selectedNode, mode));
                        return suggested ? `Did you mean: ${suggested}?` : 'Press Tab to complete';
                      })()}
                    </div>
                  )}

                  <form
                    className="terminal-input-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      executeTerminalCommand(terminalInput);
                    }}
                  >
                    <span className="terminal-prompt">
                      {terminalPrompt(selectedNode, terminalModes[selectedNode.id] || 'user', terminalInterfaces[selectedNode.id] || '')}
                    </span>
                    <input
                      type="text"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const mode = terminalModes[selectedNode.id] || 'user';
                          const completed = completeTerminalInput(terminalInput, selectedNode, mode);
                          if (typeof completed === 'string') setTerminalInput(completed);
                        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
                          e.preventDefault();
                          clearTerminalOutput();
                        } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
                          e.preventDefault();
                          setTerminalLogs((prev) => ({
                            ...prev,
                            [selectedNode.id]: [
                              ...(prev[selectedNode.id] || []),
                              { kind: 'warning', text: '^C Command cancelled' },
                            ],
                          }));
                          setTerminalInput('');
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const devHistory = terminalHistories[selectedNode.id] || [];
                          if (devHistory.length > 0) {
                            const pointer = terminalHistoryPointers[selectedNode.id] ?? -1;
                            const nextPtr = pointer === -1 ? devHistory.length - 1 : Math.max(0, pointer - 1);
                            setTerminalHistoryPointers((prev) => ({ ...prev, [selectedNode.id]: nextPtr }));
                            setTerminalInput(devHistory[nextPtr]);
                          }
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const pointer = terminalHistoryPointers[selectedNode.id] ?? -1;
                          const devHistory = terminalHistories[selectedNode.id] || [];
                          if (pointer !== -1) {
                            const nextPtr = pointer + 1;
                            if (nextPtr >= devHistory.length) {
                              setTerminalHistoryPointers((prev) => ({ ...prev, [selectedNode.id]: -1 }));
                              setTerminalInput('');
                            } else {
                              setTerminalHistoryPointers((prev) => ({ ...prev, [selectedNode.id]: nextPtr }));
                              setTerminalInput(devHistory[nextPtr]);
                            }
                          }
                        }
                      }}
                      placeholder="e.g. ping 93.184.216.34 or curl example.com"
                      spellCheck="false"
                      autoCapitalize="off"
                      autoComplete="off"
                    />
                    <button type="submit" className="button button-primary term-btn">Run</button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="inspector-empty-state">
              <span className="empty-icon" aria-hidden="true">🖥️</span>
              <h3>No Device Selected</h3>
              <p>Click any device on the canvas to configure IP addresses, subnet masks, interfaces, or access its CLI console.</p>
            </div>
          )}
        </section>
      </div>

      {/* Cable picker modal */}
      {cablePickerOpen && pendingConnect && (() => {
        const fromNode = nodes.find((n) => n.id === pendingConnect.fromId);
        const toNode = nodes.find((n) => n.id === pendingConnect.toId);
        const cableOptions = Object.values(CABLE_TYPES).filter((cable) => (
          !validateCable(fromNode, toNode, cable.id)
        ));
        const suggestedCable = suggestCable(fromNode?.type, toNode?.type);
        const recommendedCable = cableOptions.some((cable) => cable.id === suggestedCable)
          ? suggestedCable
          : null;
        const err = cableOptions.length ? null : validateCable(fromNode, toNode, pendingCable);
        return (
          <div
            className="cable-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) cancelCablePicker();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelCablePicker();
            }}
          >
            <section
              ref={cableDialogRef}
              className="cable-modal cable-picker-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cable-dialog-title"
            >
              <div className="cable-modal-heading">
                <div>
                  <p className="modal-step">LINK SETUP <span>02 / 02</span></p>
                  <h2 id="cable-dialog-title">Choose a cable</h2>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="Cancel connection"
                  onClick={cancelCablePicker}
                >
                  ×
                </button>
              </div>

              <div className="cable-endpoints" aria-label={`Connect ${fromNode?.name} to ${toNode?.name}`}>
                <div className="cable-endpoint">
                  <span className="cable-endpoint-icon"><DeviceIcon type={fromNode?.type} /></span>
                  <span><strong>{fromNode?.name}</strong><small>{fromNode?.type}</small></span>
                </div>
                <div className="cable-endpoint-track" aria-hidden="true">
                  <span />
                  <small>LINK</small>
                </div>
                <div className="cable-endpoint">
                  <span className="cable-endpoint-icon"><DeviceIcon type={toNode?.type} /></span>
                  <span><strong>{toNode?.name}</strong><small>{toNode?.type}</small></span>
                </div>
              </div>

              <div className="cable-options">
                {cableOptions.map((cable) => (
                  <button
                    key={cable.id}
                    type="button"
                    className={`cable-option${pendingCable === cable.id ? ' is-active' : ''}`}
                    onClick={() => setPendingCable(cable.id)}
                    aria-pressed={pendingCable === cable.id}
                  >
                    <span className="cable-option-mark" style={{ '--cable-color': cable.color }}>
                      <span />
                    </span>
                    <span className="cable-option-copy">
                      <span className="cable-option-title">{cable.label}</span>
                      <small>{cable.description}</small>
                      {recommendedCable === cable.id && <span className="cable-recommended">Recommended</span>}
                    </span>
                    <span className="cable-option-radio" aria-hidden="true" />
                  </button>
                ))}
              </div>
              {err && <p className="cable-error" role="alert">{err}</p>}

              <div className="cable-modal-actions">
                <button className="button button-secondary" type="button" onClick={cancelCablePicker}>
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={!cableOptions.some((cable) => cable.id === pendingCable)}
                  onClick={commitConnection}
                >
                  Create connection <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          </div>
        );
      })()}

      {/* Device catalog modal */}
      {catalogOpen && (
        <div className="cable-modal-overlay" role="dialog" aria-modal="true" aria-label="Device catalog">
          <div className="cable-modal">
            <h3>Add a device</h3>
            <p className="cable-modal-sub">Pick a device type to add to your network.</p>
            {DEVICE_CATALOG.map((section) => (
              <div key={section.group} className="catalog-section">
                <p className="section-kicker">{section.group}</p>
                <div className="catalog-grid">
                  {section.items.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="catalog-item"
                      onClick={() => addNodeOfType(type)}
                    >
                      <span className="node-symbol"><DeviceIcon type={type} /></span>
                      <span>{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="cable-modal-actions">
              <button className="button button-secondary" type="button" onClick={() => setCatalogOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packet Inspector Modal ("Wireshark-Lite") */}
      {inspectorModalOpen && currentEvent && (
        <div className="cable-modal-overlay" role="dialog" aria-modal="true" aria-label="Packet Inspector">
          <div className="cable-modal packet-inspector-modal">
            <div className="cable-modal-heading">
              <div>
                <p className="modal-step">PACKET ANALYZER (WIRESHARK-LITE)</p>
                <h2>Decapsulated Packet Inspection</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Close Packet Inspector"
                onClick={() => setInspectorModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="inspector-modal-tabs">
              <button
                type="button"
                className={`tab-btn ${inspectorViewMode === 'layers' ? 'is-active' : ''}`}
                onClick={() => setInspectorViewMode('layers')}
              >
                📋 OSI Protocol Layers
              </button>
              <button
                type="button"
                className={`tab-btn ${inspectorViewMode === 'hex' ? 'is-active' : ''}`}
                onClick={() => setInspectorViewMode('hex')}
              >
                🔢 Frame Hex Dump
              </button>
            </div>

            {inspectorViewMode === 'layers' ? (
              <div className="inspector-layers-view">
                {/* Layer 2 */}
                <div className="layer-card">
                  <div className="layer-header">
                    <span className="layer-badge l2">Layer 2</span>
                    <h4>Ethernet II Frame ({currentEvent.packetDetails?.frame?.length || '64 bytes'})</h4>
                  </div>
                  <div className="layer-fields">
                    <div><span>Source MAC:</span> <code>{currentEvent.packetDetails?.frame?.srcMac}</code></div>
                    <div><span>Destination MAC:</span> <code>{currentEvent.packetDetails?.frame?.dstMac}</code></div>
                    <div><span>EtherType:</span> <code>{currentEvent.packetDetails?.frame?.etherType}</code></div>
                  </div>
                </div>

                {/* Layer 3 */}
                {currentEvent.packetDetails?.ip && (
                  <div className="layer-card">
                    <div className="layer-header">
                      <span className="layer-badge l3">Layer 3</span>
                      <h4>Internet Protocol Version 4 (IPv4)</h4>
                    </div>
                    <div className="layer-fields">
                      <div><span>Source IP:</span> <code>{currentEvent.packetDetails.ip.srcIp}</code></div>
                      <div><span>Destination IP:</span> <code>{currentEvent.packetDetails.ip.dstIp}</code></div>
                      <div><span>Time to Live (TTL):</span> <code>{currentEvent.packetDetails.ip.ttl}</code></div>
                      <div><span>Protocol:</span> <code>{currentEvent.packetDetails.ip.protocol}</code></div>
                      <div><span>Header Checksum:</span> <code>{currentEvent.packetDetails.ip.checksum}</code></div>
                      {currentEvent.packetDetails.ip.natTranslation && (
                        <div><span>NAT Translation:</span> <strong>{currentEvent.packetDetails.ip.natTranslation}</strong></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Layer 4 */}
                {currentEvent.packetDetails?.transport && (
                  <div className="layer-card">
                    <div className="layer-header">
                      <span className="layer-badge l4">Layer 4</span>
                      <h4>{currentEvent.packetDetails.transport.type} (Transport / Control)</h4>
                    </div>
                    <div className="layer-fields">
                      <div><span>Summary:</span> <strong>{currentEvent.packetDetails.transport.summary}</strong></div>
                      {currentEvent.packetDetails.transport.srcPort && (
                        <div><span>Ports:</span> <code>{currentEvent.packetDetails.transport.srcPort} → {currentEvent.packetDetails.transport.dstPort}</code></div>
                      )}
                      {currentEvent.packetDetails.transport.flags && (
                        <div><span>Flags:</span> <code>[{currentEvent.packetDetails.transport.flags}]</code></div>
                      )}
                      <div><span>Sequence:</span> <code>#{currentEvent.packetDetails.transport.sequenceNumber}</code></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Hex Dump View */
              <div className="inspector-hexdump-view">
                <pre className="hexdump-code">
                  {`0000   02 00 00 00 00 21 aa bb  cc 00 00 01 08 00 45 00   .....!........E.
0010   00 3c 1c 3a 00 00 08 01  3a 4b c0 a8 01 04 5d b8   .<.:....:K....].
0020   d8 22 08 00 4d 5b 00 01  00 01 61 62 63 64 65 66   ."..M[....abcdef
0030   67 68 69 6a 6b 6c 6d 6e  6f 70 71 72 73 74 75 76   ghijklmnopqrstuv
0040   77 61 62 63 64 65 66 67  68 69                     wabcdefghi`}
                </pre>
              </div>
            )}

            <div className="cable-modal-actions">
              <button className="button button-primary" type="button" onClick={() => setInspectorModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lab Scenario Builder Modal */}
      <LabBuilderModal
        isOpen={labBuilderOpen}
        onClose={() => setLabBuilderOpen(false)}
        nodes={nodes}
        links={links}
        onLoadLab={(lab) => {
          resetSimulation();
          if (lab.starterNodes) setNodes(lab.starterNodes);
          if (lab.starterLinks) setLinks(lab.starterLinks);
          if (lab.targetSourceId) setSourceId(lab.targetSourceId);
          if (lab.targetDestId) setDestinationId(lab.targetDestId);
          setSimMessage(`Loaded lab scenario: ${lab.title}`);
          setLabBuilderOpen(false);
        }}
      />

      {/* Interactive Walkthrough Tour */}
      <WalkthroughTour
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </section>
  );
}

export default Simulator;
