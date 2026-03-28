// Chord definitions
// Format: frets = [E2, A2, D3, G3, B3, e4]
// -1 = muted, 0 = open, N = fret number
// fingers = [1-4] at each string position (null = no finger)
// startFret = for barre chords higher up the neck

const CHORDS = {
  // ---- Open chords (most beginner-friendly) ----
  'Em': {
    frets:   [0, 2, 2, 0, 0, 0],
    fingers: [null, 2, 3, null, null, null],
    label: 'Em', full: 'E minor'
  },
  'E': {
    frets:   [0, 2, 2, 1, 0, 0],
    fingers: [null, 2, 3, 1, null, null],
    label: 'E', full: 'E major'
  },
  'Am': {
    frets:   [-1, 0, 2, 2, 1, 0],
    fingers: [null, null, 2, 3, 1, null],
    label: 'Am', full: 'A minor'
  },
  'A': {
    frets:   [-1, 0, 2, 2, 2, 0],
    fingers: [null, null, 1, 2, 3, null],
    label: 'A', full: 'A major'
  },
  'D': {
    frets:   [-1, -1, 0, 2, 3, 2],
    fingers: [null, null, null, 1, 3, 2],
    label: 'D', full: 'D major'
  },
  'Dm': {
    frets:   [-1, -1, 0, 2, 3, 1],
    fingers: [null, null, null, 2, 3, 1],
    label: 'Dm', full: 'D minor'
  },
  'G': {
    frets:   [3, 2, 0, 0, 0, 3],
    fingers: [2, 1, null, null, null, 3],
    label: 'G', full: 'G major'
  },
  'C': {
    frets:   [-1, 3, 2, 0, 1, 0],
    fingers: [null, 3, 2, null, 1, null],
    label: 'C', full: 'C major'
  },
  'Cadd9': {
    frets:   [-1, 3, 2, 0, 3, 3],
    fingers: [null, 3, 2, null, 4, 4],
    label: 'Cadd9', full: 'C add 9'
  },
  // ---- Seventh chords ----
  'E7': {
    frets:   [0, 2, 0, 1, 0, 0],
    fingers: [null, 2, null, 1, null, null],
    label: 'E7', full: 'E dominant 7'
  },
  'A7': {
    frets:   [-1, 0, 2, 0, 2, 0],
    fingers: [null, null, 2, null, 3, null],
    label: 'A7', full: 'A dominant 7'
  },
  'D7': {
    frets:   [-1, -1, 0, 2, 1, 2],
    fingers: [null, null, null, 2, 1, 3],
    label: 'D7', full: 'D dominant 7'
  },
  'G7': {
    frets:   [3, 2, 0, 0, 0, 1],
    fingers: [3, 2, null, null, null, 1],
    label: 'G7', full: 'G dominant 7'
  },
  'B7': {
    frets:   [-1, 2, 1, 2, 0, 2],
    fingers: [null, 2, 1, 3, null, 4],
    label: 'B7', full: 'B dominant 7'
  },
  // ---- Barre chords ----
  'Bb': {
    frets:   [1, 3, 3, 3, 3, 1],
    fingers: [1, 3, 3, 3, 3, 1],
    barre:   { fret: 1, fromString: 0, toString: 5 },
    label: 'Bb', full: 'B flat major'
  },
  'F': {
    frets:   [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barre:   { fret: 1, fromString: 0, toString: 5 },
    label: 'F', full: 'F major'
  },
  'Bm': {
    frets:   [-1, 2, 4, 4, 3, 2],
    fingers: [null, 1, 3, 4, 2, 1],
    barre:   { fret: 2, fromString: 1, toString: 5 },
    label: 'Bm', full: 'B minor'
  },
  'Fm': {
    frets:   [1, 3, 3, 1, 1, 1],
    fingers: [1, 3, 4, 1, 1, 1],
    barre:   { fret: 1, fromString: 0, toString: 5 },
    label: 'Fm', full: 'F minor'
  },
  // ---- Suspended / other ----
  'Dsus2': {
    frets:   [-1, -1, 0, 2, 3, 0],
    fingers: [null, null, null, 1, 2, null],
    label: 'Dsus2', full: 'D suspended 2'
  },
  'Dsus4': {
    frets:   [-1, -1, 0, 2, 3, 3],
    fingers: [null, null, null, 1, 3, 4],
    label: 'Dsus4', full: 'D suspended 4'
  },
  'Asus2': {
    frets:   [-1, 0, 2, 2, 0, 0],
    fingers: [null, null, 1, 2, null, null],
    label: 'Asus2', full: 'A suspended 2'
  },
  'Asus4': {
    frets:   [-1, 0, 0, 2, 3, 0],
    fingers: [null, null, null, 1, 3, null],
    label: 'Asus4', full: 'A suspended 4'
  },
};

// All chord names for autocomplete
const CHORD_NAMES = Object.keys(CHORDS);

// Helper: find chords by partial name match
function findChords(query) {
  const q = query.trim();
  if (!q) return [];
  return CHORD_NAMES.filter(name =>
    name.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 10);
}

// Finger colours for chord diagrams (index=1, middle=2, ring=3, pinky=4)
const FINGER_COLORS = {
  1: '#4a9eff',  // blue  — index
  2: '#2cb67d',  // green — middle
  3: '#ff8c42',  // orange — ring
  4: '#c47aff',  // purple — pinky
};

// Generate step-by-step human-readable instructions for a chord
function generateChordInstructions(chordName) {
  const chord = CHORDS[chordName];
  if (!chord) return [];

  const stringNames = ['Low E (thickest)', 'A', 'D', 'G', 'B', 'High e (thinnest)'];
  const fingerLabels = { 1: '1st finger — index', 2: '2nd finger — middle', 3: '3rd finger — ring', 4: '4th finger — pinky' };
  const lines = [];

  if (chord.barre) {
    lines.push({ type: 'barre', text: `Lay your 1st finger (index) flat across ALL strings at fret ${chord.barre.fret} — this is called a barre.` });
  }

  for (let i = 0; i < 6; i++) {
    const fret = chord.frets[i];
    const finger = chord.fingers?.[i];
    const str = stringNames[i];
    // Skip strings fully covered by barre chord description
    const isBarre = chord.barre && fret === chord.barre.fret && i >= chord.barre.fromString && i <= chord.barre.toString && !finger;
    if (fret === -1) {
      lines.push({ type: 'mute', text: `${str}: ✕  Don't play this string` });
    } else if (fret === 0) {
      lines.push({ type: 'open', text: `${str}: ○  Play open (no finger needed)` });
    } else if (!isBarre) {
      const fLabel = finger ? `${fingerLabels[finger]}` : 'press';
      lines.push({ type: 'finger', finger, text: `${str}: fret ${fret}  —  ${fLabel}` });
    }
  }

  return lines;
}
