# Setting up Guitar App on Samsung S23

## Option A — GitHub Pages (Recommended)
This gives you HTTPS, which is required for the microphone tuner to work on Android Chrome.

### 1. Create a GitHub account (if you don't have one)
Go to github.com and sign up — it's free.

### 2. Create a new repository
- Click "+" → "New repository"
- Name it: `guitar-app` (or anything you like)
- Set to **Public**
- Click "Create repository"

### 3. Upload the files
On your laptop, in a terminal:

```bash
cd /home/lewis/Documents/guitar-app
git init
git add .
git commit -m "Initial guitar app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/guitar-app.git
git push -u origin main
```

### 4. Enable GitHub Pages
- Go to your repo on github.com
- Click **Settings** → **Pages**
- Under "Source", select **main** branch, folder **/ (root)**
- Click **Save**
- Wait ~2 minutes, then your app is live at:
  `https://YOUR_USERNAME.github.io/guitar-app/`

### 5. Open on Samsung S23
- Open **Chrome** on your S23
- Go to `https://YOUR_USERNAME.github.io/guitar-app/`
- Tap the **⋮ menu** → **Add to Home screen**
- Tap **Add** — it now appears on your home screen like a native app

### 6. Allow microphone for the tuner
- First time you tap "Start Tuner", Chrome will ask for mic permission
- Tap **Allow**
- If you accidentally denied it: Settings → Site Settings → Microphone → find the site → Allow

---

## Option B — Local network (no internet needed, quick test)

### On your laptop:
```bash
cd /home/lewis/Documents/guitar-app
python3 -m http.server 8080
```

Then find your laptop's local IP:
```bash
hostname -I
```
(e.g. `192.168.1.42`)

### On your S23:
- Make sure both devices are on the same Wi-Fi
- Open Chrome and go to: `http://192.168.1.42:8080`
- **Note:** The tuner may not work over plain HTTP on Android — Chrome blocks mic access without HTTPS on non-localhost connections.
- For local testing only: connect phone to laptop via USB, then use ADB:
  ```bash
  adb reverse tcp:8080 tcp:8080
  ```
  Then on the phone go to `http://localhost:8080` — this will work with mic access.

---

## Updating the app later
When you make changes on your laptop:
```bash
cd /home/lewis/Documents/guitar-app
git add .
git commit -m "Update"
git push
```
GitHub Pages updates within 1-2 minutes. On the phone, pull down to refresh or clear the cache.

---

## Using the app

### Tuner
1. Tap **Start Tuner**
2. Allow microphone access
3. Pluck a string — the big note display shows what note it detected
4. The needle shows if you're flat (left) or sharp (right)
5. Tune the peg until the needle is centred and the note turns **green**
6. Standard tuning (thickest to thinnest string): **E · A · D · G · B · e**

### Adding songs
1. Tap **Songs** at the bottom
2. Find the song on YouTube, copy the URL
3. Paste it into the box and tap **Add**
4. The song is saved with its thumbnail and title

### Learning a song
1. From Songs, tap the song
2. **Chords tab**: Search for chords (e.g. "Em") to add chord diagrams
3. **Tabs tab**: Go to [Ultimate Guitar](https://www.ultimate-guitar.com), find a tab for your song, copy and paste it here
4. Use the auto-scroll slider to scroll at a comfortable pace while you play
5. **Notes tab**: Write practice reminders or progress notes

### Getting tabs
The best free source for guitar tabs is **Ultimate Guitar** (ultimate-guitar.com).
Search for your song, look for "Guitar Tab" or "Chords" versions.
The "Chords" versions are easier to start with as a beginner.
Copy the tab text and paste it into the Tabs section.
