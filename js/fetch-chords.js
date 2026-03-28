// Auto-fetch chords and tab text from AZChords via CORS proxy

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Matches [Em], [G], [Bm], [Cadd9], [F#m], [D/F#] etc.
const CHORD_RE = /\[([A-G][#b]?(?:m(?:aj)?7?|M7|7|9|11|13|dim|aug|sus[24]?|add\d?)?(?:\/[A-G][#b]?)?)\]/g;

async function proxyFetch(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(CORS_PROXY + encodeURIComponent(url), { signal: controller.signal });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseChordText(text) {
  const matches = [...text.matchAll(CHORD_RE)];
  const allFound = [...new Set(matches.map(m => m[1]))];
  // Only keep chords we have diagrams for; drop any slash bass notes
  const known = allFound
    .map(c => c.replace(/\/.*/, '').trim())  // strip /Bass
    .filter(c => CHORDS[c]);
  return {
    known: [...new Set(known)],
    all: allFound,
    text: text.trim(),
  };
}

// --- AZChords fetcher ---
// Tries search type=1 (chord sheets) first, then falls back to general search
async function fetchFromAZChords(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`.trim());

  // Step 1 – search for chord sheet
  let songHref = null;
  for (const searchUrl of [
    `https://www.azchords.com/search/?s=${q}&type=1`,
    `https://www.azchords.com/search/?s=${q}`,
  ]) {
    try {
      const searchHtml = await proxyFetch(searchUrl);
      const sdoc = new DOMParser().parseFromString(searchHtml, 'text/html');
      const link = [...sdoc.querySelectorAll('a[href]')].find(a =>
        /^\/[a-z]\/.+-tabs-\d+\/.+-tabs-\d+\.htm/.test(a.getAttribute('href'))
      );
      if (link) { songHref = link.getAttribute('href'); break; }
    } catch (_) {}
  }

  if (!songHref) return null;

  // Step 2 – fetch the song page
  const songHtml = await proxyFetch('https://www.azchords.com' + songHref);
  const tdoc = new DOMParser().parseFromString(songHtml, 'text/html');

  // Step 3 – find the tab/chord text block
  const pre = tdoc.querySelector('#tab_content')
    || tdoc.querySelector('pre.tab')
    || tdoc.querySelector('pre');
  if (!pre) return null;

  const result = parseChordText(pre.textContent || '');
  if (!result.all.length) return null;
  return result;
}

// --- Chordie fallback ---
async function fetchFromChordie(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  const searchHtml = await proxyFetch(`https://www.chordie.com/search.php?s=${q}`);
  const sdoc = new DOMParser().parseFromString(searchHtml, 'text/html');

  const link = [...sdoc.querySelectorAll('a[href]')].find(a =>
    /\/chord\.php\?id=/.test(a.getAttribute('href') || '')
  );
  if (!link) return null;

  const href = link.getAttribute('href');
  const songUrl = href.startsWith('http') ? href : 'https://www.chordie.com' + href;
  const songHtml = await proxyFetch(songUrl);
  const tdoc = new DOMParser().parseFromString(songHtml, 'text/html');

  const pre = tdoc.querySelector('pre') || tdoc.querySelector('.song');
  if (!pre) return null;

  const result = parseChordText(pre.textContent || '');
  if (!result.all.length) return null;
  return result;
}

// --- Main entry point ---
// Returns { known: string[], all: string[], text: string } or null
async function autoFetchChords(title, artist) {
  const sources = [
    () => fetchFromAZChords(title, artist),
    () => fetchFromChordie(title, artist),
  ];
  for (const source of sources) {
    try {
      const result = await source();
      if (result && result.all.length > 0) return result;
    } catch (_) {}
  }
  return null;
}
