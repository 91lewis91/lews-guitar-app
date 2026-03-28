# Guitar Learning App — Project Context

## What this is
A Progressive Web App (PWA) for learning acoustic guitar on a Samsung S23.
Hosted locally or via GitHub Pages, accessed in Chrome mobile.

## Project location
`/home/lewis/Documents/guitar-app/`

## User context
- Complete beginner on acoustic guitar
- Cannot read sheet music — use tabs and chord diagrams instead
- Preferred learning style: visual, interactive
- Device: Samsung Galaxy S23 (Chrome)

## File structure
```
guitar-app/
├── CLAUDE.md           ← this file (AI project context)
├── index.html          ← app shell, all views as divs
├── manifest.json       ← PWA config
├── sw.js               ← service worker (offline support)
├── css/app.css         ← all styles (dark theme, mobile-first)
├── js/
│   ├── app.js          ← navigation, init
│   ├── tuner.js        ← Web Audio API pitch detection
│   ├── songs.js        ← song library (localStorage)
│   ├── teacher.js      ← tab display, chord diagram rendering
│   └── chords.js       ← chord shape definitions
└── icons/              ← PWA icons (can add later)
```

## Views / tabs
1. **Tuner** — mic input, autocorrelation pitch detection, visual gauge
2. **Songs** — add YouTube/Spotify URLs, stored in localStorage
3. **Learn** — selected song: embedded video + tabs + chord diagrams

## Data model (localStorage: `guitar-app-songs`)
```json
[{
  "id": "uuid",
  "title": "Song Title",
  "artist": "Artist",
  "youtubeId": "video_id",
  "spotifyId": "track_id",
  "chords": ["Em", "G", "D", "C"],
  "tabs": "raw tab text pasted from Ultimate Guitar",
  "notes": "practice notes",
  "addedAt": 1234567890,
  "lastPracticed": 1234567890
}]
```

## Chord diagram format (chords.js)
Arrays of 6 fret numbers indexed [E2, A2, D3, G3, B3, e4].
-1 = muted, 0 = open, N = fret number.

## Tuner algorithm
Autocorrelation on 2048-sample buffer at 44100Hz sample rate.
Guitar strings: E2=82.41Hz, A2=110Hz, D3=146.83Hz, G3=196Hz, B3=246.94Hz, e4=329.63Hz.
Target accuracy: ±5 cents = "in tune" (green).

## Deployment (Samsung S23)
Option A (recommended): GitHub Pages → HTTPS → mic permission works automatically.
Option B (local): Python `python3 -m http.server 8000` + ADB reverse + `localhost:8000` in Chrome.
See SETUP.md for step-by-step instructions.

## Style guide
- Dark theme: bg #0f0e17, surface #1c1b2e, accent #e8c547 (gold), in-tune #2cb67d
- Mobile-first, 44px minimum touch targets
- No sheet music anywhere — tabs and chord diagrams only
