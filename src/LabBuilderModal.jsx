import { useState } from 'react';
import { simulatePacket } from './networkEngine.js';

export function LabBuilderModal({ isOpen, onClose, nodes = [], links = [], onLoadLab }) {
  const [title, setTitle] = useState('My Custom Network Lab');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [category, setCategory] = useState('Routing');
  const [instructions, setInstructions] = useState('Configure the network so that the laptop can successfully ping the web server.');
  const [targetSourceId, setTargetSourceId] = useState(() => nodes[0]?.id || 1);
  const [targetDestId, setTargetDestId] = useState(() => nodes.find((n) => n.id !== nodes[0]?.id)?.id || 2);
  const [requiredVlan, setRequiredVlan] = useState('');
  const [testResult, setTestResult] = useState(null);

  const [savedLabs, setSavedLabs] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem('netwise.simulator.customLabs') || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });

  if (!isOpen) return null;

  const handleTestTopology = () => {
    const srcNode = nodes.find((n) => n.id === Number(targetSourceId));
    const dstNode = nodes.find((n) => n.id === Number(targetDestId));

    if (!srcNode || !dstNode) {
      setTestResult({
        status: 'fail',
        message: 'Please select valid source and destination devices from the current topology.',
      });
      return;
    }

    if (requiredVlan) {
      const vlanNum = Number(requiredVlan);
      const hasVlan = nodes.some((n) => (
        n.type === 'Switch' && (
          n.vlan === vlanNum ||
          (Array.isArray(n.vlans) && n.vlans.some((v) => v.id === vlanNum)) ||
          (Array.isArray(n.interfaces) && n.interfaces.some((i) => i.vlan === vlanNum))
        )
      ));
      if (!hasVlan) {
        setTestResult({
          status: 'fail',
          message: `Requirement Failed: No switch configured with VLAN ${vlanNum}.`,
        });
        return;
      }
    }

    const sim = simulatePacket({
      nodes,
      links,
      sourceId: Number(targetSourceId),
      destinationId: Number(targetDestId),
      twoWay: true,
    });

    if (sim.error) {
      setTestResult({
        status: 'fail',
        message: `Simulation Failed: ${sim.error}`,
      });
    } else {
      setTestResult({
        status: 'pass',
        message: `Objective Verified! ${srcNode.name} successfully reached ${dstNode.name} (Round-trip ping verified).`,
      });
    }
  };

  const handleSaveLab = () => {
    const newLab = {
      id: `lab-${Date.now()}`,
      title,
      difficulty,
      category,
      instructions,
      targetSourceId: Number(targetSourceId),
      targetDestId: Number(targetDestId),
      requiredVlan: requiredVlan ? Number(requiredVlan) : null,
      starterNodes: nodes,
      starterLinks: links,
      createdAt: new Date().toISOString(),
    };
    const updated = [newLab, ...savedLabs.filter((l) => l.title !== title)];
    setSavedLabs(updated);
    try {
      localStorage.setItem('netwise.simulator.customLabs', JSON.stringify(updated));
    } catch {
      // Storage quota or disabled
    }
    setTestResult({ status: 'pass', message: `Lab "${title}" saved to your personal lab library!` });
  };

  const handleExportLab = () => {
    const exportData = {
      title,
      difficulty,
      category,
      instructions,
      targetSourceId: Number(targetSourceId),
      targetDestId: Number(targetDestId),
      requiredVlan: requiredVlan ? Number(requiredVlan) : null,
      starterNodes: nodes,
      starterLinks: links,
      exportedAt: new Date().toISOString(),
      schemaVersion: '1.0',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netwise-lab-${title.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportLab = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const lab = JSON.parse(e.target?.result);
        if (lab.title) setTitle(lab.title);
        if (lab.difficulty) setDifficulty(lab.difficulty);
        if (lab.category) setCategory(lab.category);
        if (lab.instructions) setInstructions(lab.instructions);
        if (lab.targetSourceId) setTargetSourceId(lab.targetSourceId);
        if (lab.targetDestId) setTargetDestId(lab.targetDestId);
        if (lab.requiredVlan) setRequiredVlan(String(lab.requiredVlan));
        if (lab.starterNodes && onLoadLab) {
          onLoadLab(lab);
        }
        setTestResult({ status: 'pass', message: `Imported lab: "${lab.title}"` });
      } catch {
        setTestResult({ status: 'fail', message: 'Invalid lab JSON file format.' });
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteLab = (labId) => {
    const updated = savedLabs.filter((l) => l.id !== labId);
    setSavedLabs(updated);
    try {
      localStorage.setItem('netwise.simulator.customLabs', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="cable-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lab-builder-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cable-modal lab-builder-modal">
        <div className="cable-modal-heading">
          <div>
            <p className="modal-step">INSTRUCTOR & STUDENT TOOL</p>
            <h2 id="lab-builder-title">🛠️ Custom Lab Scenario Builder</h2>
          </div>
          <button className="modal-close" type="button" aria-label="Close modal" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="lab-builder-sub">
          Author interactive networking challenges, set verification conditions, and share them with students or study partners.
        </p>

        <div className="lab-builder-form">
          <div className="lab-builder-row">
            <label>
              Lab Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Inter-VLAN Routing Challenge"
              />
            </label>
            <label>
              Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="Beginner">Beginner (CCST)</option>
                <option value="Intermediate">Intermediate (CCNA)</option>
                <option value="Advanced">Advanced (CCNP)</option>
              </select>
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Routing">Routing</option>
                <option value="Switching">Switching & STP</option>
                <option value="VLANs">VLANs & Trunks</option>
                <option value="Security">Security & ACLs</option>
                <option value="Subnetting">Subnetting & VLSM</option>
              </select>
            </label>
          </div>

          <label>
            Student Instructions & Objective
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Explain the topology problem and what students need to configure..."
            />
          </label>

          <div className="lab-builder-criteria">
            <h4>Verification Criteria (Automated Grading)</h4>
            <div className="lab-builder-row">
              <label>
                Source Device (Ping Origin)
                <select value={targetSourceId} onChange={(e) => setTargetSourceId(Number(e.target.value))}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id} disabled={n.type === 'Switch'}>
                      {n.name} ({n.ip || n.type})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Target Destination Device
                <select value={targetDestId} onChange={(e) => setTargetDestId(Number(e.target.value))}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id} disabled={n.type === 'Switch'}>
                      {n.name} ({n.ip || n.type})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Required VLAN ID (Optional)
                <input
                  type="number"
                  placeholder="e.g. 10 or 20"
                  value={requiredVlan}
                  onChange={(e) => setRequiredVlan(e.target.value)}
                />
              </label>
            </div>
          </div>

          {testResult && (
            <div className={`lab-test-result ${testResult.status}`}>
              <span>{testResult.status === 'pass' ? '✅' : '❌'}</span>
              <p>{testResult.message}</p>
            </div>
          )}

          <div className="lab-builder-actions">
            <button type="button" className="button button-primary" onClick={handleTestTopology}>
              🔍 Test Scenario on Current Canvas
            </button>
            <button type="button" className="button button-secondary" onClick={handleSaveLab}>
              💾 Save to My Labs
            </button>
            <button type="button" className="button button-secondary" onClick={handleExportLab}>
              📥 Export Lab (.json)
            </button>
            <label className="button button-secondary file-upload-btn" title="Import a lab scenario file">
              📤 Import Lab (.json)
              <input type="file" accept=".json" onChange={handleImportLab} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {savedLabs.length > 0 && (
          <div className="saved-labs-section">
            <h4>Saved Custom Labs ({savedLabs.length})</h4>
            <div className="saved-labs-list">
              {savedLabs.map((lab) => (
                <div key={lab.id} className="saved-lab-item">
                  <div className="saved-lab-info">
                    <strong>{lab.title}</strong>
                    <span className="saved-lab-badge">{lab.difficulty} · {lab.category}</span>
                    <p>{lab.instructions}</p>
                  </div>
                  <div className="saved-lab-actions">
                    <button
                      type="button"
                      className="button button-secondary small"
                      onClick={() => onLoadLab && onLoadLab(lab)}
                    >
                      Load onto Canvas
                    </button>
                    <button
                      type="button"
                      className="button button-secondary danger small"
                      onClick={() => handleDeleteLab(lab.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="cable-modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
export default LabBuilderModal;
