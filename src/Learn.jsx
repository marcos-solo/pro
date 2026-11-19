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
      'Private addresses (192.168.x.x, 10.x.x.x) only work inside your own local network.',
      'Public addresses are globally unique and reachable from the internet.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    quiz: {
      question: 'Which of the following is an example of a private IPv4 address?',
      options: ['8.8.8.8', '192.168.1.15', '93.184.216.34', '1.1.1.1'],
      answer: 1,
      explanation: 'Addresses starting with 192.168.x.x, 10.x.x.x, and 172.16-31.x.x are reserved for private local networks under RFC 1918.',
    },
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
      'Switches connect devices inside a network and forward traffic by MAC address (Layer 2). Routers connect different networks together and forward traffic by IP address (Layer 3). They look similar but do very different jobs.',
    takeaways: [
      'A switch lives inside one local network and forwards frames using MAC addresses.',
      'A router sits between different networks and routes packets using IP addresses.',
      'Your home Wi-Fi box is usually a router, switch, and access point in one casing.',
      'Routers make routing decisions and decrement the TTL (Time-To-Live).',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '192.168.1.20' },
    quiz: {
      question: 'At which network layer does an Ethernet switch primarily operate?',
      options: ['Layer 1 (Physical)', 'Layer 2 (Data Link)', 'Layer 3 (Network)', 'Layer 7 (Application)'],
      answer: 1,
      explanation: 'Standard switches operate at Layer 2 (Data Link), reading hardware MAC addresses to switch Ethernet frames between ports.',
    },
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
      'Every click sends a packet on a journey: out of your device, through your local switch, into your default gateway router, across internet links, and back. Each hop reads the destination address and forwards the packet one step closer.',
    takeaways: [
      'A packet carries small chunks of data with source and destination addresses.',
      'Devices use ARP to learn the local MAC address for the next hop.',
      'Every router decrements TTL by 1 to prevent packets from looping forever.',
      'Replies can follow a symmetrical or completely different return path.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    quiz: {
      question: 'What happens to an IP packet if its TTL (Time-To-Live) reaches 0?',
      options: ['It is sent back to the sender', 'It is dropped to prevent endless loops', 'It is converted to a broadcast', 'It is given highest priority'],
      answer: 1,
      explanation: 'When TTL reaches zero, routers discard the packet and usually reply with an ICMP Time Exceeded message, protecting the internet from infinite routing loops.',
    },
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
  {
    id: 'ports-protocols',
    number: '04',
    title: 'Ports & Protocols (TCP vs. UDP)',
    text: 'Discover how port numbers direct traffic to specific applications.',
    intro:
      'While an IP address finds the computer, a Port number finds the exact software running on it. Think of the IP as the building address, and the port number as the apartment number.',
    takeaways: [
      'Ports range from 0 to 65,535 (Well-known ports are 0–1023).',
      'Port 80 is HTTP, 443 is HTTPS, 53 is DNS, and 22 is SSH.',
      'TCP is reliable and connection-oriented (guarantees delivery via 3-way handshake).',
      'UDP is lightweight and connectionless (best for video streaming, voice, and online gaming).',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    quiz: {
      question: 'Which protocol is ideal for live voice calls or video games where low latency matters more than lost packets?',
      options: ['TCP', 'FTP', 'UDP', 'SMTP'],
      answer: 2,
      explanation: 'UDP does not wait for acknowledgments or retransmit lost data, making it much faster and preferred for real-time media and games.',
    },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="15" y="35" width="80" height="60" rx="8" fill="#f8faf7" stroke="#e2e9e1" />
        <text x="55" y="55" textAnchor="middle" fontSize="10" fill="#2c3a32" fontWeight="600">Client</text>
        <text x="55" y="75" textAnchor="middle" fontSize="8" fill="#6f7d72">Port 51234</text>
        <path d="M95 65 L215 65" stroke="#9eb4a1" strokeWidth="1.5" />
        <text x="155" y="55" textAnchor="middle" fontSize="9" fill="#2f704e" fontWeight="600">TCP Handshake</text>
        <text x="155" y="80" textAnchor="middle" fontSize="8" fill="#6f7d72">SYN → SYN-ACK → ACK</text>
        <rect x="225" y="35" width="80" height="60" rx="8" fill="#f0f4f7" stroke="#e0e8ed" />
        <text x="265" y="55" textAnchor="middle" fontSize="10" fill="#2c3a32" fontWeight="600">Web Server</text>
        <text x="265" y="75" textAnchor="middle" fontSize="8" fill="#2563eb">Port 443 (HTTPS)</text>
      </svg>
    ),
  },
  {
    id: 'subnetting-cidr',
    number: '05',
    title: 'Subnetting & CIDR Notation',
    text: 'Understand how subnet masks divide networks into smaller pieces.',
    intro:
      'Subnetting splits one large network into smaller, manageable subnets. A subnet mask tells devices which part of the IP address represents the network ID and which part represents the host device.',
    takeaways: [
      'CIDR prefix /24 means 24 network bits and 8 host bits (255.255.255.0).',
      'With /24, you have 256 total addresses and 254 usable host addresses.',
      'The first address is the Network Address; the last address is the Broadcast.',
      'Devices compare subnet masks to determine if a destination is local or needs a default gateway.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '192.168.1.1' },
    quiz: {
      question: 'How many usable host IP addresses are in a standard /24 subnet (255.255.255.0)?',
      options: ['256', '255', '254', '128'],
      answer: 2,
      explanation: 'A /24 subnet has 256 addresses (2^8), but 2 are reserved: the network address (.0) and broadcast address (.255), leaving 254 usable hosts.',
    },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="20" y="25" width="280" height="32" rx="6" fill="#f0fdf4" stroke="#86efac" />
        <text x="35" y="45" fontSize="10" fill="#166534" fontWeight="600">Network Portion (24 bits)</text>
        <text x="220" y="45" fontSize="10" fill="#1e40af" fontWeight="600">Host (8 bits)</text>
        <rect x="20" y="65" width="200" height="35" rx="6" fill="#dcfce7" stroke="#4ade80" />
        <text x="120" y="87" textAnchor="middle" fontSize="10" fill="#14532d" fontFamily="SF Mono, monospace">192 . 168 . 1</text>
        <rect x="225" y="65" width="75" height="35" rx="6" fill="#dbeafe" stroke="#93c5fd" />
        <text x="262" y="87" textAnchor="middle" fontSize="10" fill="#1e3a8a" fontFamily="SF Mono, monospace">. 4</text>
      </svg>
    ),
  },
  {
    id: 'dns-resolution',
    number: '06',
    title: 'DNS: The Internet’s Phonebook',
    text: 'How human-friendly domain names become numerical IP addresses.',
    intro:
      'Computers connect using IP addresses, but humans prefer easy names like "example.com". The Domain Name System (DNS) translates domain names into numerical IP addresses in milliseconds.',
    takeaways: [
      'DNS operates primarily over UDP port 53 for speed.',
      'When you request a domain, your device asks a DNS resolver first.',
      'Resolvers query Root servers, TLD servers (.com), and Authoritative servers.',
      'DNS records include A (IPv4), AAAA (IPv6), CNAME (alias), and MX (mail).',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    quiz: {
      question: 'Which DNS record type maps a domain name directly to an IPv4 address?',
      options: ['AAAA record', 'MX record', 'A record', 'TXT record'],
      answer: 2,
      explanation: 'An "A" (Address) record maps a hostname to a 32-bit IPv4 address. "AAAA" is used for 128-bit IPv6 addresses.',
    },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="15" y="40" width="75" height="45" rx="8" fill="#f8faf7" stroke="#e2e9e1" />
        <text x="52" y="62" textAnchor="middle" fontSize="9" fill="#2c3a32">Laptop</text>
        <text x="52" y="75" textAnchor="middle" fontSize="8" fill="#6f7d72">"example.com?"</text>
        <path d="M90 62 L130 62" stroke="#9eb4a1" strokeWidth="1" strokeDasharray="3 3" />
        <rect x="135" y="35" width="80" height="55" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
        <text x="175" y="58" textAnchor="middle" fontSize="9" fill="#1e3a8a" fontWeight="600">DNS Server</text>
        <text x="175" y="74" textAnchor="middle" fontSize="8" fill="#3b82f6">Port 53</text>
        <path d="M215 62 L245 62" stroke="#9eb4a1" strokeWidth="1" strokeDasharray="3 3" />
        <rect x="250" y="40" width="60" height="45" rx="8" fill="#f0fdf4" stroke="#bbf7d0" />
        <text x="280" y="62" textAnchor="middle" fontSize="9" fill="#166534">93.184.x.x</text>
      </svg>
    ),
  },
  {
    id: 'nat-translation',
    number: '07',
    title: 'NAT: Network Address Translation',
    text: 'How hundreds of devices in your home or office share one public IP.',
    intro:
      'Because IPv4 addresses ran short, Network Address Translation (NAT) was created. Your router replaces your private IP with its single public IP when sending traffic out to the internet, and maps return packets back to your device.',
    takeaways: [
      'NAT maps private IPs (192.168.x.x) to a single public IP address.',
      'Port Address Translation (PAT) uses unique port numbers to distinguish devices.',
      'NAT provides inherent basic security by hiding internal network topologies.',
      'Port Forwarding is required when hosting public servers behind a NAT router.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    quiz: {
      question: 'What does a home NAT router modify on an outgoing packet to the internet?',
      options: ['The destination IP', 'The source IP', 'The packet payload', 'The subnet mask'],
      answer: 1,
      explanation: 'NAT rewrites the private source IP (e.g. 192.168.1.4) into the router’s public WAN IP so internet servers can reply back.',
    },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="10" y="45" width="65" height="40" rx="6" fill="#f8faf7" stroke="#e2e9e1" />
        <text x="42" y="64" textAnchor="middle" fontSize="8" fill="#2c3a32">192.168.1.4</text>
        <text x="42" y="77" textAnchor="middle" fontSize="7" fill="#6f7d72">Private LAN</text>
        <path d="M75 65 L115 65" stroke="#9eb4a1" strokeWidth="1" />
        <rect x="120" y="35" width="80" height="60" rx="8" fill="#eff5ed" stroke="#86efac" />
        <text x="160" y="58" textAnchor="middle" fontSize="10" fill="#166534" fontWeight="600">NAT Router</text>
        <text x="160" y="76" textAnchor="middle" fontSize="8" fill="#2f704e">IP Translation</text>
        <path d="M200 65 L240 65" stroke="#9eb4a1" strokeWidth="1" />
        <rect x="245" y="45" width="65" height="40" rx="6" fill="#f0f4f7" stroke="#cbd5e1" />
        <text x="277" y="64" textAnchor="middle" fontSize="8" fill="#1e293b">203.0.113.1</text>
        <text x="277" y="77" textAnchor="middle" fontSize="7" fill="#64748b">Public WAN</text>
      </svg>
    ),
  },
  {
    id: 'network-firewalls',
    number: '08',
    title: 'Firewalls & Network Security',
    text: 'Inspect, filter, and protect networks from unauthorized traffic.',
    intro:
      'A firewall acts as a security checkpoint between trusted internal networks and untrusted external networks. It inspects incoming and outgoing packets and either allows or blocks them based on security rules.',
    takeaways: [
      'Stateless firewalls filter packets based on source/dest IP and port numbers.',
      'Stateful firewalls track active connection states (e.g. TCP handshakes).',
      'Default Deny principle: Block everything unless explicitly allowed.',
      'Firewalls can run in hardware appliances or as software on endpoints.',
    ],
    scenario: { sourceIp: '192.168.1.4', destinationIp: '93.184.216.34' },
    quiz: {
      question: 'What is the best practice "Default Deny" security stance in firewall design?',
      options: ['Allow all traffic except known viruses', 'Block all traffic unless explicitly permitted by a rule', 'Allow only web traffic on port 80', 'Only block incoming ping packets'],
      answer: 1,
      explanation: 'A default-deny policy minimizes security risk by prohibiting all traffic by default and opening only explicitly required ports.',
    },
    svg: (
      <svg viewBox="0 0 320 130" className="lesson-diagram" aria-hidden="true">
        <rect x="15" y="40" width="70" height="50" rx="8" fill="#f8faf7" stroke="#e2e9e1" />
        <text x="50" y="63" textAnchor="middle" fontSize="9" fill="#2c3a32">Untrusted</text>
        <text x="50" y="77" textAnchor="middle" fontSize="8" fill="#dc2626">Internet</text>
        <path d="M85 65 L125 65" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
        <rect x="130" y="30" width="60" height="70" rx="8" fill="#fef2f2" stroke="#fca5a5" />
        <text x="160" y="58" textAnchor="middle" fontSize="16">🛡️</text>
        <text x="160" y="82" textAnchor="middle" fontSize="8" fill="#991b1b" fontWeight="600">FIREWALL</text>
        <path d="M190 65 L230 65" stroke="#22c55e" strokeWidth="1.5" />
        <rect x="235" y="40" width="70" height="50" rx="8" fill="#f0fdf4" stroke="#86efac" />
        <text x="270" y="63" textAnchor="middle" fontSize="9" fill="#166534">Trusted</text>
        <text x="270" y="77" textAnchor="middle" fontSize="8" fill="#15803d">Internal LAN</text>
      </svg>
    ),
  },
];

const STORAGE_KEY = 'netwise.learn.completed';
const QUIZ_STORAGE_KEY = 'netwise.learn.quiz_scores';

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

function loadQuizScores() {
  try {
    const raw = window.localStorage.getItem(QUIZ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveQuizScores(scores) {
  try {
    window.localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(scores));
  } catch {
    /* ignore quota errors */
  }
}

function Learn() {
  const [openId, setOpenId] = useState(getLessonFromUrl);
  const [completed, setCompleted] = useState(loadCompleted);
  const [quizScores, setQuizScores] = useState(loadQuizScores);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    saveCompleted(completed);
  }, [completed]);

  useEffect(() => {
    saveQuizScores(quizScores);
  }, [quizScores]);

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

  const handleQuizAnswer = (lessonId, optionIndex) => {
    const topic = TOPIC_DATA.find((t) => t.id === lessonId);
    if (!topic || !topic.quiz) return;
    const isCorrect = optionIndex === topic.quiz.answer;
    setSelectedAnswers((prev) => ({ ...prev, [lessonId]: optionIndex }));
    setQuizScores((prev) => ({ ...prev, [lessonId]: isCorrect }));
    if (isCorrect) {
      markComplete(lessonId);
    }
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
          <p>8 visual lessons on how the internet, packets, protocols, and security work.</p>
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
            {completedCount} of {TOPIC_DATA.length} completed ({progress}%)
          </span>
        </div>
        <label className="learn-search">
          <span className="visually-hidden">Filter lessons</span>
          <input
            type="search"
            placeholder="Search lessons (e.g., DNS, NAT, ports)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="lesson-list">
        {filtered.length === 0 && (
          <p className="learn-empty">No lessons match "{query}". Try a different search term.</p>
        )}

        {filtered.map((topic) => {
          const topicIndex = TOPIC_DATA.findIndex((item) => item.id === topic.id);
          const isOpen = openId === topic.id;
          const isComplete = completed.includes(topic.id);
          const currentAnswer = selectedAnswers[topic.id];
          const hasAnswered = currentAnswer !== undefined;

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
                {isComplete && <span className="lesson-badge-check" title="Completed">✓</span>}
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

                  {/* Interactive Quick Quiz */}
                  {topic.quiz && (
                    <div className="lesson-quiz">
                      <div className="quiz-header">
                        <span className="quiz-tag">KNOWLEDGE CHECK</span>
                        <h4>{topic.quiz.question}</h4>
                      </div>
                      <div className="quiz-options">
                        {topic.quiz.options.map((opt, optIdx) => {
                          let optClass = 'quiz-option';
                          if (hasAnswered) {
                            if (optIdx === topic.quiz.answer) optClass += ' is-correct';
                            else if (currentAnswer === optIdx) optClass += ' is-wrong';
                          }
                          return (
                            <button
                              key={opt}
                              type="button"
                              className={optClass}
                              onClick={() => handleQuizAnswer(topic.id, optIdx)}
                              disabled={hasAnswered}
                            >
                              <span className="quiz-opt-letter">{String.fromCharCode(65 + optIdx)}</span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                      {hasAnswered && (
                        <div className={`quiz-feedback ${currentAnswer === topic.quiz.answer ? 'feedback-success' : 'feedback-error'}`}>
                          <strong>{currentAnswer === topic.quiz.answer ? '🎉 Correct!' : '❌ Not quite!'}</strong>{' '}
                          {topic.quiz.explanation}
                        </div>
                      )}
                    </div>
                  )}

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
                        ✓ Completed
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
