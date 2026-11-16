import { useEffect, useMemo, useRef, useState } from 'react';

const initialNodes = [
  { id: 1, name: 'Laptop', type: 'Device', x: 18, y: 48, ip: '192.168.1.4' },
  { id: 2, name: 'Router', type: 'Router', x: 43, y: 48, ip: '192.168.1.1' },
  { id: 3, name: 'Switch', type: 'Switch', x: 67, y: 30, ip: '192.168.1.2' },
  { id: 4, name: 'Web server', type: 'Server', x: 82, y: 68, ip: '93.184.216.34' },
];

const initialLinks = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

const deviceTypes = ['Device', 'Router', 'Switch', 'Server'];
const nodePositions = [
  { x: 15, y: 20 },
  { x: 50, y: 20 },
  { x: 85, y: 20 },
  { x: 15, y: 78 },
  { x: 50, y: 78 },
  { x: 85, y: 78 },
];

const deviceScript = {
  Device: (node) => `Your device sends the packet from ${node.ip}. It needs to reach the destination IP.`,
  Router: () => 'The router receives the packet. It reads the destination IP, looks at its routing table, and decides the next hop.',
  Switch: () => 'The switch receives the packet. It forwards it to the correct port based on the destination MAC address — no IP logic here.',
  Server: () => 'The web server receives the packet, checks the HTTP request, and prepares a response to send back.',
};

const lessonNames = {
  'ip-address': 'IP addresses',
  'routers-switches': 'Routers and switches',
  'follow-packet': 'Follow a packet',
};

function findRoute(nodes, links, sourceId, destinationId) {
  const queue = [[sourceId]];
  const visited = new Set([sourceId]);

  while (queue.length) {
    const route = queue.shift();
    const currentId = route[route.length - 1];
    if (currentId === destinationId) return route;

    const neighbors = links.flatMap(({ from, to }) => (
      from === currentId ? [to] : to === currentId ? [from] : []
    ));

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && nodes.some((node) => node.id === neighbor)) {
        visited.add(neighbor);
        queue.push([...route, neighbor]);
      }
    }
  }

  return [];
}

function getInitialEndpointId(param, fallbackId) {
  const address = new URLSearchParams(window.location.search).get(param);
  return initialNodes.find((node) => node.ip === address)?.id ?? fallbackId;
}

// Clamp a number between min and max
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Snap a percentage to a 5% grid
const snap = (value) => Math.round(value / 5) * 5;

function Simulator() {
  const [nodes, setNodes] = useState(initialNodes);
  const [links, setLinks] = useState(initialLinks);
  const [nextNodeId, setNextNodeId] = useState(5);
  const [selectedNodeId, setSelectedNodeId] = useState(1);
  const [sourceId, setSourceId] = useState(() => getInitialEndpointId('source', 1));
  const [destinationId, setDestinationId] = useState(() => getInitialEndpointId('dest', 4));
  const [newDeviceType, setNewDeviceType] = useState('Device');
  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState(null);
  const [simMessage, setSimMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentHop, setCurrentHop] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Canvas transform (pan + zoom)
  const canvasRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  // Drag state — node being dragged
  const [drag, setDrag] = useState(null); // { nodeId, pointerId, startX, startY, startLeft, startTop, moved }
  // Drag-to-connect state
  const [linkDrag, setLinkDrag] = useState(null); // { fromId, pointerId, currentX, currentY }
  // Canvas pan state
  const [pan, setPan] = useState(null); // { pointerId, startX, startY, startViewX, startViewY }

  const route = useMemo(
    () => findRoute(nodes, links, sourceId, destinationId),
    [nodes, links, sourceId, destinationId],
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const currentNode = route.length ? nodes.find((node) => node.id === route[currentHop]) : null;
  const isDelivered = isRunning && route.length > 0 && currentHop === route.length - 1;
  const activeLesson = new URLSearchParams(window.location.search).get('lesson');

  const resetSimulation = () => {
    setIsRunning(false);
    setCurrentHop(0);
    setIsPaused(false);
  };

  useEffect(() => {
    if (!isRunning || isPaused || isDelivered) return undefined;
    const timer = window.setTimeout(() => {
      setCurrentHop((hop) => Math.min(hop + 1, route.length - 1));
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [isRunning, isPaused, isDelivered, currentHop, route.length]);

  // ---- Convert client coords → canvas % coords (accounts for pan + zoom) ----
  const toCanvasPercent = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const vx = (clientX - rect.left - view.x) / view.scale;
    const vy = (clientY - rect.top - view.y) / view.scale;
    return {
      x: clamp((vx / rect.width) * 100, 0, 100),
      y: clamp((vy / rect.height) * 100, 0, 100),
    };
  };

  // ---- Node drag handlers ----
  const handleNodePointerDown = (event, node) => {
    if (event.button !== 0) return;
    if (connectMode) return; // connect mode uses click logic below
    event.preventDefault();
    event.stopPropagation();
    // Shift+click-drag means "start a link"
    if (event.shiftKey) {
      const point = toCanvasPercent(event.clientX, event.clientY);
      setLinkDrag({ fromId: node.id, pointerId: event.pointerId, currentX: point.x, currentY: point.y });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setSelectedNodeId(node.id);
    setDrag({
      nodeId: node.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: node.x,
      startTop: node.y,
      moved: false,
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
      if (event.shiftKey) {
        nx = snap(nx);
        ny = snap(ny);
      }
      nx = clamp(nx, 4, 96);
      ny = clamp(ny, 6, 94);
      setNodes((current) => current.map((n) => (
        n.id === drag.nodeId ? { ...n, x: nx, y: ny } : n
      )));
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        setDrag((d) => d && { ...d, moved: true });
      }
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

  const handlePointerUp = (event) => {
    if (drag) {
      // Treat small moves as a click (for connect-mode selection)
      if (!drag.moved && connectMode) {
        handleNodeClickForConnect(drag.nodeId);
      }
      setDrag(null);
    }

    if (linkDrag) {
      // Find node under pointer
      const point = toCanvasPercent(event.clientX, event.clientY);
      const hit = nodes.find((n) => (
        Math.abs(n.x - point.x) < 6 && Math.abs(n.y - point.y) < 8
      ));
      if (hit && hit.id !== linkDrag.fromId) {
        const exists = links.some(({ from, to }) => (
          (from === linkDrag.fromId && to === hit.id) || (from === hit.id && to === linkDrag.fromId)
        ));
        if (exists) {
          setSimMessage('Those devices are already connected.');
        } else {
          resetSimulation();
          setLinks((current) => [...current, { from: linkDrag.fromId, to: hit.id }]);
          setSimMessage('Connection added.');
        }
      }
      setLinkDrag(null);
    }

    if (pan) setPan(null);
  };

  // ---- Connect-mode click fallback (works for touch too) ----
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
    const exists = links.some(({ from, to }) => (
      (from === connectFromId && to === nodeId) || (from === nodeId && to === connectFromId)
    ));
    if (exists) {
      setSimMessage('Those devices are already connected.');
    } else {
      resetSimulation();
      setLinks((current) => [...current, { from: connectFromId, to: nodeId }]);
      setSimMessage('Connection added.');
    }
    setConnectFromId(null);
    setConnectMode(false);
  };

  const handleCanvasClick = (event) => {
    // Clicking empty canvas: exit connect mode + deselect nothing
    if (event.target === canvasRef.current || event.target.tagName === 'svg') {
      if (connectMode) {
        setConnectMode(false);
        setConnectFromId(null);
        setSimMessage('');
      }
    }
  };

  const handleWheel = (event) => {
    // Only zoom when Ctrl/Cmd held — otherwise let page scroll
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const delta = -event.deltaY * 0.001;
    const newScale = clamp(view.scale * (1 + delta), 0.5, 2.2);
    // Keep cursor position stable
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
    if (event.target !== canvasRef.current && event.target.tagName !== 'svg' && event.target.tagName !== 'line') return;
    // Spacebar or middle-drag could pan; here: right area — start pan
    if (event.shiftKey) return; // shift-drag is for connecting
    setPan({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewX: view.x,
      startViewY: view.y,
    });
    canvasRef.current.setPointerCapture(event.pointerId);
  };

  // ---- CRUD ----
  const addNode = () => {
    if (nodes.length >= initialNodes.length + nodePositions.length) {
      setSimMessage('Your network is full. Reset it to start a new one.');
      return;
    }
    const id = nextNodeId;
    const position = nodePositions[nodes.length - initialNodes.length];
    const typeLabel = newDeviceType === 'Device' ? 'Device' : newDeviceType;
    const ip = `192.168.1.${10 + id}`;
    resetSimulation();
    setNodes((current) => [
      ...current,
      { id, name: `${typeLabel} ${id}`, type: newDeviceType, ip, ...position },
    ]);
    setLinks((current) => [...current, { from: nodes[nodes.length - 1].id, to: id }]);
    setSelectedNodeId(id);
    setNextNodeId((current) => current + 1);
    setSimMessage('');
  };

  const deleteNode = (id) => {
    if (nodes.length <= 1) {
      setSimMessage('Keep at least one device on the canvas.');
      return;
    }
    resetSimulation();
    setNodes((current) => current.filter((n) => n.id !== id));
    setLinks((current) => current.filter(({ from, to }) => from !== id && to !== id));
    if (selectedNodeId === id) setSelectedNodeId(nodes.find((n) => n.id !== id)?.id ?? 1);
    if (sourceId === id) setSourceId(nodes.find((n) => n.id !== id)?.id ?? 1);
    if (destinationId === id) setDestinationId(nodes.find((n) => n.id !== id)?.id ?? 1);
    setSimMessage('Device removed.');
  };

  const deleteLink = (from, to) => {
    resetSimulation();
    setLinks((current) => current.filter((l) => (
      !((l.from === from && l.to === to) || (l.from === to && l.to === from))
    )));
    setSimMessage('Connection removed.');
  };

  const startTraffic = () => {
    if (sourceId === destinationId) {
      setSimMessage('Choose different source and destination devices.');
      return;
    }
    if (!route.length) {
      setSimMessage('There is no connection between those devices. Connect the network first.');
      return;
    }
    setCurrentHop(0);
    setIsRunning(true);
    setIsPaused(false);
    setSimMessage('');
  };

  const stopTraffic = () => {
    setIsRunning(false);
    setCurrentHop(0);
    setIsPaused(false);
    setSimMessage('');
  };

  const nextHop = () => {
    if (currentHop < route.length - 1) {
      setIsPaused(true);
      setCurrentHop((hop) => hop + 1);
    }
  };

  const prevHop = () => {
    if (currentHop > 0) {
      setIsPaused(true);
      setCurrentHop((hop) => hop - 1);
    }
  };

  const updateSelectedNode = (field, value) => {
    setNodes((current) => current.map((node) => (
      node.id === selectedNodeId ? { ...node, [field]: value } : node
    )));
  };

  const resetNetwork = () => {
    resetSimulation();
    setNodes(initialNodes);
    setLinks(initialLinks);
    setNextNodeId(5);
    setSelectedNodeId(1);
    setSourceId(1);
    setDestinationId(4);
    setNewDeviceType('Device');
    setConnectMode(false);
    setConnectFromId(null);
    setView({ x: 0, y: 0, scale: 1 });
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

  // ---- Render ----
  return (
    <section className="page-shell">
      <div className="page-heading">
        <div>
          <p className="section-kicker">HANDS-ON NETWORKING</p>
          <h1>Your network, <span>your rules.</span></h1>
          <p>Drag devices to arrange them. Shift-drag a device onto another to connect them. Ctrl-scroll to zoom.</p>
          {lessonNames[activeLesson] && (
            <p className="lesson-context">Practice from Learn: <strong>{lessonNames[activeLesson]}</strong></p>
          )}
        </div>
        <div className="sim-actions">
          <label className="visually-hidden" htmlFor="new-device-type">Device type to add</label>
          <select
            id="new-device-type"
            className="device-type-select"
            value={newDeviceType}
            onChange={(event) => setNewDeviceType(event.target.value)}
          >
            {deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <button
            className="button button-secondary"
            type="button"
            onClick={addNode}
            disabled={nodes.length >= initialNodes.length + nodePositions.length}
          >
            ＋ Add
          </button>
          <button
            className={`button ${connectMode ? 'button-primary' : 'button-secondary'}`}
            type="button"
            onClick={() => {
              setConnectMode((enabled) => !enabled);
              setConnectFromId(null);
              setSimMessage(connectMode ? '' : 'Choose two devices on the canvas to connect them.');
            }}
            aria-pressed={connectMode}
          >
            {connectMode ? 'Connecting…' : '＋ Connect'}
          </button>
          <button className="button button-secondary reset-button" type="button" onClick={resetNetwork}>
            Reset
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`network-canvas${isRunning ? ' is-running' : ''}${connectMode ? ' connect-mode' : ''}${drag ? ' is-dragging' : ''}${pan ? ' is-panning' : ''}`}
        aria-label="Network topology canvas"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCanvasClick}
        onPointerDown={handleCanvasPointerDown}
        onWheel={handleWheel}
      >
        <div className="canvas-label">
          <span className="status-dot" />
          {isRunning
            ? isDelivered
              ? 'Packet delivered'
              : `Hop ${currentHop + 1} of ${route.length}`
            : connectMode
              ? connectFromId === null ? 'Select the first device' : 'Select the second device'
              : `${nodes.length} devices · ${links.length} connections`}
        </div>

        <div className="canvas-controls" aria-label="Canvas controls">
          <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in">+</button>
          <span aria-live="polite">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out">−</button>
          <button type="button" onClick={() => setView({ x: 0, y: 0, scale: 1 })} aria-label="Reset canvas view" title="Reset view">↺</button>
        </div>

        <div className="canvas-view" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          <svg className="connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {links.map(({ from, to }) => {
              const fromNode = nodes.find((node) => node.id === from);
              const toNode = nodes.find((node) => node.id === to);
              if (!fromNode || !toNode) return null;
              const isActiveLink = isRunning && route.slice(0, -1).some((id, index) => (
                (id === from && route[index + 1] === to) || (id === to && route[index + 1] === from)
              ));
              const mx = (fromNode.x + toNode.x) / 2;
              const my = (fromNode.y + toNode.y) / 2;
              return (
                <g key={`${from}-${to}`} className={isActiveLink ? 'link-active' : ''}>
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    className="link-hit"
                  />
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                  />
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
                      aria-label={`Remove connection between ${fromNode.name} and ${toNode.name}`}
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

            {/* Live rubber-band line while shift-dragging to connect */}
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
            const routeIndex = route.indexOf(node.id);
            const isCurrent = isRunning && routeIndex === currentHop;
            const isVisited = isRunning && routeIndex !== -1 && routeIndex < currentHop;
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
                  if (connectMode) {
                    handleNodeClickForConnect(node.id);
                  } else {
                    setSelectedNodeId(node.id);
                  }
                }}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                aria-label={`${node.name}, ${node.type}, IP ${node.ip}${isSelected ? ', selected' : ''}`}
                aria-pressed={isSelected}
              >
                <span className="node-symbol" aria-hidden="true">
                  {node.type === 'Router' ? '⌁' : node.type === 'Switch' ? '⇄' : node.type === 'Server' ? '▤' : '◉'}
                </span>
                <span className="node-name">{node.name}</span>
                <span className="node-type">{node.ip}</span>
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
        </div>

        <div className="canvas-hint" aria-hidden="true">
          <span>Drag node · Shift-drag to connect · Ctrl-scroll to zoom</span>
        </div>
      </div>

      <div className="simulator-details">
        <section className="simulator-card packet-setup" aria-label="Packet settings">
          <div className="simulator-card-heading">
            <div><p className="section-kicker">PACKET JOURNEY</p><h2>Choose where it goes</h2></div>
            <span className={`route-status${route.length ? ' route-ready' : ''}`}>
              {route.length ? `${route.length} hops` : 'No route'}
            </span>
          </div>
          <div className="endpoint-selects">
            <label>From
              <select value={sourceId} onChange={handleSelectSource}>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.name} · {node.ip}</option>
                ))}
              </select>
            </label>
            <span className="endpoint-arrow" aria-hidden="true">→</span>
            <label>To
              <select value={destinationId} onChange={handleSelectDestination}>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.name} · {node.ip}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="route-preview" aria-live="polite">
            {route.length
              ? route.map((id) => nodes.find((node) => node.id === id)?.name).filter(Boolean).join('  →  ')
              : 'Connect these devices to create a route.'}
          </div>
          {simMessage && <p className="sim-message" role="status">{simMessage}</p>}
          <div className="packet-card">
            <div className="packet-card-row">
              <span>Source IP</span><code>{nodes.find((node) => node.id === sourceId)?.ip ?? '—'}</code>
            </div>
            <div className="packet-card-row">
              <span>Destination IP</span><code>{nodes.find((node) => node.id === destinationId)?.ip ?? '—'}</code>
            </div>
          </div>
          <div className="lesson-controls">
            {!isRunning ? (
              <button
                className="button button-primary"
                type="button"
                onClick={startTraffic}
                disabled={!route.length || sourceId === destinationId}
              >
                ▶ Send packet
              </button>
            ) : (
              <>
                <button className="button button-secondary" type="button" onClick={prevHop} disabled={currentHop === 0}>
                  ← Back
                </button>
                {!isDelivered && (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setIsPaused((paused) => !paused)}
                  >
                    {isPaused ? '▶ Resume' : 'Ⅱ Pause'}
                  </button>
                )}
                <button className="button button-secondary" type="button" onClick={nextHop} disabled={isDelivered}>
                  Next hop →
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

        <section className="simulator-card node-inspector" aria-label="Selected device settings">
          {selectedNode && (
            <>
              <div className="simulator-card-heading">
                <div><p className="section-kicker">DEVICE DETAILS</p><h2>Edit device</h2></div>
                <span className="inspector-type">{selectedNode.type}</span>
              </div>
              <label>Device name
                <input
                  value={selectedNode.name}
                  onChange={(event) => updateSelectedNode('name', event.target.value)}
                />
              </label>
              <label>IP address
                <input
                  value={selectedNode.ip}
                  onChange={(event) => updateSelectedNode('ip', event.target.value)}
                  inputMode="decimal"
                />
              </label>
              <div className="inspector-actions">
                <button
                  className="button button-secondary danger"
                  type="button"
                  onClick={() => deleteNode(selectedNode.id)}
                  disabled={nodes.length <= 1}
                >
                  Delete device
                </button>
              </div>
              <p className="inspector-hint">Select a device on the canvas to edit its details.</p>
            </>
          )}
        </section>
      </div>

      {isRunning && currentNode && (
        <section className="simulator-card hop-explanation" aria-live="polite" aria-label="Current packet hop">
          <div className="simulator-card-heading">
            <div>
              <p className="section-kicker">
                {isDelivered ? 'DELIVERED' : `HOP ${currentHop + 1} OF ${route.length}`}
              </p>
              <h2>{currentNode.name}</h2>
            </div>
            <span className="inspector-type">{currentNode.type}</span>
          </div>
          <p>
            {isDelivered
              ? `The packet reached ${currentNode.name} at ${currentNode.ip}. A response can now travel back to the source.`
              : (deviceScript[currentNode.type] ?? deviceScript.Device)(currentNode)}
          </p>
          <div className="hop-progress" aria-label={`Step ${currentHop + 1} of ${route.length}`}>
            {route.map((id, index) => (
              <span className={index <= currentHop ? 'is-complete' : ''} key={id} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default Simulator;