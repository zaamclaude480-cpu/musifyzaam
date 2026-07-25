'use strict';

const { ytApiSearch } = require('./lib/ytApiSearch');

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

function respond(statusCode, success, message, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      creator: '@Zaam',
      status: success,
      message,
      totalResults: data ? data.length : 0,
      result: data
    })
  };
}

exports.handler = async (event) => {
  try {
    const query = event.queryStringParameters && event.queryStringParameters.q;

    if (!query || !query.trim()) {
      return respond(400, false, 'Parameter "q" (kata kunci) wajib diisi.', []);
    }

    const videos = await ytApiSearch(query, { maxResults: 24 });

    if (!videos.length) {
      return respond(404, false, 'Tidak ada hasil yang ditemukan untuk kata kunci ini.', []);
    }

    return respond(200, true, 'Berhasil mendapatkan data pencarian.', videos.map(formatVideo));
  } catch (err) {
    console.error('Error search:', err.stack || err.message);
    // Surface the real error message in the response itself (instead of only
    // the function log) so it's easy to diagnose from a phone browser.
    return respond(500, false, 'DEBUG - error saat mencari: ' + (err.message || String(err)), []);
  }
};
