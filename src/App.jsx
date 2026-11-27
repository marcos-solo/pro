import { useEffect, useState } from 'react';
import About from './About.jsx';
import Challenges from './Challenges.jsx';
import Learn from './Learn.jsx';
import Simulator from './Simulator.jsx';
import SubnetCalculator from './SubnetCalculator.jsx';
import { isSoundEnabled, toggleSound } from './soundEngine.js';
import { loadProfile } from './progressStore.js';
import './my.css';

const pagePaths = {
  home: '/',
  simulator: '/simulator',
  learn: '/learn',
  challenges: '/challenges',
  calculator: '/calculator',
  about: '/about',
};

function getPage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return Object.entries(pagePaths).find(([, pagePath]) => pagePath === path)?.[0] ?? 'home';
}

function App() {
  const [page, setPage] = useState(getPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundActive, setSoundActive] = useState(isSoundEnabled);

  // Dark / Light Theme
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem('netwise.theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('netwise.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const syncPage = () => {
      setPage(getPage());
      setMenuOpen(false);
    };
    window.addEventListener('popstate', syncPage);
    return () => window.removeEventListener('popstate', syncPage);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = document.querySelectorAll('#primary-navigation a[href], #primary-navigation button:not(:disabled)');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.getElementById('mobile-nav-close')?.focus();
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      document.getElementById('menu-toggle')?.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    const titles = {
      home: 'Netwise — Networking made simple',
      simulator: 'Network Simulator — Netwise',
      learn: 'Learn Networking — Netwise',
      challenges: 'Fix the Network Challenges — Netwise',
      calculator: 'Subnet Calculator & VLSM — Netwise',
      about: 'About Netwise & Glossary',
    };
    document.title = titles[page] || 'Netwise — Networking made simple';
  }, [page]);

  const navigate = (event) => {
    const anchor = event.target.closest('a[href]');
    if (
      !anchor
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || anchor.target
    ) return;

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const destinationPath = destination.pathname.replace(/\/+$/, '') || '/';
    if (destinationPath === currentPath && destination.hash) return;
    const nextPage = Object.entries(pagePaths).find(([, path]) => path === destination.pathname)?.[0];
    if (!nextPage) return;

    event.preventDefault();
    window.history.pushState({}, '', `${destination.pathname}${destination.search}${destination.hash}`);
    setPage(nextPage);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className={`app theme-${theme}`} onClick={navigate}>
      <header className={`site-header-wrapper${menuOpen ? ' menu-open' : ''}`}>
        <div className="site-header">
          <a className="brand" href="/" aria-label="Netwise home">
            <img className="brand-mark" src="/logo-mark.svg" alt="" aria-hidden="true" />
            <span>netwise</span>
          </a>

          <div className="header-quick-toggles">
            <button
              type="button"
              className="quick-toggle-btn theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button
              type="button"
              className="quick-toggle-btn sound-toggle"
              aria-label={soundActive ? 'Mute sound effects' : 'Enable sound effects'}
              title={soundActive ? 'Mute sound effects' : 'Enable sound effects'}
              onClick={() => setSoundActive(toggleSound())}
            >
              {soundActive ? '🔊' : '🔇'}
            </button>
          </div>

          <button
            id="menu-toggle"
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '×' : '☰'}
          </button>

          <nav id="primary-navigation" className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <div className="mobile-nav-heading">
              <span>MENU</span>
              <button id="mobile-nav-close" className="mobile-nav-close" type="button" onClick={() => setMenuOpen(false)}>
                Close <span aria-hidden="true">×</span>
              </button>
            </div>
            <a className={page === 'simulator' ? 'active' : ''} href="/simulator" aria-current={page === 'simulator' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Simulator</a>
            <a className={page === 'learn' ? 'active' : ''} href="/learn" aria-current={page === 'learn' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Learn</a>
            <a className={page === 'challenges' ? 'active' : ''} href="/challenges" aria-current={page === 'challenges' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Challenges</a>
            <a className={page === 'calculator' ? 'active' : ''} href="/calculator" aria-current={page === 'calculator' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Calculator</a>
            <a className={page === 'about' ? 'active' : ''} href="/about" aria-current={page === 'about' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>About</a>
            <a className="nav-cta" href="/simulator" onClick={() => setMenuOpen(false)}>Try it out <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
        <button
          className="mobile-menu-backdrop"
          type="button"
          aria-label="Dismiss menu backdrop"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
        />
      </header>

      <main>
        {page === 'home' && <HomePage />}
        {page === 'simulator' && <Simulator />}
        {page === 'learn' && <Learn />}
        {page === 'challenges' && <Challenges />}
        {page === 'calculator' && <SubnetCalculator />}
        {page === 'about' && <About />}
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="/">
          <img className="brand-mark" src="/logo-mark.svg" alt="" aria-hidden="true" /><span>netwise</span>
        </a>
        <div className="footer-links">
          <a href="/simulator">Simulator</a>
          <a href="/learn">8 Lessons</a>
          <a href="/challenges">8 Troubleshooting Labs</a>
          <a href="/calculator">Subnet & VLSM Calculator</a>
          <a href="/about">Glossary & Hardware</a>
        </div>
        <span>Networking, one connection at a time.</span>
      </footer>
    </div>
  );
}

function HomePage() {
  const profile = loadProfile();
  const lessonProgress = profile.completedLessons.length;
  const challengeProgress = profile.solvedChallenges.length;
  const weakLesson = Object.entries(profile.quizScores).find(([, correct]) => !correct)?.[0];
  const recommendedHref = weakLesson
    ? `/learn?lesson=${encodeURIComponent(weakLesson)}`
    : lessonProgress < 8
      ? '/learn'
      : challengeProgress < 8
        ? '/challenges'
        : '/simulator';
  const rank = (profile.xp || 0) >= 500
    ? 'Network Specialist'
    : (profile.xp || 0) >= 200
      ? 'Network Explorer'
      : 'New Learner';

  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" /> A little less mystery, a lot more internet</span>
          <h1>See how the<br />internet <span>connects.</span></h1>
          <p>Explore computer networking interactively. Build topologies, step through ARP and routing hops, troubleshoot real issues, inspect decapsulated packets in real time, and calculate VLSM subnets.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/simulator">Open the simulator <span aria-hidden="true">→</span></a>
            <a className="text-link" href="/challenges">Fix the Network Labs (8)</a>
          </div>
          <div className="hero-note"><span aria-hidden="true">✳</span> Free to explore. 100% in-browser, no setup required.</div>
        </div>
        <NetworkPreview />
      </section>

      <section className="home-progress-dashboard" aria-label="Your learning progress">
        <div>
          <span className="dashboard-kicker">YOUR JOURNEY</span>
          <strong>{rank}</strong>
          <small>{profile.xp || 0} XP · {profile.streak || 0} day streak</small>
        </div>
        <div className="dashboard-metric">
          <strong>{lessonProgress}/8</strong>
          <span>Lessons</span>
        </div>
        <div className="dashboard-metric">
          <strong>{challengeProgress}/8</strong>
          <span>Labs solved</span>
        </div>
        <a className="button button-secondary" href={recommendedHref}>
          Continue learning <span aria-hidden="true">→</span>
        </a>
      </section>

      {/* Feature Pillars */}
      <section className="home-feature-pillars">
        <a href="/simulator" className="feature-pillar-card">
          <span className="pillar-icon">🌐</span>
          <h3>Interactive Simulator</h3>
          <p>Drag devices, wire cables, trace packets, run curl/ping terminal commands, and inspect live packet headers.</p>
          <span className="pillar-link">Open Canvas →</span>
        </a>

        <a href="/learn" className="feature-pillar-card">
          <span className="pillar-icon">📖</span>
          <h3>8 Visual Lessons & Quizzes</h3>
          <p>From IP addresses and switches to TCP/UDP, DNS, NAT, and firewalls with instant knowledge checks.</p>
          <span className="pillar-link">Start Learning →</span>
        </a>

        <a href="/challenges" className="feature-pillar-card">
          <span className="pillar-icon">🛠️</span>
          <h3>8 Troubleshooting Labs</h3>
          <p>Solve broken uplinks, mismatched subnets, missing gateways, firewall ACLs, routing loops, and DHCP leases.</p>
          <span className="pillar-link">Solve Labs →</span>
        </a>

        <a href="/calculator" className="feature-pillar-card">
          <span className="pillar-icon">🔢</span>
          <h3>Subnet & VLSM Planner</h3>
          <p>Visualize 32-bit binary masks, plan multi-department VLSM allocations, summarize routes, and inspect IPv6.</p>
          <span className="pillar-link">Calculate CIDR →</span>
        </a>
      </section>

      <section className="home-bottom">
        <p className="section-kicker">NETWORKING, WITHOUT THE HEADACHE</p>
        <div className="bottom-row">
          <h2>Big ideas. Tiny steps.</h2>
          <p>Start with a few familiar devices. Connect them, follow the flow, and learn by seeing it happen.</p>
          <a className="round-link" href="/learn" aria-label="Explore learning guides">→</a>
        </div>
      </section>
    </>
  );
}

function NetworkPreview() {
  return (
    <div className="preview-wrap" aria-label="A simple network connecting a laptop to the internet">
      <div className="preview-card">
        <div className="preview-top">
          <span className="preview-title">A network in a nutshell</span>
          <span className="preview-live"><i /> LIVE</span>
        </div>
        <div className="preview-diagram">
          <div className="preview-line line-one" />
          <div className="preview-line line-two" />
          <div className="preview-line line-three" />
          <div className="preview-node laptop-node"><span>▱</span><small>Your laptop</small></div>
          <div className="preview-node router-node"><span>⌁</span><small>Router</small></div>
          <div className="preview-node web-node"><span>▤</span><small>Web server</small></div>
          <div className="internet-cloud"><span>☁</span><small>Internet</small></div>
          <span className="preview-packet" />
        </div>
        <div className="preview-caption"><span className="caption-dot" /> Every click starts a journey.</div>
      </div>
      <div className="floating-note">
        <span>↗</span>
        <div><strong>One connection</strong><small>Endless possibilities</small></div>
      </div>
    </div>
  );
}

export default App;
