// Tuner — Web Audio API pitch detection via autocorrelation

const GUITAR_NOTES = [
  { name: 'E2',  freq: 82.41,  string: 6 },
  { name: 'A2',  freq: 110.00, string: 5 },
  { name: 'D3',  freq: 146.83, string: 4 },
  { name: 'G3',  freq: 196.00, string: 3 },
  { name: 'B3',  freq: 246.94, string: 2 },
  { name: 'E4',  freq: 329.63, string: 1 },
];

// All chromatic notes for finding nearest note
const ALL_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Convert frequency to note name + octave + cents deviation
function freqToNote(freq) {
  if (freq <= 0) return null;
  // A4 = 440Hz, MIDI 69
  const midi = 12 * Math.log2(freq / 440) + 69;
  const midiRounded = Math.round(midi);
  const cents = Math.round((midi - midiRounded) * 100);
  const noteName = NOTE_NAMES[((midiRounded % 12) + 12) % 12];
  const octave = Math.floor(midiRounded / 12) - 1;
  return { noteName, octave, cents, midi };
}

// Find nearest guitar string to the detected frequency
function nearestString(freq) {
  let best = null, bestDiff = Infinity;
  for (const s of GUITAR_NOTES) {
    const diff = Math.abs(freq - s.freq);
    if (diff < bestDiff) { bestDiff = diff; best = s; }
  }
  return best;
}

// Autocorrelation pitch detection (YIN-inspired)
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  // RMS check — too quiet
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return -1;

  // Trim leading/trailing silence
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

  // Autocorrelation
  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    for (let j = 0; j < N - lag; j++) {
      c[lag] += trimmed[j] * trimmed[j + lag];
    }
  }

  // Find first trough
  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;

  // Find highest peak after trough
  let maxVal = -Infinity, maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos < 1 || maxPos >= N - 1) return -1;

  // Parabolic interpolation for sub-sample precision
  const x1 = c[maxPos - 1], x2 = c[maxPos], x3 = c[maxPos + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const T0 = a ? maxPos - b / (2 * a) : maxPos;

  return sampleRate / T0;
}

// ---- Tuner state ----
let audioCtx = null;
let analyser = null;
let micStream = null;
let tunerActive = false;
let tunerRAF = null;

// ---- UI elements (set after DOM ready) ----
let tunerNeedle, tunerNote, tunerCents, tunerFreq, tunerStatus, tunerStringDots;

function initTunerUI() {
  tunerNeedle  = document.getElementById('tuner-needle');
  tunerNote    = document.getElementById('tuner-note');
  tunerCents   = document.getElementById('tuner-cents');
  tunerFreq    = document.getElementById('tuner-freq');
  tunerStatus  = document.getElementById('tuner-status');
  tunerStringDots = document.querySelectorAll('.string-dot');
}

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
    setTunerStatus('Listening...', 'active');
    tunerLoop();
  } catch (err) {
    setTunerStatus('Microphone access denied. Allow mic permission and try again.', 'error');
  }
}

function stopTuner() {
  if (!tunerActive) return;
  tunerActive = false;
  cancelAnimationFrame(tunerRAF);
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();
  micStream = null; audioCtx = null; analyser = null;
  setTunerStatus('Tap the button to start tuning', '');
  resetTunerDisplay();
}

function tunerLoop() {
  if (!tunerActive) return;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  const freq = autoCorrelate(buf, audioCtx.sampleRate);
  updateTunerDisplay(freq);
  tunerRAF = requestAnimationFrame(tunerLoop);
}

function updateTunerDisplay(freq) {
  if (freq < 0) {
    setNeedle(0);
    tunerNote.textContent = '—';
    tunerNote.className = 'tuner-note';
    tunerCents.textContent = '';
    tunerFreq.textContent = '';
    highlightString(-1);
    return;
  }

  const note = freqToNote(freq);
  if (!note) return;

  const cents = note.cents;
  const inTune = Math.abs(cents) <= 5;

  tunerNote.textContent = note.noteName + note.octave;
  tunerNote.className = 'tuner-note ' + (inTune ? 'in-tune' : cents < 0 ? 'flat' : 'sharp');
  tunerCents.textContent = cents === 0 ? 'In tune ✓' : (cents > 0 ? `+${cents}¢ sharp` : `${cents}¢ flat`);
  tunerFreq.textContent = freq.toFixed(1) + ' Hz';

  setNeedle(cents);

  // Highlight nearest guitar string
  const nearest = nearestString(freq);
  if (nearest) highlightString(nearest.string);
}

function setNeedle(cents) {
  // cents: -50 to +50, maps to -60deg to +60deg rotation
  const deg = Math.max(-60, Math.min(60, cents * 1.2));
  if (tunerNeedle) tunerNeedle.style.transform = `rotate(${deg}deg)`;
  // Update gauge color
  const abs = Math.abs(cents);
  const color = abs <= 5 ? '#2cb67d' : abs <= 15 ? '#e8c547' : '#ff6b35';
  if (tunerNeedle) tunerNeedle.style.borderBottomColor = color;
}

function highlightString(stringNum) {
  if (!tunerStringDots) return;
  tunerStringDots.forEach(dot => {
    dot.classList.toggle('active', parseInt(dot.dataset.string) === stringNum);
  });
}

function setTunerStatus(msg, cls) {
  if (tunerStatus) {
    tunerStatus.textContent = msg;
    tunerStatus.className = 'tuner-status ' + cls;
  }
}

function resetTunerDisplay() {
  if (tunerNote) tunerNote.textContent = '—';
  if (tunerCents) tunerCents.textContent = '';
  if (tunerFreq) tunerFreq.textContent = '';
  setNeedle(0);
  highlightString(-1);
}
