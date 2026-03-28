// Auto-fetch chords — built-in library + live scraping fallback

const PROXIES = [
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const CHORD_RE = /\[([A-G][#b]?(?:m(?:aj)?7?|M7|7|9|11|13|dim|aug|sus[24]?|add\d?)?)\]/g;

// ─────────────────────────────────────────────
// Built-in song library
// Keys: simplified "songtitle|artist" (alpha only, lowercase)
// ─────────────────────────────────────────────
const KNOWN_SONGS = {

  'snuff|slipknot': {
    known: ['Dm', 'C', 'Bb', 'F'],
    text: `SNUFF – Slipknot
Chords used: Dm  C  Bb  F
(These four chords repeat for the entire song)

[Dm]Bury all your [C]secrets in my [Bb]skin
Come a[F]way with [Dm]innocence and leave me [C]with my [Bb]sins [F]
The [Dm]air around me [C]still feels like a [Bb]cage
And [F]love is just a [Dm]camouflage for [C]what resembles [Bb]rage again [F]

[Dm]So wash me with your [C]loneliness and [Bb]drown me in your [F]pain
[Dm]I wear a crown of [C]thorns for you [Bb]still [F]

Tip: The chord changes happen roughly every 2 beats.
Start slow — Dm → C → Bb → F — then match the recording.`,
    source: 'library',
  },

  'simpleman|shinedown': {
    known: ['C', 'G', 'Am'],
    text: `SIMPLE MAN – Shinedown (cover of Lynyrd Skynyrd)
Chords used: C  G  Am
(Only three chords — one of the best beginner songs ever written)

Intro: C  G  Am  (x2)

[C]Mama told me [G]when I was young
[Am]Come sit beside me, my [C]only son
[C]Listen closely [G]to what I say
And if you [Am]do this it'll help you some [C]sunny day

[C]Take your time, [G]don't live too fast
[Am]Troubles will come [C]and they will pass
[C]Go find a woman, [G]you'll find love
And [Am]don't forget son, there is [C]someone up above

Chorus:
[C]And be a simple [G]kind of man
[Am]Be something you love and [C]understand
[C]Baby be a simple [G]kind of man
[Am]Oh won't you do this for me [C]son, if you can

Tip: This song is mostly slow strumming.
Try down-down-up-down on each chord before moving on.`,
    source: 'library',
  },

  'simpleman|lynyrdskynyrd': {
    known: ['C', 'G', 'Am'],
    text: `SIMPLE MAN – Lynyrd Skynyrd
Chords used: C  G  Am
(Same chords as the Shinedown version — see above)`,
    source: 'library',
  },

  'itsbeenawhile|staind': {
    known: ['Am', 'G', 'C', 'D'],
    text: `IT'S BEEN AWHILE – Staind
Chords used: Am  G  C  D
(Acoustic-friendly arrangement in standard tuning)

Intro / Verse:
[Am]And it's been a[G]while
Since I could [C]hold my head up [D]high
[Am]And it's been a[G]while
Since I first [C]saw you [D]

[Am]And it's been a[G]while
Since I could [C]stand on my own two [D]feet again
[Am]And it's been a[G]while
Since I could [C]call this my own [D]

Chorus:
[Am]But everything I can't re[G]member
As [C]fucked up as it all may [D]seem
The [Am]consequences that I've [G]rendered
I've [C]stretched myself beyond my [D]means

Tip: The Am → G → C → D cycle repeats throughout.
Strum slowly and focus on clean chord changes first.`,
    source: 'library',
  },

  'outside|staind': {
    known: ['Am', 'F', 'C', 'G'],
    text: `OUTSIDE – Staind
Chords used: Am  F  C  G
(Acoustic arrangement, standard tuning)

Verse:
[Am]And you [F]bring me to my [C]knees [G]
[Am]And you [F]bring me to my [C]knees [G]

[Am]I've got a [F]big mouth but I [C]don't know what to [G]say
[Am]But I'm [F]here to talk you [C]down [G]

Chorus:
[Am]But I'm on the out[F]side, I'm looking [C]in
I can [G]see through you, see your [Am]true colours
[F]'Cause inside you're [C]ugly, you're ugly like [G]me
I can [Am]see through you, [F]see to the [C]real you [G]

Tip: Am and F together are a classic pairing.
The F chord is tricky at first — keep practising it.`,
    source: 'library',
  },

  'wishyouwerehere|pinkfloyd': {
    known: ['G', 'Em', 'C', 'D', 'A'],
    text: `WISH YOU WERE HERE – Pink Floyd
Chords used: G  Em  C  D  A
(One of the most beautiful acoustic songs to learn)

Intro fingerpicking pattern (slow):
Em  G  Em  G  A  Em  A  G

Verse:
[G]So, so you think you can [Em]tell
Heaven from [C]hell, blue skies from [D]pain
Can you tell a [G]green field from a cold steel [Em]rail?
A smile from a [C]veil? Do you think you can [D]tell?

[G]Did they get you to trade your heroes for [Em]ghosts?
Hot ashes for [C]trees? Hot air for a [D]cool breeze?
Cold comfort for [G]change? And did you exchange
a walk-on [Em]part in the war
For a [C]lead role in a [D]cage?

Chorus:
[Em]How I wish, how I wish you were [G]here
[A]We're just two lost souls swimming in a fish bowl
Year after [Em]year
Running over the [G]same old ground
What have we [C]found? The same old [D]fears
Wish you were [G]here

Tip: Great song for learning fingerpicking.
Start by just strumming the chords slowly.`,
    source: 'library',
  },

  'nothingelsematters|metallica': {
    known: ['Em', 'Am', 'C', 'G', 'D'],
    text: `NOTHING ELSE MATTERS – Metallica
Chords used: Em  Am  C  G  D
(Acoustic ballad — easier than it sounds)

Intro (fingerpicking on open Em shape):
Em  Em  Em  Em

Verse:
[Em]So close, no matter how [Em]far
Couldn't be much [Am]more from the heart
Forever [C]trusting who we [G]are
And nothing else [Em]matters

[Em]Never opened myself [Em]this way
Life is ours, we [Am]live it our way
All these [C]words I don't just [G]say
And nothing else [Em]matters

Pre-chorus:
[Am]Trust I seek and I [C]find in you
[G]Every day for us something [D]new
[Am]Open mind for a [C]different view
And [D]nothing else matters [Em]

Tip: The iconic intro is all on open strings.
Just let your fingers rest in an Em shape and pluck strings 6,5,4,3,4,5.`,
    source: 'library',
  },

  'wonderwall|oasis': {
    known: ['Em', 'G', 'Dsus2', 'A'],
    text: `WONDERWALL – Oasis
Chords used: Em  G  Dsus2  A
(The classic beginner song — billions of people learned guitar on this)

Verse:
[Em]Today is [G]gonna be the day
That they're [Dsus2]gonna throw it [A]back to you
[Em]By now you [G]should've somehow
Re[Dsus2]alised what you [A]gotta do
[Em]I don't be[G]lieve that any[Dsus2]body
Feels the way I [A]do about you now

Chorus:
[G]And all the roads we have to [Dsus2]walk are [Em]winding
And all the [G]lights that lead us there are [Dsus2]blinding [Em]
There are many [G]things that I would [Dsus2]like to say to you
But I don't know [A]how
Because [Em]maybe [G]
You're gonna be the one that [Dsus2]saves me [A]
And after [Em]all [G]
You're my wonder[Dsus2]wall [A]

Tip: Keep your fingers in roughly the same position for Em and G.
The chord changes are very close together in timing.`,
    source: 'library',
  },

};

// ─────────────────────────────────────────────
// Fuzzy lookup — matches even if YouTube title
// has extra words like "Official Video", "Lyrics" etc.
// ─────────────────────────────────────────────
function builtInLookup(title, artist) {
  // Combine title + artist into one searchable string, alpha only
  const haystack = `${title} ${artist}`.toLowerCase().replace(/[^a-z ]/g, ' ');

  for (const [key, data] of Object.entries(KNOWN_SONGS)) {
    const [keyTitle, keyArtist] = key.split('|');
    // Both the song title keywords AND artist keywords must appear somewhere in the haystack
    const titleWords  = keyTitle.match(/[a-z]+/g) || [];
    const artistWords = keyArtist ? keyArtist.match(/[a-z]+/g) || [] : [];
    const allWords    = [...titleWords, ...artistWords];
    if (allWords.length > 0 && allWords.every(w => haystack.includes(w))) {
      return data;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Live scraping fallback (AZChords / Chordie)
// ─────────────────────────────────────────────
async function proxyFetch(url, timeoutMs = 10000) {
  for (const makeProxy of PROXIES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(makeProxy(url), { signal: controller.signal });
      if (resp.ok) { clearTimeout(timer); return await resp.text(); }
    } catch (_) {}
    finally { clearTimeout(timer); }
  }
  throw new Error('All proxies failed');
}

function parseChordText(text) {
  const matches = [...text.matchAll(CHORD_RE)];
  const all   = [...new Set(matches.map(m => m[1]))];
  const known = all.filter(c => CHORDS[c]);
  return { known, all, text: text.trim() };
}

async function fetchFromAZChords(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  for (const url of [
    `https://www.azchords.com/search/?s=${q}&type=1`,
    `https://www.azchords.com/search/?s=${q}`,
  ]) {
    try {
      const html = await proxyFetch(url);
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const link = [...doc.querySelectorAll('a[href]')].find(a =>
        /^\/[a-z]\/.+-tabs-\d+\/.+-tabs-\d+\.htm/.test(a.getAttribute('href') || '')
      );
      if (!link) continue;
      const songHtml = await proxyFetch('https://www.azchords.com' + link.getAttribute('href'));
      const songDoc  = new DOMParser().parseFromString(songHtml, 'text/html');
      const block    = songDoc.getElementById('tab_content')
        || songDoc.querySelector('pre.tab')
        || songDoc.querySelector('pre');
      if (!block) continue;
      const result = parseChordText(block.textContent || '');
      if (result.all.length > 0) return result;
    } catch (_) { continue; }
  }
  return null;
}

async function fetchFromChordie(title, artist) {
  try {
    const q    = encodeURIComponent(`${title} ${artist}`.trim());
    const html = await proxyFetch(`https://www.chordie.com/search.php?s=${q}`);
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const link = [...doc.querySelectorAll('a[href]')].find(a =>
      /\/chord\.php\?id=/.test(a.getAttribute('href') || '')
    );
    if (!link) return null;
    const href    = link.getAttribute('href');
    const songUrl = href.startsWith('http') ? href : 'https://www.chordie.com' + href;
    const sHtml   = await proxyFetch(songUrl);
    const sDoc    = new DOMParser().parseFromString(sHtml, 'text/html');
    const block   = sDoc.querySelector('pre') || sDoc.querySelector('.song');
    if (!block) return null;
    const result  = parseChordText(block.textContent || '');
    if (result.all.length > 0) return result;
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────
// Main entry — library first, then live fetch
// ─────────────────────────────────────────────
async function autoFetchChords(title, artist) {
  const builtin = builtInLookup(title, artist);
  if (builtin) return builtin;

  for (const src of [
    () => fetchFromAZChords(title, artist),
    () => fetchFromChordie(title, artist),
  ]) {
    try {
      const result = await src();
      if (result && result.all.length > 0) return result;
    } catch (_) {}
  }
  return null;
}
