# Netwise

Netwise is an interactive, browser-only computer networking learning app. It combines visual lessons, quizzes, troubleshooting labs, a packet-routing simulator, and subnet planning tools.

## Features

- 8 visual networking lessons with searchable content and quizzes
- 8 troubleshooting challenges with simulator integration
- Undo/redo, topology presets, autosave, saved topologies, and JSON import/export
- PCAP-style packet capture export
- Interactive device terminals with per-device command history, Tab completion, privilege modes,
  PC/switch/router/firewall commands, persistent IP/routes/VLAN/rule configuration, and CLI challenge checks
- Terminal command palette, inline hints, typo suggestions, structured output, copy/download actions,
  clickable IP values, and capture start/stop/show controls
- Learning XP, streaks, ranks, and challenge progress stored locally
- CIDR, VLSM, route summarization, and IPv6 tools
- Dark and light themes
- Responsive, keyboard-accessible interface

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite.

## Validation

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Project structure

- `src/App.jsx` - application shell and routing
- `src/Learn.jsx` - lessons and quizzes
- `src/Challenges.jsx` - troubleshooting labs
- `src/Simulator.jsx` - interactive topology and packet simulator
- `src/SubnetCalculator.jsx` - IP and subnet planning tools
- `src/networkEngine.js` - packet, subnet, DHCP, DNS, and IPv6 calculations
- `src/progressStore.js` - local XP, streak, lesson, and challenge persistence
- `test/` - Node networking-engine tests

No backend or account is required. User progress and saved topologies remain in browser storage.
