// Tuner — Web Audio API pitch detection via autocorrelation

const GUITAR_NOTES = [
  { name: 'E2', note: 'E', freq: 82.41,  string: 6, label: 'E', hint: 'thickest' },
  { name: 'A2', note: 'A', freq: 110.00, string: 5, label: 'A', hint: '5th'      },
  { name: 'D3', note: 'D', freq: 146.83, string: 4, label: 'D', hint: '4th'      },
  { name: 'G3', note: 'G', freq: 196.00, string: 3, label: 'G', hint: '3rd'      },
  { name: 'B3', note: 'B', freq: 246.94, string: 2, label: 'B', hint: '2nd'      },
  { name: 'E4', note: 'E', freq: 329.63, string: 1, label: 'e', hint: 'thinnest' },
];

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ---- State ----
let audioCtx = null;
let analyser = null;
let micStream = null;
let tunerActive = false;
let tunerRAF = null;
let selectedString = 6; // default to low E
let smoothedFreq = -1;
const SMOOTH_ALPHA = 0.12; // Lower = smoother but slower to respond

// Convert frequency to MIDI + cents
function freqToNote(freq) {
  if (freq <= 0) return null;
  const midi = 12 * Math.log2(freq / 440) + 69;
  const midiRounded = Math.round(midi);
  const cents = Math.round((midi - midiRounded) * 100);
  const noteName = NOTE_NAMES[((midiRounded % 12) + 12) % 12];
  const octave = Math.floor(midiRounded / 12) - 1;
  return { noteName, octave, cents, midi };
}

// Cents deviation from a target frequency
function centsFromTarget(detected, target) {
  return Math.round(1200 * Math.log2(detected / target));
}

// Autocorrelation pitch detection
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }
  const trimmed = buf.slice(r1, r2);
  const N = trimmed.length;

  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    for (let j = 0; j < N - lag; j++) {
      c[lag] += trimmed[j] * trimmed[j + lag];
    }
  }

  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;

  let maxVal = -Infinity, maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos < 1 || maxPos >= N - 1) return -1;

  const x1 = c[maxPos - 1], x2 = c[maxPos], x3 = c[maxPos + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const T0 = a ? maxPos - b / (2 * a) : maxPos;
  return sampleRate / T0;
}

// ---- Audio loop ----
function tunerLoop() {
  if (!tunerActive) return;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  const rawFreq = autoCorrelate(buf, audioCtx.sampleRate);

  if (rawFreq > 0) {
    // Exponential moving average smoothing
    if (smoothedFreq < 0) smoothedFreq = rawFreq;
    else smoothedFreq = SMOOTH_ALPHA * rawFreq + (1 - SMOOTH_ALPHA) * smoothedFreq;
    updateTunerDisplay(smoothedFreq);
  } else {
    // Silence — decay back to idle slowly
    smoothedFreq = -1;
    updateTunerDisplay(-1);
  }

  tunerRAF = requestAnimationFrame(tunerLoop);
}

// ---- Display ----
function updateTunerDisplay(freq) {
  const target = GUITAR_NOTES.find(s => s.string === selectedString);
  const barEl    = document.getElementById('tuner-bar-fill');
  const actionEl = document.getElementById('tuner-action');
  const noteEl   = document.getElementById('tuner-detected-note');
  const centsEl  = document.getElementById('tuner-cents-val');
  const barTrack = document.getElementById('tuner-bar-track');

  if (freq < 0 || !target) {
    if (barEl) barEl.style.left = '50%';
    if (actionEl) { actionEl.textContent = 'Pluck the string...'; actionEl.className = 'tuner-action idle'; }
    if (noteEl) noteEl.textContent = '—';
    if (centsEl) centsEl.textContent = '';
    if (barTrack) barTrack.className = 'tuner-bar-track';
    return;
  }

  const cents = centsFromTarget(freq, target.freq);
  const clamped = Math.max(-60, Math.min(60, cents));
  // Bar position: 50% = centre, range maps to 5%–95%
  const pct = 50 + (clamped / 60) * 45;

  const note = freqToNote(freq);
  if (noteEl && note) noteEl.textContent = note.noteName + note.octave;
  if (centsEl) {
    if (Math.abs(cents) <= 5) centsEl.textContent = '';
    else centsEl.textContent = Math.abs(cents) + ' cents ' + (cents < 0 ? 'flat' : 'sharp');
  }

  if (barEl) barEl.style.left = pct + '%';

  const abs = Math.abs(cents);
  if (abs <= 5) {
    if (actionEl) { actionEl.textContent = '✓  In tune!'; actionEl.className = 'tuner-action in-tune'; }
    if (barTrack) barTrack.className = 'tuner-bar-track in-tune';
  } else if (cents < 0) {
    // Flat = note is too low = tighten the string
    if (actionEl) { actionEl.innerHTML = '&#8593; Tighten'; actionEl.className = 'tuner-action tighten'; }
    if (barTrack) barTrack.className = 'tuner-bar-track flat';
  } else {
    // Sharp = note is too high = loosen the string
    if (actionEl) { actionEl.innerHTML = '&#8595; Loosen'; actionEl.className = 'tuner-action loosen'; }
    if (barTrack) barTrack.className = 'tuner-bar-track sharp';
  }
}

// ---- String selector ----
function selectString(stringNum) {
  selectedString = stringNum;
  smoothedFreq = -1;
  document.querySelectorAll('.str-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.string) === stringNum);
  });
  const target = GUITAR_NOTES.find(s => s.string === stringNum);
  const targetEl = document.getElementById('tuner-target-note');
  if (targetEl && target) targetEl.textContent = 'Tuning to: ' + target.name + ' (' + Math.round(target.freq) + ' Hz)';
  updateTunerDisplay(-1);
}

// ---- Start / Stop ----
async function startTuner() {
  if (tunerActive) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    tunerActive = true;
    smoothedFreq = -1;
    const statusEl = document.getElementById('tuner-status');
    if (statusEl) { statusEl.textContent = 'Listening...'; statusEl.className = 'tuner-status active'; }
    tunerLoop();
  } catch (err) {
    const statusEl = document.getElementById('tuner-status');
    if (statusEl) { statusEl.textContent = 'Microphone access denied — check browser permissions.'; statusEl.className = 'tuner-status error'; }
  }
}

function stopTuner() {
  if (!tunerActive) return;
  tunerActive = false;
  cancelAnimationFrame(tunerRAF);
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();
  micStream = null; audioCtx = null; analyser = null;
  smoothedFreq = -1;
  const statusEl = document.getElementById('tuner-status');
  if (statusEl) { statusEl.textContent = ''; statusEl.className = 'tuner-status'; }
  updateTunerDisplay(-1);
}

// ---- Init ----
function initTunerUI() {
  // Build string selector buttons
  const row = document.getElementById('string-selector');
  if (row) {
    row.innerHTML = GUITAR_NOTES.map(s => `
      <button class="str-btn${s.string === 6 ? ' active' : ''}" data-string="${s.string}">
        <span class="str-btn-label">${s.label}</span>
        <span class="str-btn-hint">${s.hint}</span>
      </button>`).join('');
    row.querySelectorAll('.str-btn').forEach(btn => {
      btn.addEventListener('click', () => selectString(parseInt(btn.dataset.string)));
    });
  }
  // Set initial target label
  selectString(6);
}
