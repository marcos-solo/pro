import { useEffect, useState } from 'react';

const TOPIC_DATA = [
  {
    id: 'ip-address',
    number: '01',
    title: 'What is an IP address?',
    text: 'Learn how devices use addresses to find each other on a network.',
    intro:
      'Every device on a network needs an address so packets know where to go. That address is the IP address — a number that identifies one machine, the way a street address identifies one house.',
    takeaways: [
      'An IP address identifies one device on a network.',
      'IPv4 looks like four numbers separated by dots: 192.168.1.4',
      'Private addresses (192.168.x.x, 10.x.x.x) only work inside your own network.',
      'Public addresses are reachable from the internet.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="20" y="40" width="90" height="50" rx="10" fill="#f8faf7" stroke="#e2e9e1" />
        <text x="65" y="62" textAnchor="middle" fontSize="11" fill="#2c3a32" fontFamily="Inter, sans-serif">Laptop</text>
        <text x="65" y="78" textAnchor="middle" fontSize="9" fill="#6f7d72" fontFamily="SF Mono, monospace">192.168.1.4</text>
        <path d="M115 65 L205 65" stroke="#9eb4a1" strokeWidth="1" strokeDasharray="3 3" />
        <rect x="210" y="40" width="90" height="50" rx="10" fill="#f8faf7" stroke="#e2e9e1" />
        <text x="255" y="62" textAnchor="middle" fontSize="11" fill="#2c3a32" fontFamily="Inter, sans-serif">Web server</text>
        <text x="255" y="78" textAnchor="middle" fontSize="9" fill="#6f7d72" fontFamily="SF Mono, monospace">93.184.216.34</text>
        <circle cx="160" cy="65" r="4" fill="#48a86a" />
      </svg>
    ),
  },
  {
    id: 'routers-switches',
    number: '02',
    title: 'Routers and switches',
    text: 'See how network devices move traffic to the right destination.',
    intro:
      'Switches connect devices inside a network and forward traffic by MAC address. Routers connect different networks together and forward traffic by IP address. They look similar but do very different jobs.',
    takeaways: [
      'A switch lives inside one network and uses MAC addresses.',
      'A router sits between networks and uses IP addresses.',
      'Your home router is usually a router + switch + Wi-Fi access point combined.',
      'Routers choose the best path across the internet.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '192.168.1.2' },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="14" y="45" width="70" height="40" rx="9" fill="#f0f4f7" stroke="#e0e8ed" />
        <text x="49" y="69" textAnchor="middle" fontSize="10" fill="#657f98" fontFamily="Inter, sans-serif">Switch</text>
        <rect x="125" y="45" width="70" height="40" rx="9" fill="#eff5ed" stroke="#dce7dc" />
        <text x="160" y="69" textAnchor="middle" fontSize="10" fill="#2f704e" fontFamily="Inter, sans-serif">Router</text>
        <rect x="236" y="45" width="70" height="40" rx="9" fill="#f0f4f7" stroke="#e0e8ed" />
        <text x="271" y="69" textAnchor="middle" fontSize="10" fill="#657f98" fontFamily="Inter, sans-serif">Switch</text>
        <path d="M84 65 L125 65" stroke="#9eb4a1" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M195 65 L236 65" stroke="#9eb4a1" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    id: 'follow-packet',
    number: '03',
    title: 'Follow a packet',
    text: 'Trace what happens when you open a website, one step at a time.',
    intro:
      'Every click sends a packet on a journey: out of your device, through your local network, into your router, across the internet, and back. Each hop reads the destination address and forwards the packet one step closer.',
    takeaways: [
      'A packet carries a small piece of data plus addressing information.',
      'Each device on the path — switch, router, server — hands it to the next.',
      'The return trip can take a different path.',
      'This all happens in milliseconds, thousands of times per page.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="10" y="50" width="60" height="30" rx="7" fill="#f8faf7" stroke="#e2e9e1" />
        <text x="40" y="69" textAnchor="middle" fontSize="9" fill="#2c3a32" fontFamily="Inter, sans-serif">Laptop</text>
        <rect x="95" y="50" width="60" height="30" rx="7" fill="#eff5ed" stroke="#dce7dc" />
        <text x="125" y="69" textAnchor="middle" fontSize="9" fill="#2f704e" fontFamily="Inter, sans-serif">Router</text>
        <rect x="180" y="50" width="60" height="30" rx="7" fill="#f0f4f7" stroke="#e0e8ed" />
        <text x="210" y="69" textAnchor="middle" fontSize="9" fill="#657f98" fontFamily="Inter, sans-serif">Server</text>
        <rect x="265" y="50" width="45" height="30" rx="7" fill="#eaf1ea" stroke="#d4e0d4" />
        <text x="287" y="69" textAnchor="middle" fontSize="9" fill="#2c3a32" fontFamily="Inter, sans-serif">You</text>
        <path d="M70 65 L95 65" stroke="#9eb4a1" strokeWidth="1" />
        <path d="M155 65 L180 65" stroke="#9eb4a1" strokeWidth="1" />
        <path d="M240 65 L265 65" stroke="#9eb4a1" strokeWidth="1" />
        <circle cx="82" cy="65" r="3" fill="#48a86a" />
        <circle cx="167" cy="65" r="3" fill="#48a86a" />
        <circle cx="252" cy="65" r="3" fill="#48a86a" />
      </svg>
    ),
  },
];

const STORAGE_KEY = 'netwise.learn.completed';

function getLessonFromUrl() {
  const searchLesson = new URLSearchParams(window.location.search).get('lesson');
  const hashLesson = window.location.hash.startsWith('#learn/')
    ? window.location.hash.slice('#learn/'.length)
    : null;
  const lessonId = searchLesson ?? hashLesson;
  return TOPIC_DATA.some((topic) => topic.id === lessonId) ? lessonId : null;
}

function loadCompleted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    return Array.isArray(saved)
      ? saved.filter((id) => TOPIC_DATA.some((topic) => topic.id === id))
      : [];
  } catch {
    return [];
  }
}

function saveCompleted(ids) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota errors */
  }
}

function Learn() {
  const [openId, setOpenId] = useState(getLessonFromUrl);
  const [completed, setCompleted] = useState(loadCompleted);
  const [query, setQuery] = useState('');

  useEffect(() => {
    saveCompleted(completed);
  }, [completed]);

  useEffect(() => {
    const syncLesson = () => setOpenId(getLessonFromUrl());
    window.addEventListener('popstate', syncLesson);
    window.addEventListener('hashchange', syncLesson);
    return () => {
      window.removeEventListener('popstate', syncLesson);
      window.removeEventListener('hashchange', syncLesson);
    };
  }, []);

  const filtered = TOPIC_DATA.filter((t) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [t.title, t.text, t.intro, ...t.takeaways].some((value) => value.toLowerCase().includes(q));
  });

  const completedCount = TOPIC_DATA.filter((topic) => completed.includes(topic.id)).length;
  const progress = Math.round((completedCount / TOPIC_DATA.length) * 100);

  const toggleOpen = (id) => {
    const nextId = openId === id ? null : id;
    setOpenId(nextId);
    const hash = nextId ? `#learn/${nextId}` : '';
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${hash}`);
  };

  const markComplete = (id) => {
    const next = completed.includes(id) ? completed : [...completed, id];
    setCompleted(next);
    saveCompleted(next);
  };

  const goToNext = (currentId) => {
    const index = TOPIC_DATA.findIndex((t) => t.id === currentId);
    const next = TOPIC_DATA[index + 1];
    if (next) {
      setQuery('');
      setOpenId(next.id);
      window.history.replaceState({}, '', `${window.location.pathname}#learn/${next.id}`);
    }
  };
  const goToPrev = (currentId) => {
    const index = TOPIC_DATA.findIndex((t) => t.id === currentId);
    const prev = TOPIC_DATA[index - 1];
    if (prev) {
      setQuery('');
      setOpenId(prev.id);
      window.history.replaceState({}, '', `${window.location.pathname}#learn/${prev.id}`);
    }
  };

  return (
    <section className="page-shell learn-page">
      <div className="page-heading">
        <div>
          <p className="section-kicker">A FRIENDLY PLACE TO START</p>
          <h1>Networking, <span>made simple.</span></h1>
          <p>Short guides to the ideas behind the connections you use every day.</p>
        </div>
        <a className="button button-primary" href="/simulator">
          Try what you learn <span aria-hidden="true">→</span>
        </a>
      </div>

      {/* Progress + search row */}
      <div className="learn-toolbar">
        <div
          className="learn-progress"
          role="progressbar"
          aria-label="Learning progress"
          aria-valuemin={0}
          aria-valuemax={TOPIC_DATA.length}
          aria-valuenow={completedCount}
        >
          <div className="learn-progress-bar">
            <div className="learn-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="learn-progress-label">
          {completedCount} of {TOPIC_DATA.length} read
          </span>
        </div>
        <label className="learn-search">
          <span className="visually-hidden">Filter lessons</span>
          <input
            type="search"
            placeholder="Search lessons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="lesson-list">
        {filtered.length === 0 && (
          <p className="learn-empty">No lessons match "{query}". Try a different word.</p>
        )}

        {filtered.map((topic) => {
          const topicIndex = TOPIC_DATA.findIndex((item) => item.id === topic.id);
          const isOpen = openId === topic.id;
          const isComplete = completed.includes(topic.id);
          return (
            <article
              className={`lesson-card${isOpen ? ' is-open' : ''}${isComplete ? ' is-complete' : ''}`}
              key={topic.id}
            >
              <button
                className="lesson-card-head"
                type="button"
                onClick={() => toggleOpen(topic.id)}
                aria-expanded={isOpen}
                aria-controls={`lesson-body-${topic.id}`}
              >
                <span className="lesson-number">{topic.number}</span>
                <div className="lesson-title-block">
                  <h2>{topic.title}</h2>
                  <p>{topic.text}</p>
                </div>
                <span className={`lesson-chevron${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                  ⌄
                </span>
              </button>

              {isOpen && (
                <div className="lesson-body" id={`lesson-body-${topic.id}`}>
                  <div className="lesson-body-grid">
                    <div>
                      <p className="lesson-intro">{topic.intro}</p>
                      <ul className="lesson-takeaways">
                        {topic.takeaways.map((point) => (
                          <li key={point}>
                            <span className="takeaway-check" aria-hidden="true">✓</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="lesson-figure">{topic.svg}</div>
                  </div>

                  <div className="lesson-actions">
                    <a
                      className="button button-primary"
                      href={`/simulator?${new URLSearchParams({
                        lesson: topic.id,
                        source: topic.scenario.sourceIp,
                        dest: topic.scenario.destinationIp,
                      }).toString()}`}
                      onClick={() => markComplete(topic.id)}
                    >
                      Try it in the simulator <span aria-hidden="true">→</span>
                    </a>

                    {!isComplete && (
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => markComplete(topic.id)}
                      >
                        Mark as read
                      </button>
                    )}
                    {isComplete && (
                      <span className="lesson-complete-badge">
                        ✓ Read
                      </span>
                    )}

                    <div className="lesson-pager">
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => goToPrev(topic.id)}
                        disabled={topicIndex === 0}
                        aria-label="Previous lesson"
                      >
                        ←
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => goToNext(topic.id)}
                        disabled={topicIndex === TOPIC_DATA.length - 1}
                        aria-label="Next lesson"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Learn;