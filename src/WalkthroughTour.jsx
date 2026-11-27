import { useState } from 'react';

const TOUR_STEPS = [
  {
    step: 1,
    title: '📦 Packet Tracer Hardware Shelf',
    subtitle: 'Step 1 of 5',
    icon: '🎛️',
    description:
      'Browse network devices and cables in the bottom equipment shelf. Click any hardware to add it to your network, or drag-and-drop devices directly onto the canvas at your exact cursor location.',
    tip: 'Tip: Switch category tabs (Network Devices, End Devices, Wireless, Connections) to find the right hardware.',
  },
  {
    step: 2,
    title: '🌐 Interactive Workspace Canvas',
    subtitle: 'Step 2 of 5',
    icon: '🗺️',
    description:
      'Drag devices to organize your topology. Shift+Drag or use Connect Mode to link interfaces with Straight-Through, Cross-Over, Serial, or Wireless links. Spanning Tree Protocol (STP) will automatically detect loops and display amber blocking LEDs on redundant links.',
    tip: 'Tip: Click "+ Note" in canvas controls to leave color-coded annotations or subnet labels.',
  },
  {
    step: 3,
    title: '💻 Device Inspector & Cisco IOS CLI',
    subtitle: 'Step 3 of 5',
    icon: '🖥️',
    description:
      'Select any device to edit its IP address, subnet mask, and default gateway. Switch to the Terminal tab for an authentic Cisco IOS CLI supporting enable, configure terminal, interface configuration, switchport commands, and show commands.',
    tip: 'Tip: Try `show ip interface brief`, `show ip route`, `show vlan brief`, and `show running-config`.',
  },
  {
    step: 4,
    title: '🦈 Protocol Simulation & Wireshark-Lite',
    subtitle: 'Step 4 of 5',
    icon: '🌊',
    description:
      'Pick a source and destination to simulate ICMP Echo pings or TCP streams. Step through packet forwarding hop-by-hop, observe MAC learning on switches, and open the Wireshark-Lite packet inspector to analyze OSI Layer 2, 3, and 4 headers.',
    tip: 'Tip: Toggle Round-Trip to verify two-way communication and ARP cache resolution.',
  },
  {
    step: 5,
    title: '🛠️ Lab Scenario Builder & Tools',
    subtitle: 'Step 5 of 5',
    icon: '🎓',
    description:
      'Use the Lab Builder to create custom networking challenges with automated grading. Export your topologies as JSON or standalone SVG diagrams, or generate ready-to-paste Cisco IOS configuration scripts.',
    tip: 'Tip: Head over to the Subnet Calculator tab anytime for VLSM planning, CIDR summarization, and IPv6 analysis.',
  },
];

export function WalkthroughTour({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const stepData = TOUR_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  return (
    <div
      className="tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tour-card">
        <div className="tour-card-header">
          <div className="tour-badge-group">
            <span className="tour-step-badge">{stepData.subtitle}</span>
            <span className="tour-icon">{stepData.icon}</span>
          </div>
          <button className="tour-close-btn" type="button" aria-label="Close tour" onClick={onClose}>
            ×
          </button>
        </div>

        <h3 id="tour-step-title">{stepData.title}</h3>
        <p className="tour-description">{stepData.description}</p>

        <div className="tour-tip-box">
          <span className="tour-tip-icon">💡</span>
          <p>{stepData.tip}</p>
        </div>

        <div className="tour-progress-dots" aria-hidden="true">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`tour-dot ${idx === currentStep ? 'is-active' : ''}`}
              onClick={() => setCurrentStep(idx)}
              aria-label={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        <div className="tour-actions">
          <button type="button" className="button button-secondary small" onClick={onClose}>
            Skip Tour
          </button>
          <div className="tour-nav-btns">
            <button
              type="button"
              className="button button-secondary small"
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              ← Back
            </button>
            <button type="button" className="button button-primary small" onClick={handleNext}>
              {currentStep === TOUR_STEPS.length - 1 ? 'Get Started 🚀' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default WalkthroughTour;
