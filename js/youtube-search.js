// YouTube search via Invidious instances (open YouTube API, no key needed)

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.cdaut.de',
  'https://invidious.privacydev.net',
  'https://invidious.lunar.icu',
];

async function searchYouTube(query) {
  const makeRequest = async (host) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const url = `${host}/api/v1/search?` + new URLSearchParams({
        q: query, type: 'video',
        fields: 'videoId,title,author,videoThumbnails',
      });
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('bad');
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) throw new Error('empty');
      clearTimeout(timer);
      return items.slice(0, 8).map(v => ({
        videoId: v.videoId,
        title: v.title || 'Unknown',
        author: v.author || '',
        // Always use YouTube's CDN for thumbnails (reliable)
        thumb: `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
      }));
    } finally {
      clearTimeout(timer);
    }
  };

  // Race all instances — use first one that succeeds
  try {
    return await Promise.any(INVIDIOUS_INSTANCES.map(makeRequest));
  } catch {
    return null; // all failed
  }
}

function isYouTubeUrl(str) {
  return /youtube\.com|youtu\.be/.test(str);
}

function isSpotifyUrl(str) {
  return /spotify\.com/.test(str);
}
