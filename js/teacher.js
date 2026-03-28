// Teacher — chord diagrams, tab display, learn view

// ---- Chord diagram SVG renderer ----
function renderChordDiagram(chordName, opts = {}) {
  const chord = CHORDS[chordName];
  if (!chord) return '';

  const large = opts.large || false;
  const colorFingers = opts.colorFingers !== false; // default true

  const W = large ? 220 : 120;
  const H = large ? 265 : 140;
  const padLeft = large ? 28 : 18;
  const padTop  = large ? 42 : 30;
  const stringSpacing = large ? 30 : 16;
  const fretSpacing   = large ? 32 : 18;
  const dotR          = large ? 11 : 6;
  const numStrings    = 6;
  const numFrets      = 4;
  const labelSize     = large ? 20 : 14;
  const oxSize        = large ? 16 : 12;
  const fingerSize    = large ? 12 : 9;

  const minFret  = Math.min(...chord.frets.filter(f => f > 0));
  const startFret = (chord.barre?.fret) || (minFret > 0 ? minFret : 1);
  const showNut   = startFret === 1;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="chord-svg${large ? ' chord-svg-large' : ''}">`;

  svg += `<text x="${padLeft + (numStrings-1)*stringSpacing/2}" y="${large ? 26 : 18}" text-anchor="middle" class="chord-label" style="font-size:${labelSize}px">${escHtml(chordName)}</text>`;

  if (showNut) {
    svg += `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft + (numStrings-1)*stringSpacing}" y2="${padTop}" stroke="var(--text)" stroke-width="${large ? 5 : 4}"/>`;
  } else {
    svg += `<text x="${padLeft + (numStrings-1)*stringSpacing + (large ? 8 : 6)}" y="${padTop + fretSpacing/2}" class="fret-num" style="font-size:${large ? 13 : 10}px">${startFret}fr</text>`;
  }

  for (let f = 0; f <= numFrets; f++) {
    const y = padTop + f * fretSpacing;
    svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + (numStrings-1)*stringSpacing}" y2="${y}" stroke="var(--surface3)" stroke-width="1"/>`;
  }
  for (let s = 0; s < numStrings; s++) {
    const x = padLeft + s * stringSpacing;
    svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + numFrets * fretSpacing}" stroke="var(--surface3)" stroke-width="${large ? 1.5 : 1}"/>`;
  }

  if (chord.barre) {
    const b = chord.barre;
    const fretPos = b.fret - startFret;
    const y  = padTop + fretPos * fretSpacing - fretSpacing / 2;
    const x1 = padLeft + b.fromString * stringSpacing;
    const x2 = padLeft + b.toString  * stringSpacing;
    const barColor = colorFingers ? FINGER_COLORS[1] : 'var(--accent)';
    svg += `<rect x="${x1 - dotR}" y="${y - dotR + 1}" width="${x2 - x1 + 2*dotR}" height="${dotR*2}" rx="${dotR}" fill="${barColor}" opacity="0.9"/>`;
  }

  for (let s = 0; s < numStrings; s++) {
    const x    = padLeft + s * stringSpacing;
    const fret = chord.frets[s];
    const finger = chord.fingers?.[s];

    if (fret === -1) {
      svg += `<text x="${x}" y="${padTop - (large ? 12 : 8)}" text-anchor="middle" class="ox-label muted" style="font-size:${oxSize}px">✕</text>`;
    } else if (fret === 0) {
      svg += `<circle cx="${x}" cy="${padTop - (large ? 12 : 9)}" r="${large ? 7 : 5}" fill="none" stroke="var(--text-secondary)" stroke-width="${large ? 2 : 1.5}"/>`;
    } else {
      const fretPos = fret - startFret;
      const y = padTop + fretPos * fretSpacing - fretSpacing / 2;
      const isBarre = chord.barre && fret === chord.barre.fret && s >= chord.barre.fromString && s <= chord.barre.toString;
      if (!isBarre) {
        const dotColor = (colorFingers && finger && FINGER_COLORS[finger]) ? FINGER_COLORS[finger] : 'var(--accent)';
        svg += `<circle cx="${x}" cy="${y}" r="${dotR}" fill="${dotColor}"/>`;
        if (finger) {
          svg += `<text x="${x}" y="${y + fingerSize/2 + 1}" text-anchor="middle" class="finger-num" style="font-size:${fingerSize}px">${finger}</text>`;
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

        <!-- Auto-fetch row -->
        <div class="auto-fetch-row">
          <button id="auto-fetch-btn" class="auto-fetch-btn">
            <span class="af-icon">&#10024;</span> Auto-fetch chords &amp; tabs
          </button>
          <div id="auto-fetch-status" class="auto-fetch-status"></div>
        </div>

        <div class="chord-divider">or add manually</div>

        <div class="chord-search-row">
          <input type="text" id="chord-search" placeholder="Type a chord name (e.g. Em, G, C)..." autocomplete="off" spellcheck="false">
          <div id="chord-suggestions" class="chord-suggestions"></div>
        </div>
        <div id="chord-diagrams" class="chord-diagrams-grid"></div>
      </div>
    </div>

    <div class="learn-tab-content hidden" id="learn-tab-tabs">
      <div class="scroll-controls">
        <span class="scroll-label">Auto-scroll speed</span>
        <input type="range" id="scroll-speed" min="5" max="100" value="40">
        <button id="scroll-toggle" class="scroll-btn">Play</button>
      </div>
      <textarea id="tab-editor" class="tab-editor" placeholder="Use the Auto-fetch button in the Chords tab to fill this automatically, or paste text here manually.">${escHtml(song.tabs)}</textarea>
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

  // Auto-fetch button
  const autoFetchBtn = view.querySelector('#auto-fetch-btn');
  const autoFetchStatus = view.querySelector('#auto-fetch-status');
  if (autoFetchBtn) {
    autoFetchBtn.addEventListener('click', async () => {
      const currentSong = getSong(currentSongId);
      if (!currentSong) return;

      autoFetchBtn.disabled = true;
      autoFetchBtn.innerHTML = '<span class="af-spin">&#9696;</span> Searching...';
      autoFetchStatus.textContent = '';
      autoFetchStatus.className = 'auto-fetch-status';

      try {
        const result = await autoFetchChords(currentSong.title, currentSong.artist);

        if (!result || result.known.length === 0) {
          autoFetchStatus.textContent = 'Not found automatically — add chords manually below.';
          autoFetchStatus.className = 'auto-fetch-status fail';
          autoFetchBtn.disabled = false;
          autoFetchBtn.innerHTML = '<span class="af-icon">&#10024;</span> Auto-fetch chords &amp; tabs';
        } else {
          const existingChords = currentSong.chords || [];
          const merged = [...new Set([...existingChords, ...result.known])];
          const changes = { chords: merged };

          const tabEditor = view.querySelector('#tab-editor');
          if (tabEditor && !tabEditor.value.trim() && result.text) {
            tabEditor.value = result.text;
            changes.tabs = result.text;
          }

          updateSong(currentSongId, changes);
          renderChordDiagrams({ ...currentSong, chords: merged });

          const fromLibrary = result.source === 'library';
          autoFetchStatus.textContent = fromLibrary
            ? `Found in song library — ${result.known.length} chords loaded`
            : `Found ${result.known.length} chord${result.known.length !== 1 ? 's' : ''}`;
          autoFetchStatus.className = 'auto-fetch-status ok';
          autoFetchBtn.innerHTML = '<span class="af-icon">&#10003;</span> Done';

          // Switch to Tabs view automatically so user can see the lyrics+chords
          if (result.text && tabEditor) {
            view.querySelectorAll('.learn-tab-btn').forEach(b => b.classList.remove('active'));
            view.querySelectorAll('.learn-tab-content').forEach(c => c.classList.add('hidden'));
            view.querySelector('[data-tab="tabs"]').classList.add('active');
            view.getElementById && view.querySelector('#learn-tab-tabs').classList.remove('hidden');
          }
        }
      } catch (err) {
        autoFetchStatus.textContent = 'Error — check your connection and try again.';
        autoFetchStatus.className = 'auto-fetch-status fail';
        autoFetchBtn.disabled = false;
        autoFetchBtn.innerHTML = '<span class="af-icon">&#10024;</span> Auto-fetch chords &amp; tabs';
      }
    });
  }

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

function openChordModal(chordName) {
  const modal = document.getElementById('chord-modal');
  const content = document.getElementById('chord-modal-content');
  if (!modal || !content) return;

  const chord = CHORDS[chordName];
  const instructions = generateChordInstructions(chordName);
  const fingerColors = FINGER_COLORS;

  const instructionHtml = instructions.map(line => {
    let icon = '';
    if (line.type === 'mute')   icon = `<span class="ci-icon ci-mute">✕</span>`;
    else if (line.type === 'open') icon = `<span class="ci-icon ci-open">○</span>`;
    else if (line.type === 'barre') icon = `<span class="ci-icon ci-barre" style="background:${fingerColors[1]}">B</span>`;
    else if (line.type === 'finger') icon = `<span class="ci-icon ci-finger" style="background:${fingerColors[line.finger] || '#888'}">${line.finger}</span>`;
    return `<div class="ci-row">${icon}<span class="ci-text">${escHtml(line.text)}</span></div>`;
  }).join('');

  content.innerHTML = `
    <div class="cm-chord-name">${escHtml(chordName)}</div>
    <div class="cm-chord-full">${chord ? escHtml(chord.full) : ''}</div>
    <div class="cm-diagram">${renderChordDiagram(chordName, { large: true, colorFingers: true })}</div>
    <div class="cm-legend">
      <div class="cm-legend-title">Finger guide</div>
      ${[1,2,3,4].map(f => `<div class="cm-legend-row"><span class="cm-legend-dot" style="background:${fingerColors[f]}"></span>${['Index','Middle','Ring','Pinky'][f-1]} finger</div>`).join('')}
    </div>
    <div class="cm-instructions">
      <div class="cm-instructions-title">Step by step</div>
      ${instructionHtml}
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeChordModal() {
  const modal = document.getElementById('chord-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
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
      <div class="chord-diagram-card" data-chord="${escHtml(name)}" style="cursor:pointer">
        ${known ? renderChordDiagram(name) : `<div class="chord-unknown">${escHtml(name)}</div>`}
        <div class="chord-tap-hint">tap to learn</div>
        <button class="chord-remove" data-chord="${escHtml(name)}">✕</button>
      </div>`;
  }).join('');

  container.querySelectorAll('.chord-remove').forEach(btn => {
    btn.addEventListener('click', () => removeChordFromSong(btn.dataset.chord));
  });

  container.querySelectorAll('.chord-diagram-card[data-chord]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('chord-remove')) return;
      openChordModal(card.dataset.chord);
    });
  });
}
