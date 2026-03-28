// Tuner — Web Audio API pitch detection with smoothing and stability filtering

const GUITAR_NOTES = [
  { name: 'E2', note: 'E', freq: 82.41,  string: 6, label: 'E', hint: 'thickest' },
  { name: 'A2', note: 'A', freq: 110.00, string: 5, label: 'A', hint: '5th'      },
  { name: 'D3', note: 'D', freq: 146.83, string: 4, label: 'D', hint: '4th'      },
  { name: 'G3', note: 'G', freq: 196.00, string: 3, label: 'G', hint: '3rd'      },
  { name: 'B3', note: 'B', freq: 246.94, string: 2, label: 'B', hint: '2nd'      },
  { name: 'E4', note: 'E', freq: 329.63, string: 1, label: 'e', hint: 'thinnest' },
];

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ---- Tuning parameters ----
const RMS_THRESHOLD    = 0.018;  // ignore very quiet sounds / background noise
const MEDIAN_BUF_SIZE  = 12;     // readings to buffer for median filter
const STABLE_FRAMES    = 10;     // frames in same direction before showing instruction
const IN_TUNE_CENTS    = 8;      // ±cents considered "in tune"
const FREQ_RANGE_CENTS = 700;    // only accept readings within ±7 semitones of target
const DISPLAY_MS       = 110;    // minimum ms between display updates

// ---- State ----
let audioCtx = null, analyser = null, micStream = null;
let tunerActive = false, tunerRAF = null;
let selectedString = 6;

let freqBuffer     = [];   // circular buffer of recent valid readings
let stableCount    = 0;    // frames consecutively pointing same direction
let lastDirection  = null; // 'flat' | 'sharp' | 'in-tune' | null
let lastDisplayAt  = 0;

// ---- Maths helpers ----
function centsFromTarget(detected, target) {
  return Math.round(1200 * Math.log2(detected / target));
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function freqToNoteName(freq) {
  const midi = 12 * Math.log2(freq / 440) + 69;
  const name = NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];
  const oct  = Math.floor(Math.round(midi) / 12) - 1;
  return name + oct;
}

// ---- Autocorrelation pitch detection ----
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  // RMS — reject quiet signal
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / SIZE) < RMS_THRESHOLD) return -1;

  // Trim silence edges
  let r1 = 0, r2 = SIZE - 1;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) >= 0.2)   { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) >= 0.2) { r2 = SIZE - i; break; }
  }
  const t = buf.slice(r1, r2);
  const N = t.length;
  if (N < 64) return -1;

  // Autocorrelation
  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    for (let j = 0; j < N - lag; j++) c[lag] += t[j] * t[j + lag];
  }

  // First trough then highest peak
  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -Infinity, maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos < 1 || maxPos >= N - 1) return -1;

  // Parabolic interpolation
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

  const target = GUITAR_NOTES.find(s => s.string === selectedString);

  if (rawFreq > 0 && target) {
    // Only accept if within ±7 semitones of target (filters noise & wrong strings)
    const centsOff = centsFromTarget(rawFreq, target.freq);
    if (Math.abs(centsOff) <= FREQ_RANGE_CENTS) {
      freqBuffer.push(rawFreq);
      if (freqBuffer.length > MEDIAN_BUF_SIZE) freqBuffer.shift();
    }
    // else: reading too far off — ignore it
  } else {
    // No signal — slowly drain buffer
    if (freqBuffer.length > 0) freqBuffer.shift();
  }

  // Throttle display updates
  const now = performance.now();
  if (now - lastDisplayAt >= DISPLAY_MS) {
    lastDisplayAt = now;
    updateTunerDisplay();
  }

  tunerRAF = requestAnimationFrame(tunerLoop);
}

function updateTunerDisplay() {
  const barFill    = document.getElementById('tuner-bar-fill');
  const barTrack   = document.getElementById('tuner-bar-track');
  const actionEl   = document.getElementById('tuner-action');
  const noteEl     = document.getElementById('tuner-detected-note');
  const centsEl    = document.getElementById('tuner-cents-val');

  const target = GUITAR_NOTES.find(s => s.string === selectedString);

  if (freqBuffer.length < 3 || !target) {
    // Not enough signal yet
    if (actionEl) { actionEl.textContent = 'Pluck the string...'; actionEl.className = 'tuner-action idle'; }
    if (noteEl)   noteEl.textContent = '—';
    if (centsEl)  centsEl.textContent = '';
    setBar(0, '');
    stableCount = 0; lastDirection = null;
    return;
  }

  // Use median of buffer — much more stable than latest reading
  const stableFreq = median(freqBuffer);
  const cents      = centsFromTarget(stableFreq, target.freq);
  const clamped    = Math.max(-60, Math.min(60, cents));
  const pct        = 50 + (clamped / 60) * 45;

  // Update note name + cents readout
  if (noteEl) noteEl.textContent = freqToNoteName(stableFreq);
  if (centsEl) {
    if (Math.abs(cents) <= IN_TUNE_CENTS) centsEl.textContent = '';
    else centsEl.textContent = Math.abs(cents) + ' cents ' + (cents < 0 ? 'flat' : 'sharp');
  }
  if (barFill) barFill.style.left = pct + '%';

  // Determine direction
  const dir = Math.abs(cents) <= IN_TUNE_CENTS ? 'in-tune' : cents < 0 ? 'flat' : 'sharp';

  // Stability: only commit to showing a direction after N consistent frames
  if (dir === lastDirection) {
    stableCount = Math.min(stableCount + 1, STABLE_FRAMES + 5);
  } else {
    stableCount = 0;
    lastDirection = dir;
  }

  if (stableCount < STABLE_FRAMES) {
    // Still detecting — don't show instruction yet
    if (actionEl) { actionEl.textContent = 'Detecting...'; actionEl.className = 'tuner-action idle'; }
    setBar(pct, '');
    return;
  }

  // Stable — show the instruction
  if (dir === 'in-tune') {
    if (actionEl) { actionEl.textContent = '✓  In tune!'; actionEl.className = 'tuner-action in-tune'; }
    setBar(pct, 'in-tune');
  } else if (dir === 'flat') {
    if (actionEl) { actionEl.innerHTML = '&#8593; Tighten'; actionEl.className = 'tuner-action tighten'; }
    setBar(pct, 'flat');
  } else {
    if (actionEl) { actionEl.innerHTML = '&#8595; Loosen'; actionEl.className = 'tuner-action loosen'; }
    setBar(pct, 'sharp');
  }
}

function setBar(pct, state) {
  const fill  = document.getElementById('tuner-bar-fill');
  const track = document.getElementById('tuner-bar-track');
  if (fill)  fill.style.left = (pct || 50) + '%';
  if (track) track.className = 'tuner-bar-track' + (state ? ' ' + state : '');
}

// ---- String selector ----
function selectString(stringNum) {
  selectedString = stringNum;
  freqBuffer = [];
  stableCount = 0;
  lastDirection = null;

  document.querySelectorAll('.str-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.string) === stringNum);
  });

  const target = GUITAR_NOTES.find(s => s.string === stringNum);
  const el = document.getElementById('tuner-target-note');
  if (el && target) el.textContent = 'Tuning to: ' + target.name + ' (' + Math.round(target.freq) + ' Hz)';

  updateTunerDisplay();
}

// ---- Start / Stop ----
async function startTuner() {
  if (tunerActive) return;
  try {
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    tunerActive = true;
    freqBuffer = []; stableCount = 0; lastDirection = null;
    const s = document.getElementById('tuner-status');
    if (s) { s.textContent = 'Listening'; s.className = 'tuner-status active'; }
    tunerLoop();
  } catch {
    const s = document.getElementById('tuner-status');
    if (s) { s.textContent = 'Mic access denied'; s.className = 'tuner-status error'; }
  }
}

function stopTuner() {
  if (!tunerActive) return;
  tunerActive = false;
  cancelAnimationFrame(tunerRAF);
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (audioCtx)  audioCtx.close();
  micStream = null; audioCtx = null; analyser = null;
  freqBuffer = []; stableCount = 0; lastDirection = null;
  const s = document.getElementById('tuner-status');
  if (s) { s.textContent = ''; s.className = 'tuner-status'; }
  updateTunerDisplay();
}

// ---- Init ----
function initTunerUI() {
  const row = document.getElementById('string-selector');
  if (!row) return;
  row.innerHTML = GUITAR_NOTES.map(s => `
    <button class="str-btn${s.string === 6 ? ' active' : ''}" data-string="${s.string}">
      <span class="str-btn-label">${s.label}</span>
      <span class="str-btn-hint">${s.hint}</span>
    </button>`).join('');
  row.querySelectorAll('.str-btn').forEach(btn => {
    btn.addEventListener('click', () => selectString(parseInt(btn.dataset.string)));
  });
  selectString(6);
}
