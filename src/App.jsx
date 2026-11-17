import { useEffect, useState } from 'react';
import About from './About.jsx';
import Learn from './Learn.jsx';
import Simulator from './Simulator.jsx';
import './my.css';

const pagePaths = {
  home: '/',
  simulator: '/simulator',
  learn: '/learn',
  about: '/about',
};

function getPage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return Object.entries(pagePaths).find(([, pagePath]) => pagePath === path)?.[0] ?? 'home';
}

function App() {
  const [page, setPage] = useState(getPage);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const syncPage = () => {
      setPage(getPage());
      setMenuOpen(false);
    };
    window.addEventListener('popstate', syncPage);
    return () => window.removeEventListener('popstate', syncPage);
  }, []);

  useEffect(() => {
    const titles = {
      home: 'Netwise — Networking made simple',
      simulator: 'Network Simulator — Netwise',
      learn: 'Learn Networking — Netwise',
      about: 'About Netwise',
    };
    document.title = titles[page];
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
    const nextPage = Object.entries(pagePaths).find(([, path]) => path === destination.pathname)?.[0];
    if (!nextPage) return;

    event.preventDefault();
    window.history.pushState({}, '', `${destination.pathname}${destination.search}${destination.hash}`);
    setPage(nextPage);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app" onClick={navigate}>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Netwise home">
          <img className="brand-mark" src="/logo-mark.svg" alt="" aria-hidden="true" />
          <span>netwise</span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '×' : '☰'}
        </button>
        <nav className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <a className={page === 'simulator' ? 'active' : ''} href="/simulator" aria-current={page === 'simulator' ? 'page' : undefined}>Simulator</a>
          <a className={page === 'learn' ? 'active' : ''} href="/learn" aria-current={page === 'learn' ? 'page' : undefined}>Learn</a>
          <a className={page === 'about' ? 'active' : ''} href="/about" aria-current={page === 'about' ? 'page' : undefined}>About</a>
          <a className="nav-cta" href="/simulator">Try it out <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main>
        {page === 'home' && <HomePage />}
        {page === 'simulator' && <Simulator />}
        {page === 'learn' && <Learn />}
        {page === 'about' && <About />}
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="/">
          <img className="brand-mark" src="/logo-mark.svg" alt="" aria-hidden="true" /><span>netwise</span>
        </a>
        <span>Networking, one connection at a time.</span>
        <a href="/learn">Learning guides <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" /> A little less mystery, a lot more internet</span>
          <h1>See how the<br />internet <span>connects.</span></h1>
          <p>Explore the basics of networking by building a tiny network and watching how its pieces work together.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/simulator">Open the simulator <span aria-hidden="true">→</span></a>
            <a className="text-link" href="/learn">Start with the basics</a>
          </div>
          <div className="hero-note"><span aria-hidden="true">✳</span> Free to explore. No setup needed.</div>
        </div>
        <NetworkPreview />
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
