// Teacher — chord diagrams, tab display, learn view

// ---- Chord diagram SVG renderer ----
function renderChordDiagram(chordName) {
  const chord = CHORDS[chordName];
  if (!chord) return '';

  const W = 120, H = 140;
  const padLeft = 18, padTop = 30, padRight = 10;
  const stringSpacing = 16;
  const fretSpacing = 18;
  const numStrings = 6;
  const numFrets = 4;
  const dotR = 6;

  // Determine fret window
  const minFret = Math.min(...chord.frets.filter(f => f > 0));
  const startFret = (chord.barre?.fret) || (minFret > 0 ? minFret : 1);
  const showNut = startFret === 1;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="chord-svg">`;

  // Chord name label
  svg += `<text x="${padLeft + (numStrings-1)*stringSpacing/2}" y="18" text-anchor="middle" class="chord-label">${escHtml(chordName)}</text>`;

  // Nut or fret position indicator
  if (showNut) {
    svg += `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft + (numStrings-1)*stringSpacing}" y2="${padTop}" stroke="var(--text)" stroke-width="4"/>`;
  } else {
    svg += `<text x="${padLeft + (numStrings-1)*stringSpacing + 6}" y="${padTop + fretSpacing/2}" class="fret-num">${startFret}fr</text>`;
  }

  // Fret lines
  for (let f = 0; f <= numFrets; f++) {
    const y = padTop + f * fretSpacing;
    const w = (f === 0 && showNut) ? 1 : 1;
    svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + (numStrings-1)*stringSpacing}" y2="${y}" stroke="var(--surface3)" stroke-width="${w}"/>`;
  }

  // String lines
  for (let s = 0; s < numStrings; s++) {
    const x = padLeft + s * stringSpacing;
    svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + numFrets * fretSpacing}" stroke="var(--surface3)" stroke-width="1"/>`;
  }

  // Barre bar
  if (chord.barre) {
    const b = chord.barre;
    const fretPos = b.fret - startFret;
    const y = padTop + fretPos * fretSpacing - fretSpacing / 2;
    const x1 = padLeft + b.fromString * stringSpacing;
    const x2 = padLeft + b.toString * stringSpacing;
    svg += `<rect x="${x1 - dotR}" y="${y - dotR + 1}" width="${x2 - x1 + 2*dotR}" height="${dotR*2}" rx="${dotR}" fill="var(--accent)" opacity="0.85"/>`;
  }

  // Finger dots + O/X markers
  for (let s = 0; s < numStrings; s++) {
    const x = padLeft + s * stringSpacing;
    const fret = chord.frets[s];

    if (fret === -1) {
      // Muted
      svg += `<text x="${x}" y="${padTop - 8}" text-anchor="middle" class="ox-label muted">✕</text>`;
    } else if (fret === 0) {
      // Open
      svg += `<circle cx="${x}" cy="${padTop - 9}" r="5" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"/>`;
    } else {
      // Finger dot
      const fretPos = fret - startFret;
      const y = padTop + fretPos * fretSpacing - fretSpacing / 2;
      // Skip if already covered by barre
      const isBarre = chord.barre &&
        fret === chord.barre.fret &&
        s >= chord.barre.fromString &&
        s <= chord.barre.toString;
      if (!isBarre) {
        svg += `<circle cx="${x}" cy="${y}" r="${dotR}" fill="var(--accent)"/>`;
        if (chord.fingers && chord.fingers[s]) {
          svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" class="finger-num">${chord.fingers[s]}</text>`;
        }
      }
    }
  }

  svg += '</svg>';
  return svg;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Learn view ----
let currentSongId = null;
let autoScrollInterval = null;
let autoScrollSpeed = 40; // px/sec

function openLearnView(songId) {
  currentSongId = songId;
  const song = getSong(songId);
  if (!song) return;

  // Switch to learn tab
  showView('learn');
  updateNavActive('learn');

  renderLearnView(song);
}

function renderLearnView(song) {
  const view = document.getElementById('view-learn');

  // Build embed
  let embedHtml = '';
  if (song.youtubeId) {
    embedHtml = `<div class="video-container">
      <iframe src="https://www.youtube.com/embed/${song.youtubeId}?rel=0"
        frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
    </div>`;
  } else if (song.spotifyId) {
    embedHtml = `<div class="spotify-container">
      <iframe src="https://open.spotify.com/embed/track/${song.spotifyId}"
        frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture">
      </iframe>
    </div>`;
  }

  view.innerHTML = `
    <div class="learn-header">
      <button id="back-to-songs" class="back-btn">← Songs</button>
      <div class="learn-title">
        <div class="learn-song-title">${escHtml(song.title)}</div>
        <div class="learn-song-artist">${escHtml(song.artist)}</div>
      </div>
    </div>

    ${embedHtml}

    <div class="learn-tabs-nav">
      <button class="learn-tab-btn active" data-tab="chords">Chords</button>
      <button class="learn-tab-btn" data-tab="tabs">Tabs</button>
      <button class="learn-tab-btn" data-tab="notes">Notes</button>
    </div>

    <div class="learn-tab-content" id="learn-tab-chords">
      <div class="chord-manager">
        <div class="chord-search-row">
          <input type="text" id="chord-search" placeholder="Add a chord (e.g. Em, G, C)..." autocomplete="off" spellcheck="false">
          <div id="chord-suggestions" class="chord-suggestions"></div>
        </div>
        <div id="chord-diagrams" class="chord-diagrams-grid"></div>
      </div>
    </div>

    <div class="learn-tab-content hidden" id="learn-tab-tabs">

      <div class="ug-how-to">
        <div class="ug-how-to-title">How to get tabs</div>
        <div class="ug-step"><span class="ug-step-num">1</span>Tap the button below — it searches Ultimate Guitar for this song</div>
        <div class="ug-step"><span class="ug-step-num">2</span>If it asks you to install an app — tap <strong>Not now</strong> or <strong>Continue in browser</strong></div>
        <div class="ug-step"><span class="ug-step-num">3</span>Pick a result — <strong>Chords</strong> versions are easiest for beginners</div>
        <div class="ug-step"><span class="ug-step-num">4</span>Tap and hold anywhere on the tab text → <strong>Select all</strong> → <strong>Copy</strong></div>
        <div class="ug-step"><span class="ug-step-num">5</span>Come back here and paste into the box below</div>
        <a href="https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(song.title + ' ' + song.artist)}"
           target="_blank" class="ug-search-btn">Search Ultimate Guitar for "${escHtml(song.title)}" ↗</a>
      </div>

      <div class="scroll-controls">
        <span class="scroll-label">Auto-scroll speed</span>
        <input type="range" id="scroll-speed" min="5" max="100" value="40">
        <button id="scroll-toggle" class="scroll-btn">Play</button>
      </div>

      <textarea id="tab-editor" class="tab-editor" placeholder="Paste tab text here after copying from Ultimate Guitar...&#10;&#10;Example of what tabs look like:&#10;&#10;e|---0---2---3---|&#10;B|---1---3---3---|&#10;G|---0---2---0---|&#10;D|---2---0---0---|&#10;A|---3---x---2---|&#10;E|---x---x---3---|&#10;&#10;Numbers = which fret to press&#10;0 = play the string open (no fret)&#10;x = don't play that string">${escHtml(song.tabs)}</textarea>
    </div>

    <div class="learn-tab-content hidden" id="learn-tab-notes">
      <textarea id="notes-editor" class="notes-editor" placeholder="Practice notes, reminders, progress...">${escHtml(song.notes)}</textarea>
      <button id="save-notes" class="save-btn">Save Notes</button>
    </div>
  `;

  // Back button
  view.querySelector('#back-to-songs').addEventListener('click', () => {
    showView('songs');
    updateNavActive('songs');
    renderSongList();
  });

  // Tab nav
  view.querySelectorAll('.learn-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      view.querySelectorAll('.learn-tab-btn').forEach(b => b.classList.remove('active'));
      view.querySelectorAll('.learn-tab-content').forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      view.querySelector('#learn-tab-' + btn.dataset.tab).classList.remove('hidden');
    });
  });

  // Chord search
  const chordSearch = view.querySelector('#chord-search');
  const chordSugg = view.querySelector('#chord-suggestions');
  chordSearch.addEventListener('input', () => {
    const q = chordSearch.value;
    const matches = findChords(q);
    if (matches.length && q) {
      chordSugg.innerHTML = matches.map(c => `<div class="chord-sugg-item" data-chord="${c}">${c} <small>${CHORDS[c].full}</small></div>`).join('');
      chordSugg.classList.add('visible');
    } else {
      chordSugg.classList.remove('visible');
    }
  });
  chordSugg.addEventListener('click', e => {
    const item = e.target.closest('.chord-sugg-item');
    if (!item) return;
    addChordToSong(item.dataset.chord);
    chordSearch.value = '';
    chordSugg.classList.remove('visible');
  });
  document.addEventListener('click', e => {
    if (!chordSearch.contains(e.target) && !chordSugg.contains(e.target)) {
      chordSugg.classList.remove('visible');
    }
  });

  renderChordDiagrams(song);

  // Tab editor auto-save
  const tabEditor = view.querySelector('#tab-editor');
  let tabSaveTimeout;
  tabEditor.addEventListener('input', () => {
    clearTimeout(tabSaveTimeout);
    tabSaveTimeout = setTimeout(() => {
      updateSong(currentSongId, { tabs: tabEditor.value });
    }, 800);
  });

  // Auto-scroll
  const scrollToggle = view.querySelector('#scroll-toggle');
  const scrollSpeed = view.querySelector('#scroll-speed');
  scrollToggle.addEventListener('click', () => {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
      scrollToggle.textContent = '▶ Scroll';
    } else {
      autoScrollInterval = setInterval(() => {
        tabEditor.scrollTop += autoScrollSpeed / 20;
      }, 50);
      scrollToggle.textContent = '⏸ Stop';
    }
  });
  scrollSpeed.addEventListener('input', () => {
    autoScrollSpeed = parseInt(scrollSpeed.value);
  });

  // Notes save
  const notesEditor = view.querySelector('#notes-editor');
  view.querySelector('#save-notes').addEventListener('click', () => {
    updateSong(currentSongId, { notes: notesEditor.value, lastPracticed: Date.now() });
    const btn = view.querySelector('#save-notes');
    btn.textContent = 'Saved ✓';
    setTimeout(() => btn.textContent = 'Save Notes', 1500);
  });
}

function addChordToSong(chordName) {
  const song = getSong(currentSongId);
  if (!song) return;
  if (song.chords.includes(chordName)) return; // already added
  const chords = [...song.chords, chordName];
  updateSong(currentSongId, { chords });
  renderChordDiagrams({ ...song, chords });
}

function removeChordFromSong(chordName) {
  const song = getSong(currentSongId);
  if (!song) return;
  const chords = song.chords.filter(c => c !== chordName);
  updateSong(currentSongId, { chords });
  renderChordDiagrams({ ...song, chords });
}

function renderChordDiagrams(song) {
  const container = document.getElementById('chord-diagrams');
  if (!container) return;

  if (!song.chords.length) {
    container.innerHTML = `<p class="chord-empty">Search for chords above to add diagrams for this song.</p>`;
    return;
  }

  container.innerHTML = song.chords.map(name => {
    const known = !!CHORDS[name];
    return `
      <div class="chord-diagram-card">
        ${known ? renderChordDiagram(name) : `<div class="chord-unknown">${escHtml(name)}</div>`}
        <button class="chord-remove" data-chord="${escHtml(name)}">✕</button>
      </div>`;
  }).join('');

  container.querySelectorAll('.chord-remove').forEach(btn => {
    btn.addEventListener('click', () => removeChordFromSong(btn.dataset.chord));
  });
}
