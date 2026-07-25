'use strict';

// Calls YouTube's own internal "innertube" search API (the same endpoint
// the youtube.com web client uses under the hood) instead of scraping the
// HTML results page. This is meaningfully more reliable from data-center
// IPs (like serverless functions), because it returns JSON directly and
// isn't affected by the HTML "before you continue" consent wall that
// sometimes intercepts scraped requests from cloud IP ranges.
//
// The API key below is the public, unauthenticated key embedded in every
// youtube.com page load; it is not a secret and carries no account access.
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/search?key=' + INNERTUBE_KEY + '&prettyPrint=false';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.youtube.com',
  'Referer': 'https://www.youtube.com/',
  // Pre-accepting the EU/regional consent choice avoids that request being
  // redirected to a "before you continue" consent page instead of data.
  'Cookie': 'CONSENT=YES+1; PREF=hl=en&gl=US'
};

function textFromRuns(node) {
  if (!node) return '';
  if (node.simpleText) return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map(function (r) { return r.text; }).join('');
  return '';
}

function parseViewCount(viewCountText) {
  var text = textFromRuns(viewCountText);
  var digits = text.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function bestThumbnail(vr) {
  var list = vr.thumbnail && vr.thumbnail.thumbnails;
  if (!list || !list.length) return '';
  return list[list.length - 1].url;
}

function extractVideoRenderers(data, maxResults) {
  var items = [];
  var sections =
    data &&
    data.contents &&
    data.contents.twoColumnSearchResultsRenderer &&
    data.contents.twoColumnSearchResultsRenderer.primaryContents &&
    data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer &&
    data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;

  if (!sections) {
    throw new Error('Struktur respons YouTube tidak sesuai dugaan (kemungkinan format berubah).');
  }

  for (var i = 0; i < sections.length && items.length < maxResults; i++) {
    var contents = sections[i].itemSectionRenderer && sections[i].itemSectionRenderer.contents;
    if (!contents) continue;

    for (var j = 0; j < contents.length && items.length < maxResults; j++) {
      var vr = contents[j].videoRenderer;
      if (!vr || !vr.videoId) continue;

      items.push({
        videoId: vr.videoId,
        title: textFromRuns(vr.title),
        duration: vr.lengthText ? textFromRuns(vr.lengthText) : 'LIVE',
        views: parseViewCount(vr.viewCountText),
        ago: vr.publishedTimeText ? textFromRuns(vr.publishedTimeText) : 'N/A',
        author: {
          name: vr.ownerText ? textFromRuns(vr.ownerText) : 'Unknown',
          url: vr.ownerText && vr.ownerText.runs && vr.ownerText.runs[0] &&
               vr.ownerText.runs[0].navigationEndpoint &&
               vr.ownerText.runs[0].navigationEndpoint.commandMetadata &&
               vr.ownerText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata
            ? 'https://www.youtube.com' + vr.ownerText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url
            : ''
        },
        thumbnail: bestThumbnail(vr)
      });
    }
  }

  return items;
}

/**
 * A single attempt at searching YouTube via the internal JSON API.
 * @param {string} query
 * @param {{maxResults?: number, timeoutMs?: number}} opts
 * @returns {Promise<Array>}
 */
async function searchOnce(query, opts) {
  var maxResults = opts.maxResults || 24;
  var timeoutMs = opts.timeoutMs || 8000;

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs);

  var res;
  try {
    res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240701.00.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query: query
      })
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Permintaan ke YouTube timeout setelah ' + timeoutMs + 'ms.');
    }
    throw new Error('Gagal menghubungi YouTube: ' + err.message);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error('YouTube membalas HTTP ' + res.status + ' (' + res.statusText + ').');
  }

  var data = await res.json();
  return extractVideoRenderers(data, maxResults);
}

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Search YouTube, retrying once on transient failures (timeouts, empty
 * parses, non-2xx responses) before giving up.
 * @param {string} query
 * @param {{maxResults?: number, timeoutMs?: number, retries?: number}} opts
 * @returns {Promise<Array>} list of video objects
 */
async function ytApiSearch(query, opts) {
  opts = opts || {};
  var retries = opts.retries != null ? opts.retries : 1;
  var lastErr = null;

  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      var items = await searchOnce(query, opts);
      if (items.length) return items;
      lastErr = new Error('0 hasil pada percobaan ke-' + (attempt + 1) + '.');
    } catch (err) {
      lastErr = err;
    }
    if (attempt < retries) await delay(400 * (attempt + 1));
  }

  throw lastErr || new Error('Pencarian gagal tanpa keterangan.');
}

module.exports = { ytApiSearch: ytApiSearch };
