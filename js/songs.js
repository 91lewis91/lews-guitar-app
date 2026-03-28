// Song library — stored in localStorage

const STORAGE_KEY = 'guitar-app-songs';

function loadSongs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveSongs(songs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
    /youtube\.com\/shorts\/([^&?/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Extract Spotify track ID from URL
function extractSpotifyId(url) {
  const m = url.match(/spotify\.com\/track\/([^?]+)/);
  return m ? m[1] : null;
}

// Fetch YouTube title via oEmbed (no API key needed)
async function fetchYouTubeTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, author: data.author_name };
  } catch {
    return null;
  }
}

// Add a new song from URL
async function addSongFromUrl(rawUrl) {
  const url = rawUrl.trim();
  const ytId = extractYouTubeId(url);
  const spId = extractSpotifyId(url);

  if (!ytId && !spId) {
    throw new Error('Please paste a YouTube or Spotify track URL');
  }

  const songs = loadSongs();

  // Duplicate check
  if (ytId && songs.find(s => s.youtubeId === ytId)) {
    throw new Error('This song is already in your library');
  }
  if (spId && songs.find(s => s.spotifyId === spId)) {
    throw new Error('This song is already in your library');
  }

  let title = 'Unknown Title', artist = '';

  if (ytId) {
    const meta = await fetchYouTubeTitle(ytId);
    if (meta) {
      // Try to split "Artist - Title" format
      const split = meta.title.match(/^(.+?)\s[-–]\s(.+)$/);
      if (split) { artist = split[1]; title = split[2]; }
      else { title = meta.title; artist = meta.author; }
    }
  }

  const song = {
    id: generateId(),
    title,
    artist,
    youtubeId: ytId || null,
    spotifyId: spId || null,
    chords: [],
    tabs: '',
    notes: '',
    addedAt: Date.now(),
    lastPracticed: null,
  };

  songs.unshift(song);
  saveSongs(songs);
  return song;
}

function updateSong(id, changes) {
  const songs = loadSongs();
  const idx = songs.findIndex(s => s.id === id);
  if (idx === -1) return;
  songs[idx] = { ...songs[idx], ...changes };
  saveSongs(songs);
  return songs[idx];
}

function deleteSong(id) {
  const songs = loadSongs().filter(s => s.id !== id);
  saveSongs(songs);
}

function getSong(id) {
  return loadSongs().find(s => s.id === id) || null;
}

// ---- Song list UI ----
function renderSongList() {
  const container = document.getElementById('song-list');
  const songs = loadSongs();

  if (songs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♪</div>
        <p>No songs yet.</p>
        <p>Paste a YouTube or Spotify link above to get started.</p>
      </div>`;
    return;
  }

  container.innerHTML = songs.map(song => `
    <div class="song-card" data-id="${song.id}">
      <div class="song-thumb">
        ${song.youtubeId
          ? `<img src="https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg" alt="">`
          : `<div class="spotify-thumb">♪</div>`}
      </div>
      <div class="song-info">
        <div class="song-title">${escHtml(song.title)}</div>
        <div class="song-artist">${escHtml(song.artist)}</div>
        ${song.chords.length ? `<div class="song-chords">${song.chords.map(c => `<span class="chord-tag">${escHtml(c)}</span>`).join('')}</div>` : ''}
      </div>
      <button class="song-delete" data-id="${song.id}" aria-label="Remove song">✕</button>
    </div>`).join('');

  // Events
  container.querySelectorAll('.song-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('song-delete')) return;
      openLearnView(card.dataset.id);
    });
  });
  container.querySelectorAll('.song-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Remove this song?')) {
        deleteSong(btn.dataset.id);
        renderSongList();
      }
    });
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Search results UI ----
function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  if (!container) return;
  if (!results || results.length === 0) {
    container.innerHTML = '<div class="search-no-results">No results found. Try a different search.</div>';
    container.classList.remove('hidden');
    return;
  }
  container.innerHTML = results.map(r => `
    <div class="search-result-card" data-videoid="${escHtml(r.videoId)}">
      <img class="sr-thumb" src="${escHtml(r.thumb)}" alt="" loading="lazy">
      <div class="sr-info">
        <div class="sr-title">${escHtml(r.title)}</div>
        <div class="sr-author">${escHtml(r.author)}</div>
      </div>
      <button class="sr-add-btn" data-videoid="${escHtml(r.videoId)}" data-title="${escHtml(r.title)}" data-author="${escHtml(r.author)}">Add</button>
    </div>`).join('');
  container.classList.remove('hidden');

  container.querySelectorAll('.sr-add-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.textContent = '...';
      btn.disabled = true;
      const url = `https://www.youtube.com/watch?v=${btn.dataset.videoid}`;
      try {
        await addSongFromUrl(url);
        clearSearchResults();
        renderSongList();
      } catch (err) {
        btn.textContent = 'Add';
        btn.disabled = false;
      }
    });
  });
}

function clearSearchResults() {
  const container = document.getElementById('search-results');
  if (container) { container.innerHTML = ''; container.classList.add('hidden'); }
}

// ---- Add song form ----
function initSongsView() {
  const form = document.getElementById('add-song-form');
  const input = document.getElementById('song-url-input');
  const feedback = document.getElementById('add-song-feedback');
  const submitBtn = form.querySelector('button');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;

    clearSearchResults();
    feedback.textContent = '';
    feedback.className = 'form-feedback';
    submitBtn.disabled = true;

    // Direct URL add
    if (isYouTubeUrl(val) || isSpotifyUrl(val)) {
      feedback.textContent = 'Fetching song info...';
      feedback.className = 'form-feedback loading';
      try {
        const song = await addSongFromUrl(val);
        input.value = '';
        feedback.textContent = `"${song.title}" added!`;
        feedback.className = 'form-feedback success';
        renderSongList();
      } catch (err) {
        feedback.textContent = err.message;
        feedback.className = 'form-feedback error';
      }
    } else {
      // Search YouTube
      feedback.textContent = 'Searching YouTube...';
      feedback.className = 'form-feedback loading';
      const results = await searchYouTube(val);
      feedback.textContent = '';
      feedback.className = 'form-feedback';
      if (!results) {
        feedback.textContent = 'Search failed — check your connection or paste a URL directly.';
        feedback.className = 'form-feedback error';
      } else {
        renderSearchResults(results);
      }
    }

    submitBtn.disabled = false;
  });

  renderSongList();
}
