// Tuner — pitch detection with octave correction, stability filtering, in-tune hold

const GUITAR_NOTES = [
  { name: 'E2', freq: 82.41,  string: 6, label: 'E', hint: 'thickest' },
  { name: 'A2', freq: 110.00, string: 5, label: 'A', hint: '5th'      },
  { name: 'D3', freq: 146.83, string: 4, label: 'D', hint: '4th'      },
  { name: 'G3', freq: 196.00, string: 3, label: 'G', hint: '3rd'      },
  { name: 'B3', freq: 246.94, string: 2, label: 'B', hint: '2nd'      },
  { name: 'E4', freq: 329.63, string: 1, label: 'e', hint: 'thinnest' },
];

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ---- Parameters ----
const RMS_THRESHOLD    = 0.016; // below this = silence
const MEDIAN_BUF_SIZE  = 14;    // readings to median-filter
const STABLE_FRAMES    = 10;    // consecutive frames before showing instruction
const IN_TUNE_CENTS    = 8;     // ±cents = "in tune"
const FREQ_RANGE_CENTS = 1300;  // accept up to ~1 octave off target (handles very flat strings)
const DISPLAY_MS       = 120;   // ms between display refreshes
const IN_TUNE_HOLD_MS  = 2500;  // keep "In tune!" on screen for this long after going green

// ---- State ----
let audioCtx = null, analyser = null, micStream = null;
let tunerActive = false, tunerRAF = null;
let selectedString = 6;

let freqBuffer    = [];
let stableCount   = 0;
let lastDirection = null;
let lastDisplayAt = 0;
let inTuneHoldUntil = 0;
let hasVibrated   = false;

// ---- Helpers ----
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

// Octave correction: autocorrelation often latches on to a harmonic (2x the real freq)
// or sub-harmonic (0.5x). This picks whichever octave candidate is closest to target.
function octaveCorrected(detectedFreq, targetFreq) {
  const candidates = [
    detectedFreq,
    detectedFreq * 2,   // tuner heard harmonic → real pitch is an octave lower
    detectedFreq / 2,   // tuner heard sub-harmonic → real pitch is an octave higher
  ];
  return candidates.reduce((best, freq) => {
    return Math.abs(centsFromTarget(freq, targetFreq)) <
           Math.abs(centsFromTarget(best, targetFreq)) ? freq : best;
  });
}

// ---- Autocorrelation pitch detection ----
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / SIZE) < RMS_THRESHOLD) return -1;

  let r1 = 0, r2 = SIZE - 1;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) >= 0.2) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) >= 0.2) { r2 = SIZE - i; break; }
  }
  const t = buf.slice(r1, r2);
  const N = t.length;
  if (N < 64) return -1;

  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    for (let j = 0; j < N - lag; j++) c[lag] += t[j] * t[j + lag];
  }

  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -Infinity, maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos < 1 || maxPos >= N - 1) return -1;

  const x1 = c[maxPos-1], x2 = c[maxPos], x3 = c[maxPos+1];
  const a = (x1 + x3 - 2*x2) / 2;
  const b = (x3 - x1) / 2;
  return sampleRate / (a ? maxPos - b/(2*a) : maxPos);
}

// ---- Audio loop ----
function tunerLoop() {
  if (!tunerActive) return;

  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  const raw = autoCorrelate(buf, audioCtx.sampleRate);

  const target = GUITAR_NOTES.find(s => s.string === selectedString);

  if (raw > 0 && target) {
    // First apply octave correction, then range-check the corrected reading
    const corrected = octaveCorrected(raw, target.freq);
    const cents = centsFromTarget(corrected, target.freq);
    if (Math.abs(cents) <= FREQ_RANGE_CENTS) {
      freqBuffer.push(corrected);
      if (freqBuffer.length > MEDIAN_BUF_SIZE) freqBuffer.shift();
    }
  } else {
    // Silence — drain buffer slowly
    if (freqBuffer.length > 0) freqBuffer.shift();
  }

  const now = performance.now();
  if (now - lastDisplayAt >= DISPLAY_MS) {
    lastDisplayAt = now;
    updateTunerDisplay(now);
  }

  tunerRAF = requestAnimationFrame(tunerLoop);
}

// ---- Display ----
function updateTunerDisplay(now = performance.now()) {
  const actionEl = document.getElementById('tuner-action');
  const noteEl   = document.getElementById('tuner-detected-note');
  const centsEl  = document.getElementById('tuner-cents-val');
  const target   = GUITAR_NOTES.find(s => s.string === selectedString);

  // Not enough signal
  if (freqBuffer.length < 3 || !target) {
    // But honour in-tune hold — keep showing green even after string decays
    if (now < inTuneHoldUntil) return;
    if (actionEl) { actionEl.textContent = 'Pluck the string...'; actionEl.className = 'tuner-action idle'; }
    if (noteEl)   noteEl.textContent = '—';
    if (centsEl)  centsEl.textContent = '';
    setBar(50, '');
    stableCount = 0; lastDirection = null;
    return;
  }

  const stableFreq = median(freqBuffer);
  const cents      = centsFromTarget(stableFreq, target.freq);
  const clamped    = Math.max(-60, Math.min(60, cents));
  const pct        = 50 + (clamped / 60) * 45;

  if (noteEl) noteEl.textContent = freqToNoteName(stableFreq);
  if (centsEl) {
    centsEl.textContent = Math.abs(cents) <= IN_TUNE_CENTS
      ? '' : Math.abs(cents) + ' cents ' + (cents < 0 ? 'flat' : 'sharp');
  }

  // Stability tracking
  const dir = Math.abs(cents) <= IN_TUNE_CENTS ? 'in-tune' : cents < 0 ? 'flat' : 'sharp';
  if (dir === lastDirection) stableCount = Math.min(stableCount + 1, 99);
  else { stableCount = 0; lastDirection = dir; }

  // Still stabilising
  if (stableCount < STABLE_FRAMES) {
    if (now >= inTuneHoldUntil) { // don't overwrite the green hold
      if (actionEl) { actionEl.textContent = 'Detecting...'; actionEl.className = 'tuner-action idle'; }
    }
    setBar(pct, '');
    return;
  }

  // Stable — show instruction
  if (dir === 'in-tune') {
    if (actionEl) { actionEl.textContent = '✓  In tune!'; actionEl.className = 'tuner-action in-tune'; }
    setBar(pct, 'in-tune');

    // Set hold timer so green stays visible after string decays
    inTuneHoldUntil = now + IN_TUNE_HOLD_MS;

    // Haptic pulse (once per in-tune event)
    if (!hasVibrated && navigator.vibrate) {
      navigator.vibrate([80, 60, 80]);
      hasVibrated = true;
    }
  } else {
    // Once we leave in-tune reset vibration flag so next in-tune pulses again
    hasVibrated = false;

    if (now < inTuneHoldUntil) return; // respect the hold

    if (dir === 'flat') {
      if (actionEl) { actionEl.innerHTML = '&#8593; Tighten'; actionEl.className = 'tuner-action tighten'; }
      setBar(pct, 'flat');
    } else {
      if (actionEl) { actionEl.innerHTML = '&#8595; Loosen'; actionEl.className = 'tuner-action loosen'; }
      setBar(pct, 'sharp');
    }
  }
}

function setBar(pct, state) {
  const fill  = document.getElementById('tuner-bar-fill');
  const track = document.getElementById('tuner-bar-track');
  if (fill)  fill.style.left = pct + '%';
  if (track) track.className = 'tuner-bar-track' + (state ? ' ' + state : '');
}

// ---- String selector ----
function selectString(n) {
  selectedString = n;
  freqBuffer = []; stableCount = 0; lastDirection = null;
  inTuneHoldUntil = 0; hasVibrated = false;

  document.querySelectorAll('.str-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.string) === n)
  );

  const t = GUITAR_NOTES.find(s => s.string === n);
  const el = document.getElementById('tuner-target-note');
  if (el && t) el.textContent = 'Tuning to: ' + t.name + ' (' + Math.round(t.freq) + ' Hz)';
  updateTunerDisplay();
}

// ---- Start / Stop ----
async function startTuner() {
  if (tunerActive) return;
  try {
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    });
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    tunerActive = true;
    freqBuffer = []; stableCount = 0; lastDirection = null;
    inTuneHoldUntil = 0; hasVibrated = false;
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
  inTuneHoldUntil = 0; hasVibrated = false;
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
  row.querySelectorAll('.str-btn').forEach(b =>
    b.addEventListener('click', () => selectString(parseInt(b.dataset.string)))
  );
  selectString(6);
}
