import { useState } from 'react';

const GLOSSARY = [
  { term: 'IP Address', cat: 'Layer 3', def: 'A unique logical number assigned to each device on an IP network (e.g. 192.168.1.4). Used by routers to deliver packets across networks.' },
  { term: 'MAC Address', cat: 'Layer 2', def: 'A permanent 48-bit hardware address burnt into a Network Interface Card (e.g. 02:00:00:00:00:21). Used by switches for local delivery.' },
  { term: 'Default Gateway', cat: 'Routing', def: 'The router IP where devices forward all packets destined for outside their local subnet.' },
  { term: 'Subnet Mask / CIDR', cat: 'Addressing', def: 'Defines how many bits of an IP address represent the network vs. individual host machines (e.g., /24 = 255.255.255.0).' },
  { term: 'ARP (Address Resolution Protocol)', cat: 'Layer 2/3', def: 'Resolves an IPv4 address to its physical hardware MAC address using local network broadcasts.' },
  { term: 'ICMP (Internet Control Message Protocol)', cat: 'Layer 3', def: 'Used by network devices to send error messages and operational info (e.g., Ping Echo Request/Reply, TTL Exceeded).' },
  { term: 'TTL (Time-To-Live)', cat: 'Layer 3', def: 'A counter in the IP header decremented by 1 at each router hop. When it hits 0, the packet is dropped to prevent infinite loops.' },
  { term: 'DNS (Domain Name System)', cat: 'Layer 7', def: 'The global distributed phonebook translating human names like "google.com" into numerical IP addresses.' },
  { term: 'NAT (Network Address Translation)', cat: 'Routing', def: 'Enables private subnets (192.168.x.x) to share a single public IP address when connecting out to the internet.' },
  { term: 'DHCP (Dynamic Host Configuration Protocol)', cat: 'Layer 7', def: 'Automatically assigns IP addresses, subnet masks, gateways, and DNS servers to connecting devices.' },
  { term: 'Switch (Layer 2)', cat: 'Hardware', def: 'Connects devices within the same local network and forwards frames specifically to the destination port by learning MAC addresses.' },
  { term: 'Router (Layer 3)', cat: 'Hardware', def: 'Connects multiple distinct subnets or networks together, choosing optimal paths based on IP routing tables.' },
  { term: 'Firewall', cat: 'Security', def: 'Monitors incoming and outgoing traffic, applying security rules to permit or block packets.' },
  { term: 'VLAN (Virtual LAN)', cat: 'Layer 2', def: 'A logical partition that isolates network broadcast traffic on the same physical switch hardware.' },
  { term: 'TCP vs. UDP', cat: 'Layer 4', def: 'TCP provides reliable, sequenced delivery with acknowledgments. UDP provides fast, low-overhead datagrams without handshakes.' },
];

const DEVICE_GUIDE = [
  { name: 'PC / Laptop', type: 'End Device', desc: 'Host workstation generating and receiving network traffic. Requires IP, subnet mask, and default gateway.' },
  { name: 'Server', type: 'End Device', desc: 'High-availability computer hosting websites, APIs, or database services listening on static IP addresses and known ports.' },
  { name: 'L2 Switch', type: 'Network Device', desc: 'Inspects Ethernet frames and learns port-to-MAC associations. Floods broadcast and unknown unicast frames.' },
  { name: 'Router', type: 'Network Device', desc: 'Inspects Layer 3 IP headers, decrements TTL, and routes packets between distinct subnets or WAN links.' },
  { name: 'Access Point (AP)', type: 'Wireless', desc: 'Bridges 802.11 Wi-Fi radio frequencies into the wired Ethernet network.' },
  { name: 'Firewall', type: 'Security', desc: 'Inspects IP addresses, ports, and protocols against security access control lists (ACLs) to stop malicious traffic.' },
];

const CABLE_GUIDE = [
  { name: 'Straight-Through (Cat6)', color: '#3b82f6', desc: 'Connects unlike devices (e.g. PC to Switch, Switch to Router). Standard twisted pair cable.' },
  { name: 'Crossover (Cat6)', color: '#f59e0b', desc: 'Connects like devices directly (e.g. Switch to Switch, Router to Router, PC to PC).' },
  { name: 'Fiber (OM4 Optical)', color: '#10b981', desc: 'High-bandwidth, immune to electromagnetic interference, used for long-distance router and backbone uplinks.' },
  { name: 'Serial (WAN DCE/DTE)', color: '#8b5cf6', desc: 'Point-to-point leased WAN link between enterprise routers.' },
  { name: 'Wireless (802.11ac)', color: '#06b6d4', desc: 'Radio frequency link connecting wireless clients (phones, laptops) to Access Points.' },
];

function About() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  const categories = ['All', ...new Set(GLOSSARY.map((g) => g.cat))];

  const filteredGlossary = GLOSSARY.filter((item) => {
    const matchesCat = selectedCat === 'All' || item.cat === selectedCat;
    const matchesQuery = !searchTerm.trim() ||
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cat.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.def.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <section className="page-shell about-page">
      <header className="about-hero">
        <div className="about-hero-copy">
          <p className="section-kicker">THE NETWORKING FIELD GUIDE</p>
          <h1>Make the invisible parts of the internet <span>visible.</span></h1>
          <p className="about-copy">
            Networks can feel abstract until you see what each device does. Netwise turns packets, addresses, and routing rules into hands-on experiments you can explore at your own pace.
          </p>
          <div className="about-hero-actions">
            <a className="button button-primary" href="/simulator">Launch Simulator <span aria-hidden="true">→</span></a>
            <a className="button button-secondary" href="/learn">Explore 8 Guides</a>
          </div>
          <div className="about-hero-note"><span className="status-dot" /> Free to explore. No setup required.</div>
        </div>

        <figure className="about-visual">
          <div className="about-visual-heading">
            <span>THE JOURNEY OF A PACKET</span>
            <span className="about-live"><i /> IN MOTION</span>
          </div>
          <div className="packet-route" aria-label="Laptop to switch to router to web server">
            <div className="route-line" />
            {[
              { label: 'Laptop', detail: '192.168.1.4', symbol: '01' },
              { label: 'Switch', detail: 'MAC address', symbol: '02' },
              { label: 'Router', detail: 'Next hop', symbol: '03' },
              { label: 'Web server', detail: '93.184.216.34', symbol: '04' },
            ].map((node) => (
              <div className="route-node" key={node.label}>
                <span className="route-node-icon">{node.symbol}</span>
                <strong>{node.label}</strong>
                <small>{node.detail}</small>
              </div>
            ))}
          </div>
          <figcaption><span className="route-packet" /> Follow every hop, one step at a time.</figcaption>
        </figure>
      </header>

      <nav className="about-index" aria-label="On this page">
        <span>EXPLORE THE GUIDE</span>
        <a href="#glossary">Glossary <span>15</span></a>
        <a href="#devices">Device roles <span>06</span></a>
        <a href="#cables">Cable standards <span>05</span></a>
        <a href="#tips">Simulator tips <span>04</span></a>
      </nav>

      <section className="about-section" id="glossary">
        <div className="about-section-header">
          <div className="about-section-intro">
            <p className="section-kicker">01 / QUICK REFERENCE</p>
            <h2>Networking Glossary</h2>
            <p>Clear definitions for the terms you’ll meet as you explore.</p>
          </div>
          <label className="about-search-wrap">
            <span className="visually-hidden">Search glossary</span>
            <input
              type="search"
              className="about-search"
              placeholder="Search terms, layers, or definitions"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="about-result-count" aria-live="polite">{filteredGlossary.length} of {GLOSSARY.length}</span>
          </label>
        </div>

        <div className="glossary-chips">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip-btn ${selectedCat === cat ? 'is-active' : ''}`}
              aria-pressed={selectedCat === cat}
              onClick={() => setSelectedCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="glossary-grid">
          {filteredGlossary.length > 0 ? filteredGlossary.map((item, index) => (
            <article key={item.term} className="glossary-card">
              <div className="glossary-card-top">
                <span className="glossary-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="glossary-badge">{item.cat}</span>
              </div>
              <h3>{item.term}</h3>
              <p>{item.def}</p>
            </article>
          )) : (
            <p className="learn-empty">No terms match “{searchTerm}”. Try another term or category.</p>
          )}
        </div>
      </section>

      <section className="about-section" id="devices">
        <div className="about-section-intro">
          <p className="section-kicker">02 / HARDWARE ARCHITECTURE</p>
          <h2>Know who does what.</h2>
          <p>Each device has a distinct job in moving traffic through a network.</p>
        </div>
        <div className="device-guide-grid">
          {DEVICE_GUIDE.map((dev, index) => (
            <article key={dev.name} className="guide-card">
              <div className="guide-card-heading">
                <span className="guide-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="guide-type">{dev.type}</span>
              </div>
              <h3>{dev.name}</h3>
              <p>{dev.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="cables">
        <div className="about-section-intro">
          <p className="section-kicker">03 / PHYSICAL & WIRELESS MEDIA</p>
          <h2>Choose the right connection.</h2>
          <p>Get familiar with the links that carry data between devices.</p>
        </div>
        <div className="cable-guide-grid">
          {CABLE_GUIDE.map((c, index) => (
            <article key={c.name} className="cable-guide-card">
              <div className="cable-guide-mark">
                <span className="cable-indicator" style={{ backgroundColor: c.color }} />
                <span>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div>
                <h4>{c.name}</h4>
                <p>{c.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section tips-box" id="tips">
        <div className="tips-heading">
          <p className="section-kicker">04 / GET HANDS-ON</p>
          <h2>Make the most of the simulator.</h2>
          <p>Small shortcuts make it easier to build and inspect bigger networks.</p>
        </div>
        <ul className="tips-list">

          <li><span className="tip-number">01</span><p><strong>Connect devices</strong>Hold <kbd>Shift</kbd> and drag between devices to draw a connection.</p></li>
          <li><span className="tip-number">02</span><p><strong>Move around</strong>Use <kbd>Ctrl</kbd> + scroll to zoom, or drag empty canvas space to pan.</p></li>
          <li><span className="tip-number">03</span><p><strong>Configure a device</strong>Select a device to edit its IP address, prefix length, and gateway.</p></li>
          <li><span className="tip-number">04</span><p><strong>Inspect packets</strong>Watch the packet details panel to see the Layer 2 and Layer 3 headers.</p></li>
        </ul>
      </section>
    </section>

  );
}

export default About;
