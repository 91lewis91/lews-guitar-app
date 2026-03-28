// Auto-fetch chords and tab text from chord sites via CORS proxy

// Two proxy services — try primary first, fall back to secondary
const PROXIES = [
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

// Matches [Em], [G], [Bm7], [Cadd9], [F#m], [Bb] etc.
const CHORD_RE = /\[([A-G][#b]?(?:m(?:aj)?7?|M7|7|9|11|13|dim|aug|sus[24]?|add\d?)?)\]/g;

async function proxyFetch(url, timeoutMs = 10000) {
  for (const makeProxy of PROXIES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(makeProxy(url), { signal: controller.signal });
      if (resp.ok) {
        clearTimeout(timer);
        return await resp.text();
      }
    } catch (_) {
      // try next proxy
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('All proxies failed');
}

function parseChordText(text) {
  const matches = [...text.matchAll(CHORD_RE)];
  const all = [...new Set(matches.map(m => m[1]))];
  const known = all.filter(c => CHORDS[c]);
  return { known, all, text: text.trim() };
}

// --- AZChords ---
async function fetchFromAZChords(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`.trim());

  // Try both chord-specific search and general search
  for (const url of [
    `https://www.azchords.com/search/?s=${q}&type=1`,
    `https://www.azchords.com/search/?s=${q}`,
  ]) {
    try {
      const html = await proxyFetch(url);
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // AZChords search result links look like: /s/slipknot-tabs-3673/snuff-tabs-460382.htm
      const link = [...doc.querySelectorAll('a[href]')].find(a => {
        const h = a.getAttribute('href') || '';
        return /^\/[a-z]\/.+-tabs-\d+\/.+-tabs-\d+\.htm/.test(h);
      });
      if (!link) continue;

      const songUrl = 'https://www.azchords.com' + link.getAttribute('href');
      const songHtml = await proxyFetch(songUrl);
      const songDoc = new DOMParser().parseFromString(songHtml, 'text/html');

      // Try several possible selectors for the tab content block
      const block =
        songDoc.getElementById('tab_content') ||
        songDoc.querySelector('pre.tab') ||
        songDoc.querySelector('.tab-content pre') ||
        songDoc.querySelector('pre') ||
        songDoc.querySelector('.song');

      if (!block) continue;

      const result = parseChordText(block.textContent || '');
      if (result.all.length > 0) return result;
    } catch (_) {
      continue;
    }
  }
  return null;
}

// --- Chordie ---
async function fetchFromChordie(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  try {
    const html = await proxyFetch(`https://www.chordie.com/search.php?s=${q}`);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const link = [...doc.querySelectorAll('a[href]')].find(a =>
      /\/chord\.php\?id=/.test(a.getAttribute('href') || '')
    );
    if (!link) return null;

    const href = link.getAttribute('href');
    const songUrl = href.startsWith('http') ? href : 'https://www.chordie.com' + href;
    const songHtml = await proxyFetch(songUrl);
    const songDoc = new DOMParser().parseFromString(songHtml, 'text/html');

    const block = songDoc.querySelector('pre') || songDoc.querySelector('.song');
    if (!block) return null;

    const result = parseChordText(block.textContent || '');
    if (result.all.length > 0) return result;
  } catch (_) {}
  return null;
}

// --- Built-in fallback for common songs ---
// Keyed by "title|artist" (both lowercase, stripped of punctuation)
const KNOWN_SONGS = {
  'snuff|slipknot': {
    known: ['Dm', 'C', 'Bb', 'F'],
    all:   ['Dm', 'C', 'Bb', 'F'],
    text: `Snuff - Slipknot
Main chords: Dm  C  Bb  F
(This progression repeats throughout the whole song)

Verse / Chorus progression:
[Dm]Bury all your [C]secrets in my [Bb]skin
Come a[F]way with [Dm]innocence and leave me [C]with my [Bb]sins
The [F]air around me [Dm]still feels like a [C]cage
And [Bb]love is just a [F]camouflage for [Dm]what resembles [C]rage again

Tip: Start slowly, just switching between Dm → C → Bb → F.
Once that feels comfortable, try matching the rhythm of the recording.`,
    source: 'built-in',
  },
};

function builtInLookup(title, artist) {
  const key = `${title}|${artist}`.toLowerCase().replace(/[^a-z|]/g, '');
  // Exact match
  if (KNOWN_SONGS[key]) return KNOWN_SONGS[key];
  // Partial match — title only
  const titleKey = title.toLowerCase().replace(/[^a-z]/g, '');
  const match = Object.entries(KNOWN_SONGS).find(([k]) => k.split('|')[0] === titleKey);
  return match ? match[1] : null;
}

// --- Main entry point ---
async function autoFetchChords(title, artist) {
  // 1. Check built-in database first (instant, no network)
  const builtin = builtInLookup(title, artist);
  if (builtin) return builtin;

  // 2. Try live fetching
  const sources = [
    () => fetchFromAZChords(title, artist),
    () => fetchFromChordie(title, artist),
  ];
  for (const src of sources) {
    try {
      const result = await src();
      if (result && result.all.length > 0) return result;
    } catch (_) {}
  }

  return null;
}
