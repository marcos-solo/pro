import { useMemo, useState } from 'react';
import {
  calculateRouteSummary,
  calculateSubnet,
  calculateVlsm,
  parseIpv6,
} from './networkEngine.js';

const COMMON_PRESETS = [
  { label: 'Home LAN (/24)', ip: '192.168.1.1', prefix: 24 },
  { label: 'Medium Office (/22)', ip: '192.168.0.1', prefix: 22 },
  { label: 'Enterprise Campus (/16)', ip: '10.0.0.1', prefix: 16 },
  { label: 'Point-to-Point Link (/30)', ip: '10.254.0.1', prefix: 30 },
  { label: 'Single Host / Loopback (/32)', ip: '192.168.1.100', prefix: 32 },
];

function SubnetCalculator() {
  const [activeTab, setActiveTab] = useState('cidr'); // 'cidr' | 'vlsm' | 'summary' | 'ipv6'

  // Tab 1: CIDR State
  const [ip, setIp] = useState('192.168.1.50');
  const [prefix, setPrefix] = useState(24);

  // Tab 2: VLSM State
  const [vlsmBaseIp, setVlsmBaseIp] = useState('192.168.10.0');
  const [vlsmBasePrefix, setVlsmBasePrefix] = useState(24);
  const [vlsmSubnets, setVlsmSubnets] = useState([
    { id: 1, name: 'Engineering', hostsNeeded: 60 },
    { id: 2, name: 'Sales & Marketing', hostsNeeded: 25 },
    { id: 3, name: 'Support & Ops', hostsNeeded: 14 },
    { id: 4, name: 'P2P WAN Link', hostsNeeded: 2 },
  ]);

  // Tab 3: Route Summary State
  const [summaryInput, setSummaryInput] = useState(
    '192.168.0.0/24\n192.168.1.0/24\n192.168.2.0/24\n192.168.3.0/24',
  );

  // Tab 4: IPv6 State
  const [ipv6Input, setIpv6Input] = useState('2001:db8:85a3::8a2e:370:7334');

  // Computed results
  const result = useMemo(() => calculateSubnet(ip.trim(), prefix), [ip, prefix]);

  const bitArray = useMemo(() => {
    if (!result) return [];
    const binaryStr = result.binaryIp.replace(/\./g, '');
    return binaryStr.split('').map((bit, idx) => ({
      bit,
      isNetwork: idx < prefix,
      isOctetEnd: (idx + 1) % 8 === 0 && idx !== 31,
    }));
  }, [result, prefix]);

  const vlsmResult = useMemo(
    () => calculateVlsm(vlsmBaseIp.trim(), vlsmBasePrefix, vlsmSubnets),
    [vlsmBaseIp, vlsmBasePrefix, vlsmSubnets],
  );

  const summaryResult = useMemo(() => {
    const list = summaryInput.split('\n').map((s) => s.trim()).filter(Boolean);
    return calculateRouteSummary(list);
  }, [summaryInput]);

  const ipv6Result = useMemo(() => parseIpv6(ipv6Input.trim()), [ipv6Input]);

  const addVlsmRow = () => {
    setVlsmSubnets((prev) => [
      ...prev,
      { id: Date.now(), name: `Subnet ${prev.length + 1}`, hostsNeeded: 10 },
    ]);
  };

  const removeVlsmRow = (id) => {
    setVlsmSubnets((prev) => prev.filter((r) => r.id !== id));
  };

  const updateVlsmRow = (id, field, val) => {
    setVlsmSubnets((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  return (
    <section className="page-shell calculator-page">
      <div className="page-heading">
        <div>
          <p className="section-kicker">INTERACTIVE NETWORKING TOOLSUITE</p>
          <h1>IP & Subnet <span>Calculator</span></h1>
          <p>Explore CIDR notation, VLSM planning, supernet route summarization, and IPv6.</p>
        </div>
        <a className="button button-primary" href="/simulator">
          Open in Simulator <span aria-hidden="true">→</span>
        </a>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="calc-nav-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cidr'}
          className={`calc-tab-btn${activeTab === 'cidr' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('cidr')}
        >
          CIDR Calculator
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'vlsm'}
          className={`calc-tab-btn${activeTab === 'vlsm' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('vlsm')}
        >
          VLSM Planner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'summary'}
          className={`calc-tab-btn${activeTab === 'summary' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Route Summarizer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ipv6'}
          className={`calc-tab-btn${activeTab === 'ipv6' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('ipv6')}
        >
          IPv6 Inspector
        </button>
      </div>

      {/* TAB 1: CIDR CALCULATOR */}
      {activeTab === 'cidr' && (
        <>
          <div className="calc-presets">
            <span className="preset-label">Quick Presets:</span>
            {COMMON_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="chip-btn"
                onClick={() => {
                  setIp(p.ip);
                  setPrefix(p.prefix);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="calc-input-card">
            <div className="calc-input-group">
              <label htmlFor="calc-ip">
                IPv4 Address
                <input
                  id="calc-ip"
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  spellCheck="false"
                />
              </label>

              <div className="calc-slider-group">
                <div className="calc-slider-header">
                  <label htmlFor="calc-cidr">
                    CIDR Prefix Length: <strong>/{prefix}</strong>
                  </label>
                  <span className="calc-mask-pill">Mask: {result?.mask ?? 'Invalid'}</span>
                </div>
                <input
                  id="calc-cidr"
                  type="range"
                  min="1"
                  max="32"
                  value={prefix}
                  onChange={(e) => setPrefix(Number(e.target.value))}
                />
                <div className="slider-ticks">
                  <span>/8 (Class A)</span>
                  <span>/16 (Class B)</span>
                  <span>/24 (Class C)</span>
                  <span>/30 (P2P)</span>
                  <span>/32</span>
                </div>
              </div>
            </div>
          </div>

          {result ? (
            <>
              <div className="calc-results-grid">
                <div className="calc-metric-card highlight">
                  <span className="calc-metric-title">NETWORK ADDRESS</span>
                  <strong className="calc-metric-val">{result.network}</strong>
                  <small>Identifier for the entire subnet</small>
                </div>

                <div className="calc-metric-card highlight">
                  <span className="calc-metric-title">BROADCAST ADDRESS</span>
                  <strong className="calc-metric-val">{result.broadcast}</strong>
                  <small>Targets all devices in this subnet</small>
                </div>

                <div className="calc-metric-card">
                  <span className="calc-metric-title">USABLE HOST RANGE</span>
                  <strong className="calc-metric-val">
                    {result.firstHost} – {result.lastHost}
                  </strong>
                  <small>{result.usableHosts.toLocaleString()} usable devices</small>
                </div>

                <div className="calc-metric-card">
                  <span className="calc-metric-title">TOTAL ADDRESSES</span>
                  <strong className="calc-metric-val">{result.totalHosts.toLocaleString()}</strong>
                  <small>
                    2<sup>{32 - prefix}</sup> addresses (
                    {prefix >= 31
                      ? result.totalHosts
                      : `${result.usableHosts} usable + 2 reserved`}
                    )
                  </small>
                </div>

                <div className="calc-metric-card">
                  <span className="calc-metric-title">SUBNET MASK</span>
                  <strong className="calc-metric-val">{result.mask}</strong>
                  <small>Wildcard: {result.wildcard}</small>
                </div>

                <div className="calc-metric-card">
                  <span className="calc-metric-title">CLASSIFICATION & SCOPE</span>
                  <strong className="calc-metric-val">{result.scope}</strong>
                  <small>{result.ipClass}</small>
                </div>
              </div>

              <div className="calc-binary-card">
                <div className="calc-card-heading">
                  <div>
                    <p className="section-kicker">UNDER THE HOOD</p>
                    <h3>Binary Bit Visualization (32-bit IPv4)</h3>
                  </div>
                  <div className="binary-legend">
                    <span className="legend-net"><i /> Network Bits ({prefix})</span>
                    <span className="legend-host"><i /> Host Bits ({32 - prefix})</span>
                  </div>
                </div>

                <div className="binary-stream">
                  {bitArray.map((b, i) => (
                    <div key={i} className="bit-wrapper">
                      <span className={`bit-pill ${b.isNetwork ? 'is-network' : 'is-host'}`}>
                        {b.bit}
                      </span>
                      {b.isOctetEnd && <span className="octet-dot">.</span>}
                    </div>
                  ))}
                </div>

                <div className="binary-sub-labels">
                  <span>Octet 1</span>
                  <span>Octet 2</span>
                  <span>Octet 3</span>
                  <span>Octet 4</span>
                </div>
              </div>

              <div className="calc-slicing-card">
                <p className="section-kicker">SUBNET DIVISION GUIDE</p>
                <h3>How /{prefix} Subdivides</h3>
                <p className="slicing-copy">
                  Borrowing additional host bits increases available subnets while halving the hosts per subnet.
                </p>
                <div className="slicing-table-wrap">
                  <table className="slicing-table">
                    <thead>
                      <tr>
                        <th>Prefix</th>
                        <th>Subnet Mask</th>
                        <th>Subnets Created</th>
                        <th>Total Hosts / Subnet</th>
                        <th>Usable Hosts / Subnet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4]
                        .filter((offset) => prefix + offset <= 32)
                        .map((offset) => {
                          const newPrefix = prefix + offset;
                          const subnets = Math.pow(2, offset);
                          const hosts = newPrefix === 32 ? 1 : Math.pow(2, 32 - newPrefix);
                          const usable = newPrefix >= 31 ? (newPrefix === 31 ? 2 : 1) : Math.max(0, hosts - 2);
                          const maskNum = newPrefix === 0 ? 0 : (0xffffffff << (32 - newPrefix)) >>> 0;
                          const maskStr = [
                            (maskNum >>> 24) & 255,
                            (maskNum >>> 16) & 255,
                            (maskNum >>> 8) & 255,
                            maskNum & 255,
                          ].join('.');
                          return (
                            <tr key={newPrefix} className={offset === 0 ? 'is-current-row' : ''}>
                              <td><strong>/{newPrefix}</strong> {offset === 0 && '(Current)'}</td>
                              <td><code>{maskStr}</code></td>
                              <td>{subnets}</td>
                              <td>{hosts.toLocaleString()}</td>
                              <td><span className="usable-badge">{usable.toLocaleString()}</span></td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="calc-error-box">
              <p>⚠️ Please enter a valid IPv4 address (e.g. <code>192.168.1.1</code>) and prefix (1–32).</p>
            </div>
          )}
        </>
      )}

      {/* TAB 2: VLSM PLANNER */}
      {activeTab === 'vlsm' && (
        <div className="vlsm-planner-container">
          <div className="calc-input-card">
            <div className="calc-card-heading">
              <div>
                <p className="section-kicker">VARIABLE LENGTH SUBNET MASKING</p>
                <h3>Major Network Block</h3>
              </div>
            </div>
            <div className="vlsm-base-row">
              <label>
                Major Network IP
                <input
                  type="text"
                  value={vlsmBaseIp}
                  onChange={(e) => setVlsmBaseIp(e.target.value)}
                  placeholder="192.168.10.0"
                />
              </label>
              <label>
                Prefix Length (/{vlsmBasePrefix})
                <input
                  type="number"
                  min="8"
                  max="30"
                  value={vlsmBasePrefix}
                  onChange={(e) => setVlsmBasePrefix(Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="calc-input-card">
            <div className="vlsm-requests-header">
              <div>
                <h3>Subnet Requirements</h3>
                <p>Add departments or segments. VLSM automatically sorts and allocates optimal subnets without overlaps.</p>
              </div>
              <button type="button" className="button button-secondary" onClick={addVlsmRow}>
                + Add Subnet
              </button>
            </div>

            <div className="vlsm-rows-list">
              {vlsmSubnets.map((sub) => (
                <div key={sub.id} className="vlsm-input-row">
                  <input
                    type="text"
                    value={sub.name}
                    placeholder="Department / Link name"
                    onChange={(e) => updateVlsmRow(sub.id, 'name', e.target.value)}
                  />
                  <div className="vlsm-hosts-input">
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={sub.hostsNeeded}
                      onChange={(e) => updateVlsmRow(sub.id, 'hostsNeeded', Number(e.target.value))}
                    />
                    <span>hosts</span>
                  </div>
                  <button
                    type="button"
                    className="button-icon-del"
                    aria-label="Remove subnet"
                    onClick={() => removeVlsmRow(sub.id)}
                    disabled={vlsmSubnets.length <= 1}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {vlsmResult.error ? (
            <div className="calc-error-box">
              <p>⚠️ {vlsmResult.error}</p>
            </div>
          ) : (
            <div className="calc-slicing-card">
              <div className="vlsm-summary-bar">
                <span>Total Space: <strong>{vlsmResult.baseTotalHosts}</strong></span>
                <span>Allocated: <strong>{vlsmResult.totalAllocatedHosts}</strong></span>
                <span>Remaining: <strong>{vlsmResult.remainingHosts}</strong></span>
              </div>

              <div className="slicing-table-wrap">
                <table className="slicing-table">
                  <thead>
                    <tr>
                      <th>Subnet Name</th>
                      <th>Needed</th>
                      <th>Allocated</th>
                      <th>CIDR Prefix</th>
                      <th>Subnet Mask</th>
                      <th>Network ID</th>
                      <th>Usable Host Range</th>
                      <th>Broadcast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vlsmResult.allocatedSubnets.map((s, idx) => (
                      <tr key={idx}>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.hostsNeeded}</td>
                        <td><span className="usable-badge">{s.usableHosts}</span></td>
                        <td><code>/{s.prefix}</code></td>
                        <td><code>{s.mask}</code></td>
                        <td><code>{s.network}</code></td>
                        <td><code>{s.firstHost} – {s.lastHost}</code></td>
                        <td><code>{s.broadcast}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ROUTE SUMMARIZATION */}
      {activeTab === 'summary' && (
        <div className="route-summary-container">
          <div className="calc-input-card">
            <p className="section-kicker">CIDR AGGREGATION / SUPERNETTING</p>
            <h3>Route Summarizer</h3>
            <p>Paste multiple IP networks (one per line) to calculate the most specific single summary route.</p>
            <textarea
              className="summary-textarea"
              rows="6"
              value={summaryInput}
              onChange={(e) => setSummaryInput(e.target.value)}
              placeholder="192.168.0.0/24&#10;192.168.1.0/24&#10;192.168.2.0/24"
            />
          </div>

          {summaryResult.error ? (
            <div className="calc-error-box">
              <p>⚠️ {summaryResult.error}</p>
            </div>
          ) : (
            <div className="calc-results-grid">
              <div className="calc-metric-card highlight">
                <span className="calc-metric-title">SUMMARY ROUTE (CIDR)</span>
                <strong className="calc-metric-val">{summaryResult.summaryCidr}</strong>
                <small>Consolidated routing table entry</small>
              </div>
              <div className="calc-metric-card">
                <span className="calc-metric-title">SUMMARY SUBNET MASK</span>
                <strong className="calc-metric-val">{summaryResult.summaryMask}</strong>
                <small>Mask prefix /{summaryResult.summaryPrefix}</small>
              </div>
              <div className="calc-metric-card">
                <span className="calc-metric-title">TOTAL ADDRESSES COVERED</span>
                <strong className="calc-metric-val">{summaryResult.coveredAddresses.toLocaleString()}</strong>
                <small>Consolidating {summaryResult.subnetsCount} individual subnets</small>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: IPV6 INSPECTOR */}
      {activeTab === 'ipv6' && (
        <div className="ipv6-inspector-container">
          <div className="calc-input-card">
            <p className="section-kicker">NEXT-GENERATION ADDRESSING</p>
            <h3>IPv6 Inspector & Expansion</h3>
            <p>Enter any 128-bit IPv6 address with or without double-colon compression.</p>
            <input
              type="text"
              value={ipv6Input}
              onChange={(e) => setIpv6Input(e.target.value)}
              placeholder="e.g. 2001:db8::1"
              spellCheck="false"
            />
          </div>

          {ipv6Result ? (
            <>
              <div className="calc-results-grid">
                <div className="calc-metric-card highlight">
                  <span className="calc-metric-title">EXPANDED (128-BIT UNCOMPRESSED)</span>
                  <strong className="calc-metric-val font-mono">{ipv6Result.expanded}</strong>
                  <small>Full 8 hextets without zero suppression</small>
                </div>
                <div className="calc-metric-card">
                  <span className="calc-metric-title">CLASSIFICATION</span>
                  <strong className="calc-metric-val">{ipv6Result.classification}</strong>
                  <small>Address Scope & RFC Definition</small>
                </div>
              </div>

              <div className="calc-binary-card">
                <div className="calc-card-heading">
                  <div>
                    <p className="section-kicker">HEXTET BREAKDOWN</p>
                    <h3>16-Bit Hextet Structure</h3>
                  </div>
                </div>
                <div className="ipv6-hextets-row">
                  {ipv6Result.hextets.map((h, i) => (
                    <div key={i} className="hextet-box">
                      <span className="hextet-index">Hextet {i + 1}</span>
                      <strong className="hextet-val">{h}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="calc-error-box">
              <p>⚠️ Please enter a valid IPv6 address (e.g. <code>2001:db8::1</code> or <code>fe80::1</code>).</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default SubnetCalculator;
