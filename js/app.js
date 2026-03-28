// Main app — navigation and init

const VIEWS = ['tuner', 'songs', 'learn'];

function showView(name) {
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('hidden', v !== name);
  });
  // Stop tuner if leaving tuner view
  if (name !== 'tuner' && tunerActive) stopTuner();
  // Stop auto-scroll if leaving learn view
  if (name !== 'learn' && autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

function updateNavActive(name) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
}

function navigate(view) {
  showView(view);
  updateNavActive(view);
}

function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });
}

// Tuner button
function initTunerControls() {
  const startBtn = document.getElementById('tuner-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (tunerActive) {
        stopTuner();
        startBtn.textContent = 'Start Tuner';
        startBtn.classList.remove('active');
      } else {
        startTuner();
        startBtn.textContent = 'Stop Tuner';
        startBtn.classList.add('active');
      }
    });
  }
}

// app.js no longer calls the old initTunerUI that referenced needle/dots —
// tuner.js initTunerUI now builds the string selector itself.

// Register service worker
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initTunerUI();
  initTunerControls();
  initSongsView();
  initServiceWorker();
  navigate('tuner');
});
