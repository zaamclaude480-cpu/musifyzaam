'use strict';

const NodeCache = require('node-cache');
const { ytApiSearch } = require('./lib/ytApiSearch');

// In-memory cache, 1 hour TTL (3600s). Persists for the lifetime of a warm
// serverless instance, so results are refreshed at most once per hour per
// instance rather than on every request.
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
const CACHE_KEY = 'tophits_v1';

// Curated set of broad queries used to assemble a "top hits" feed, since
// there is no dedicated trending endpoint being called here.
const SEED_QUERIES = [
  'top hits 2026',
  'lagu hits terbaru 2026',
  'billboard hot 100 2026',
  'trending music this week',
  'lagu viral tiktok 2026'
];

function formatVideo(video) {
  const videoId = video.videoId;
  return {
    id: videoId,
    title: video.title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    duration: video.duration || 'N/A',
    views: video.views || 0,
    uploadedAt: video.ago || 'N/A',
    author: {
      name: video.author ? video.author.name : 'Unknown',
      url: video.author ? video.author.url : ''
    },
    thumbnails: {
      hd: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      sd: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      default: video.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    }
  };
}

async function buildTopHits() {
  const seen = new Set();
  const results = [];
  let lastError = null;

  for (const query of SEED_QUERIES) {
    if (results.length >= 24) break;
    try {
      const videos = await ytApiSearch(query, { maxResults: 6 });
      for (const v of videos) {
        if (!v.videoId || seen.has(v.videoId)) continue;
        seen.add(v.videoId);
        results.push(formatVideo(v));
        if (results.length >= 24) break;
      }
    } catch (e) {
      // Skip a seed query that fails; the others still contribute.
      console.error(`tophits: seed query "${query}" failed:`, e.stack || e.message);
      lastError = e;
    }
  }

  return { results, lastError };
}

function respond(statusCode, success, message, data, cached) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    },
    body: JSON.stringify({
      creator: '@Zaam',
      status: success,
      message,
      cached: !!cached,
      totalResults: data ? data.length : 0,
      result: data
    })
  };
}

exports.handler = async () => {
  try {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return respond(200, true, 'Top hits (dari cache, refresh tiap 1 jam).', cached, true);
    }

    const { results, lastError } = await buildTopHits();

    if (!results.length) {
      const debugMsg = lastError
        ? 'DEBUG - error saat mengambil top hits: ' + (lastError.message || String(lastError))
        : 'Tidak dapat mengambil data top hits saat ini.';
      return respond(502, false, debugMsg, []);
    }

    cache.set(CACHE_KEY, results);
    return respond(200, true, 'Top hits (data baru, akan di-cache 1 jam).', results, false);
  } catch (err) {
    console.error('Error tophits:', err.stack || err.message);
    return respond(500, false, 'DEBUG - error tophits: ' + (err.message || String(err)), []);
  }
};
