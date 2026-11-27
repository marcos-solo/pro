import { useEffect, useState } from 'react';
import { simulatePacket } from './networkEngine.js';
import { loadProfile, saveProfile } from './progressStore.js';

const CHALLENGES = [
  {
    id: 'ch-1',
    level: '01',
    difficulty: 'Easy',
    title: 'The Broken Switch Uplink',
    category: 'Layer 1 & 2 Cabling',
    brief: 'Two departments each have their own switch. PC1 needs to send a packet to PC2, but the uplink connection between Switch A and Switch B is broken or uses the wrong cable type.',
    hint: 'Switches are like-devices. In standard Ethernet guidelines, connecting a switch to another switch requires a crossover cable (or OM4 fiber).',
    initialNodes: [
      { id: 1, name: 'Workstation 1', type: 'PC', x: 20, y: 50, ip: '192.168.1.10', prefixLength: 24, gateway: '192.168.1.1', mac: 'AA:BB:CC:00:00:11' },
      { id: 2, name: 'Switch A', type: 'Switch', x: 40, y: 50, mac: '02:00:00:00:00:22' },
      { id: 3, name: 'Switch B', type: 'Switch', x: 60, y: 50, mac: '02:00:00:00:00:33' },
      { id: 4, name: 'Workstation 2', type: 'PC', x: 80, y: 50, ip: '192.168.1.20', prefixLength: 24, gateway: '192.168.1.1', mac: 'AA:BB:CC:00:00:44' },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 3, to: 4, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 4,
    verify: (nodes, links) => {
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 4 });
      if (res.error) return { ok: false, msg: res.error };
      const hasUplink = links.some((l) => (
        ((l.from === 2 && l.to === 3) || (l.from === 3 && l.to === 2)) &&
        (l.cable === 'crossover' || l.cable === 'fiber')
      ));
      if (!hasUplink) return { ok: false, msg: 'Connect Switch A and Switch B using a Crossover (Cat6) or Fiber cable.' };
      return { ok: true, msg: 'Workstation 1 successfully reached Workstation 2 across the switch uplink!' };
    },
  },
  {
    id: 'ch-2',
    level: '02',
    difficulty: 'Easy',
    title: 'The Subnet Mismatch',
    category: 'IP Addressing & Subnets',
    brief: 'Laptop 1 and Laptop 2 are plugged into the same local switch, but they cannot communicate. Laptop 1 is on 192.168.1.10/24, but Laptop 2 was accidentally configured with IP 192.168.2.20/24.',
    hint: 'Without a Layer 3 router, devices on the same switch must share the same network address prefix (192.168.1.x/24).',
    initialNodes: [
      { id: 1, name: 'Laptop 1', type: 'PC', x: 25, y: 50, ip: '192.168.1.10', prefixLength: 24, gateway: '', mac: 'AA:BB:CC:00:00:11' },
      { id: 2, name: 'Office Switch', type: 'Switch', x: 50, y: 50, mac: '02:00:00:00:00:22' },
      { id: 3, name: 'Laptop 2', type: 'PC', x: 75, y: 50, ip: '192.168.2.20', prefixLength: 24, gateway: '', mac: 'AA:BB:CC:00:00:33' },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 3,
    verify: (nodes, links) => {
      const node2 = nodes.find((n) => n.id === 3);
      if (!node2.ip.startsWith('192.168.1.')) {
        return { ok: false, msg: `Laptop 2 is still on ${node2.ip}. It needs an IP in 192.168.1.x/24.` };
      }
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 3 });
      if (res.error) return { ok: false, msg: res.error };
      return { ok: true, msg: 'Subnet matched! Both laptops communicate directly over Layer 2.' };
    },
  },
  {
    id: 'ch-3',
    level: '03',
    difficulty: 'Medium',
    title: 'The Missing Default Gateway',
    category: 'Routing',
    brief: 'Your PC needs to access a cloud Web Server at 93.184.216.34. The router interface connected to your switch is 192.168.1.1, but your PC has no default gateway configured.',
    hint: 'When a destination IP is outside the local subnet, the PC must know the router IP to forward packets to. Set the PC default gateway to 192.168.1.1.',
    initialNodes: [
      { id: 1, name: 'My PC', type: 'PC', x: 20, y: 50, ip: '192.168.1.5', prefixLength: 24, gateway: '', mac: 'AA:BB:CC:00:00:11' },
      { id: 2, name: 'LAN Switch', type: 'Switch', x: 42, y: 50, mac: '02:00:00:00:00:22' },
      {
        id: 3, name: 'Gateway Router', type: 'Router', x: 64, y: 50,
        interfaces: [
          { name: 'Gi0/0', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:31' },
          { name: 'Gi0/1', ip: '93.184.216.1', prefixLength: 24, mac: '02:00:00:00:00:32' },
        ],
      },
      { id: 4, name: 'Web Server', type: 'Server', x: 86, y: 50, ip: '93.184.216.34', prefixLength: 24, gateway: '93.184.216.1', mac: 'AA:BB:CC:00:00:44' },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
      { from: 3, to: 4, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 4,
    verify: (nodes, links) => {
      const pc = nodes.find((n) => n.id === 1);
      if (pc.gateway !== '192.168.1.1') {
        return { ok: false, msg: `My PC gateway is set to "${pc.gateway || 'none'}". It must be 192.168.1.1.` };
      }
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 4 });
      if (res.error) return { ok: false, msg: res.error };
      return { ok: true, msg: 'Packet routed! The PC forwards off-subnet traffic to the gateway router.' };
    },
  },
  {
    id: 'ch-4',
    level: '04',
    difficulty: 'Medium',
    title: 'The Firewall Barrier',
    category: 'Security & Access Control',
    brief: 'A branch office PC is attempting to reach the internal file server at 10.0.0.50, but the perimeter Firewall has a security rule actively blocking traffic to that server.',
    hint: 'Select the Firewall device and review or clear the deny rule blocking 10.0.0.50.',
    initialNodes: [
      { id: 1, name: 'Branch PC', type: 'PC', x: 20, y: 50, ip: '192.168.1.10', prefixLength: 24, gateway: '192.168.1.1', mac: 'AA:BB:CC:00:00:11' },
      { id: 2, name: 'Switch', type: 'Switch', x: 40, y: 50, mac: '02:00:00:00:00:22' },
      {
        id: 3, name: 'Corporate Firewall', type: 'Firewall', x: 60, y: 50,
        interfaces: [
          { name: 'inside', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:31' },
          { name: 'dmz', ip: '10.0.0.1', prefixLength: 24, mac: '02:00:00:00:00:32' },
        ],
        rules: [{ id: 'rule1', name: 'Block Server', action: 'deny', targetIp: '10.0.0.50' }],
      },
      { id: 4, name: 'File Server', type: 'Server', x: 80, y: 50, ip: '10.0.0.50', prefixLength: 24, gateway: '10.0.0.1', mac: 'AA:BB:CC:00:00:44' },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
      { from: 3, to: 4, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 4,
    verify: (nodes, links) => {
      const fw = nodes.find((n) => n.id === 3);
      const isBlocked = fw?.rules?.some((r) => r.action === 'deny' && (!r.targetIp || r.targetIp === '10.0.0.50'));
      if (isBlocked) {
        return { ok: false, msg: 'The Firewall still has an active deny rule blocking 10.0.0.50.' };
      }
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 4 });
      if (res.error) return { ok: false, msg: res.error };
      return { ok: true, msg: 'Firewall policy updated! The Branch PC can now securely access the File Server.' };
    },
  },
  {
    id: 'ch-5',
    level: '05',
    difficulty: 'Hard',
    title: 'The Infinite Routing Loop',
    category: 'Advanced Routing & TTL',
    brief: 'A network loop between Router A and Router B causes packets destined for 172.16.0.10 to bounce endlessly back and forth until the TTL drops to 0 and the packet dies.',
    hint: 'Inspect Router B. Its route for 172.16.0.0/24 points back to Router A instead of forward to the target network.',
    initialNodes: [
      { id: 1, name: 'Workstation', type: 'PC', x: 15, y: 50, ip: '192.168.1.10', prefixLength: 24, gateway: '192.168.1.1', mac: 'AA:BB:CC:00:00:11' },
      {
        id: 2, name: 'Router A', type: 'Router', x: 38, y: 50,
        interfaces: [
          { name: 'Gi0/0', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:21' },
          { name: 'Gi0/1', ip: '10.0.0.1', prefixLength: 24, mac: '02:00:00:00:00:22' },
        ],
        routes: [{ network: '172.16.0.0', prefixLength: 24, nextHop: '10.0.0.2' }],
      },
      {
        id: 3, name: 'Router B', type: 'Router', x: 62, y: 50,
        interfaces: [
          { name: 'Gi0/0', ip: '10.0.0.2', prefixLength: 24, mac: '02:00:00:00:00:31' },
          { name: 'Gi0/1', ip: '172.16.0.1', prefixLength: 24, mac: '02:00:00:00:00:32' },
        ],
        routes: [{ network: '172.16.0.0', prefixLength: 24, nextHop: '10.0.0.1' }],
      },
      { id: 4, name: 'Target Server', type: 'Server', x: 85, y: 50, ip: '172.16.0.10', prefixLength: 24, gateway: '172.16.0.1', mac: 'AA:BB:CC:00:00:44' },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'serial' },
      { from: 3, to: 4, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 4,
    verify: (nodes, links) => {
      const routerB = nodes.find((n) => n.id === 3);
      const badRoute = routerB?.routes?.some((r) => r.network === '172.16.0.0' && r.nextHop === '10.0.0.1');
      if (badRoute) {
        return { ok: false, msg: 'Router B is still pointing 172.16.0.0/24 traffic back to 10.0.0.1 (Router A)!' };
      }
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 4 });
      if (res.error) return { ok: false, msg: res.error };
      return { ok: true, msg: 'Routing loop broken! The packet reaches Target Server with healthy TTL.' };
    },
  },
  {
    id: 'ch-6',
    level: '06',
    difficulty: 'Medium',
    title: 'The Blocked Port (Security ACL)',
    category: 'Firewall & Port Filtering',
    brief: 'A desktop needs to reach the Web Server on port 80, but an overzealous security rule on Edge Firewall drops all incoming web traffic.',
    hint: 'Edit or remove the blocking rule on Edge Firewall to permit port 80 (HTTP) traffic.',
    initialNodes: [
      { id: 1, name: 'Client PC', type: 'PC', x: 20, y: 50, ip: '192.168.1.15', prefixLength: 24, gateway: '192.168.1.1', mac: 'AA:BB:CC:00:00:15' },
      {
        id: 2, name: 'Edge Firewall', type: 'Firewall', x: 50, y: 50,
        interfaces: [
          { name: 'inside', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:21' },
          { name: 'outside', ip: '93.184.216.1', prefixLength: 24, mac: '02:00:00:00:00:22' },
        ],
        rules: [{ id: 'r-http', name: 'Drop Web Port 80', action: 'deny', targetIp: '93.184.216.34', port: 80 }],
      },
      { id: 3, name: 'Web Host', type: 'Server', x: 80, y: 50, ip: '93.184.216.34', prefixLength: 24, gateway: '93.184.216.1', mac: 'AA:BB:CC:00:00:34' },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 3,
    verify: (nodes, links) => {
      const fw = nodes.find((n) => n.id === 2);
      const blocked = fw?.rules?.some((r) => r.action === 'deny');
      if (blocked) {
        return { ok: false, msg: 'Edge Firewall still contains a deny rule dropping traffic.' };
      }
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 3, protocol: 'TCP', port: 80 });
      if (res.error) return { ok: false, msg: res.error };
      return { ok: true, msg: 'Port 80 HTTP permitted! The client successfully connects to the Web Host.' };
    },
  },
  {
    id: 'ch-7',
    level: '07',
    difficulty: 'Medium',
    title: 'The Misconfigured DNS Server',
    category: 'Application & DNS',
    brief: 'A user attempts to resolve domain names, but their PC is configured with a dead DNS IP (192.168.1.250). Update the client to point to the real Gateway/DNS at 192.168.1.1.',
    hint: 'Configure the default gateway and DNS settings on Laptop 1 to point to 192.168.1.1.',
    initialNodes: [
      { id: 1, name: 'User Laptop', type: 'PC', x: 20, y: 50, ip: '192.168.1.100', prefixLength: 24, gateway: '192.168.1.1', dns: '192.168.1.250', mac: 'AA:BB:CC:00:00:10' },
      { id: 2, name: 'Switch', type: 'Switch', x: 50, y: 50, mac: '02:00:00:00:00:20' },
      {
        id: 3, name: 'Router & DNS', type: 'Router', x: 80, y: 50, isDns: true,
        interfaces: [{ name: 'eth0', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:30' }],
      },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 3,
    verify: (nodes, links) => {
      const laptop = nodes.find((n) => n.id === 1);
      if (laptop.dns !== '192.168.1.1' && laptop.dns !== '8.8.8.8') {
        return { ok: false, msg: `Laptop DNS is currently set to "${laptop.dns || 'none'}". It should point to 192.168.1.1.` };
      }
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 3 });
      if (res.error) return { ok: false, msg: res.error };
      return { ok: true, msg: 'DNS configured! The laptop can now resolve domain names across the network.' };
    },
  },
  {
    id: 'ch-8',
    level: '08',
    difficulty: 'Easy',
    title: 'The Unassigned Client (DHCP)',
    category: 'DHCP & Addressing',
    brief: 'A freshly connected tablet is offline with an unassigned IP (0.0.0.0). Provide it with an IP on the 192.168.1.0/24 subnet (e.g. 192.168.1.75) and set its gateway to 192.168.1.1.',
    hint: 'Open the inspector for the Tablet and set its IP to 192.168.1.75 and Gateway to 192.168.1.1.',
    initialNodes: [
      { id: 1, name: 'Offline Tablet', type: 'PC', x: 20, y: 50, ip: '0.0.0.0', prefixLength: 24, gateway: '', mac: 'AA:BB:CC:00:00:77' },
      { id: 2, name: 'Access Point', type: 'Switch', x: 50, y: 50, mac: '02:00:00:00:00:72' },
      {
        id: 3, name: 'Home Gateway', type: 'Router', x: 80, y: 50,
        interfaces: [{ name: 'LAN', ip: '192.168.1.1', prefixLength: 24, mac: '02:00:00:00:00:71' }],
      },
    ],
    initialLinks: [
      { from: 1, to: 2, cable: 'straightThrough' },
      { from: 2, to: 3, cable: 'straightThrough' },
    ],
    sourceId: 1,
    destId: 3,
    verify: (nodes, links) => {
      const tablet = nodes.find((n) => n.id === 1);
      if (tablet.ip === '0.0.0.0' || !tablet.ip.startsWith('192.168.1.')) {
        return { ok: false, msg: 'Tablet still has no valid 192.168.1.x IP address assigned.' };
      }
      if (tablet.gateway !== '192.168.1.1') {
        return { ok: false, msg: 'Tablet default gateway must be set to 192.168.1.1.' };
      }
      const res = simulatePacket({ nodes, links, sourceId: 1, destinationId: 3 });
      if (res.error) return { ok: false, msg: res.error };
      return { ok: true, msg: 'Tablet online and leased! It successfully reaches the Home Gateway.' };
    },
  },
];

const STORAGE_CHALLENGES = 'netwise.challenges.solved';

function loadSolved() {
  try {
    const raw = window.localStorage.getItem(STORAGE_CHALLENGES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function Challenges() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [solved, setSolved] = useState(loadSolved);
  const [showHint, setShowHint] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [userName, setUserName] = useState('Network Engineer');
  const [profile] = useState(loadProfile);

  const currentChallenge = CHALLENGES[activeIdx];
  const isSolved = solved.includes(currentChallenge.id);

  useEffect(() => {
    const handleStorage = () => setSolved(loadSolved());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);


  const handleLaunchInSimulator = (challenge) => {
    sessionStorage.setItem('netwise.simulator.loadChallenge', JSON.stringify({
      challengeId: challenge.id,
      title: challenge.title,
      nodes: challenge.initialNodes,
      links: challenge.initialLinks,
      sourceId: challenge.sourceId,
      destId: challenge.destId,
    }));
    window.location.href = '/simulator?challenge=' + challenge.id;
  };

  return (
    <section className="page-shell challenges-page">
      <div className="page-heading">
        <div>
          <p className="section-kicker">HANDS-ON TROUBLESHOOTING</p>
          <h1>Fix the <span>Network</span></h1>
          <p>Solve real-world networking malfunctions: broken cables, misconfigured subnets, and routing loops.</p>
        </div>
        <div className="challenges-header-actions">
          <div className="challenge-progress-badge">
            <span>🏆 {solved.length} of {CHALLENGES.length} Solved</span>
          </div>
          {solved.length >= 1 && (
            <button
              type="button"
              className="button button-secondary cert-btn"
              onClick={() => setCertificateOpen(true)}
            >
              🎓 View Certificate
            </button>
          )}
        </div>
      </div>

      {/* Challenge Navigation Tabs */}
      <div className="challenge-tabs">
        {CHALLENGES.map((ch, idx) => (
          <button
            key={ch.id}
            type="button"
            className={`challenge-tab ${activeIdx === idx ? 'is-active' : ''} ${solved.includes(ch.id) ? 'is-done' : ''}`}
            onClick={() => {
              setActiveIdx(idx);
              setShowHint(false);
            }}
          >
            <span className="ch-tab-num">{ch.level}</span>
            <span className="ch-tab-name">{ch.title}</span>
            {solved.includes(ch.id) && <span className="ch-check">✓</span>}
          </button>
        ))}
      </div>

      {/* Active Challenge Card */}
      <div className="challenge-card">
        <div className="challenge-card-top">
          <div className="ch-meta">
            <span className="ch-badge difficulty">{currentChallenge.difficulty}</span>
            <span className="ch-badge category">{currentChallenge.category}</span>
          </div>
          {isSolved && <span className="ch-solved-pill">✓ Solved</span>}
        </div>

        <h2>{currentChallenge.title}</h2>
        <p className="ch-brief">{currentChallenge.brief}</p>

        {/* Action Callout */}
        <div className="ch-action-box">
          <div className="ch-action-info">
            <h4>Ready to troubleshoot?</h4>
            <p>Load this broken scenario into the Simulator canvas to diagnose and fix it.</p>
          </div>
          <button
            className="button button-primary"
            type="button"
            onClick={() => handleLaunchInSimulator(currentChallenge)}
          >
            Launch in Simulator <span aria-hidden="true">→</span>
          </button>
        </div>

        {/* Hint toggle */}
        <div className="ch-hint-section">
          <button
            type="button"
            className="text-link hint-btn"
            onClick={() => setShowHint((h) => !h)}
          >
            {showHint ? '🙈 Hide troubleshooting hint' : '💡 Need a hint?'}
          </button>
          {showHint && (
            <div className="ch-hint-box" role="status">
              <strong>Hint:</strong> {currentChallenge.hint}
            </div>
          )}
        </div>

        {/* Pager */}
        <div className="ch-footer-pager">
          <button
            type="button"
            className="button button-secondary"
            disabled={activeIdx === 0}
            onClick={() => {
              setActiveIdx((i) => i - 1);
              setShowHint(false);
            }}
          >
            ← Previous Challenge
          </button>

          <button
            type="button"
            className="button button-secondary"
            disabled={activeIdx === CHALLENGES.length - 1}
            onClick={() => {
              setActiveIdx((i) => i + 1);
              setShowHint(false);
            }}
          >
            Next Challenge →
          </button>
        </div>
      </div>

      {/* Certificate Modal */}
      {certificateOpen && (
        <div className="modal-backdrop" onClick={() => setCertificateOpen(false)}>
          <div className="certificate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cert-header">
              <h3>Certificate of Achievement</h3>
              <button
                type="button"
                className="cert-close-btn"
                onClick={() => setCertificateOpen(false)}
                aria-label="Close certificate"
              >
                ×
              </button>
            </div>

            <div className="certificate-canvas-sheet">
              <div className="cert-border">
                <div className="cert-watermark">NETWISE</div>
                <div className="cert-title">CERTIFICATE OF RECOGNITION</div>
                <div className="cert-subtitle">PROUDLY PRESENTED TO</div>

                <div className="cert-name-input-wrapper">
                  <input
                    type="text"
                    className="cert-recipient-name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your Name Here"
                  />
                </div>

                <div className="cert-body">
                  For demonstrated excellence and practical problem-solving in computer network architecture,
                  packet routing, subnet calculation, and hands-on network troubleshooting.
                </div>

                <div className="cert-stats">
                  <span>Solved Labs: <strong>{solved.length} / {CHALLENGES.length}</strong></span>
                  <span>Rank: <strong>{solved.length === CHALLENGES.length ? 'Master Specialist' : 'Network Practitioner'}</strong></span>
                </div>

                <div className="cert-footer-row">
                  <div className="cert-seal">
                    <span className="seal-star">★</span>
                    <span className="seal-text">NETWISE VERIFIED</span>
                  </div>
                  <div className="cert-signature">
                    <div className="sig-line" />
                    <span>Netwise Evaluation Engine</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="cert-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => window.print()}
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setCertificateOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Challenges;
export { CHALLENGES };
