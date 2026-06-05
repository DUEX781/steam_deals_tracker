const STEAM_SEARCH_URL = 'https://store.steampowered.com/search/results/';
const STEAM_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const STEAM_REVIEWS_URL = 'https://store.steampowered.com/appreviews/';

const DEFAULT_CC = 'cn';
const DEFAULT_LANG = 'schinese';
const PAGE_SIZE = 20;
const MAX_PAGE = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (url.pathname === '/api/apps') {
      return handleAppsRequest(url);
    }

    if (url.pathname !== '/api/search') {
      return jsonResponse({ error: 'Not found', usage: '/api/search?q=F1&page=1 or /api/apps?ids=730,945360' }, 404);
    }

    const query = (url.searchParams.get('q') || '').trim();
    const page = clampNumber(Number(url.searchParams.get('page') || 1), 1, MAX_PAGE);
    const cc = sanitizeParam(url.searchParams.get('cc') || DEFAULT_CC, DEFAULT_CC);
    const lang = sanitizeParam(url.searchParams.get('l') || DEFAULT_LANG, DEFAULT_LANG);

    if (!query) {
      return jsonResponse({ query, page, count: 0, results: [] });
    }

    try {
      const appids = await searchSteamAppids(query, page, cc, lang);
      const results = await fetchAppDetailsWithReviews(appids, cc, lang);

      return jsonResponse({
        query,
        page,
        count: results.length,
        appids,
        results,
      });
    } catch (error) {
      return jsonResponse(
        {
          error: 'Steam search failed',
          message: error instanceof Error ? error.message : String(error),
        },
        502,
      );
    }
  },
};

async function handleAppsRequest(url) {
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isInteger(value) && value > 0)
    .slice(0, PAGE_SIZE);
  const cc = sanitizeParam(url.searchParams.get('cc') || DEFAULT_CC, DEFAULT_CC);
  const lang = sanitizeParam(url.searchParams.get('l') || DEFAULT_LANG, DEFAULT_LANG);

  if (ids.length === 0) {
    return jsonResponse({
      count: 0,
      appids: [],
      results: [],
    });
  }

  try {
    const results = await fetchAppDetailsWithReviews(ids, cc, lang);

    return jsonResponse({
      count: results.length,
      appids: ids,
      results,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'Steam apps refresh failed',
        message: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  }
}

async function searchSteamAppids(query, page, cc, lang) {
  const start = (page - 1) * PAGE_SIZE;
  const searchUrl = new URL(STEAM_SEARCH_URL);

  searchUrl.search = new URLSearchParams({
    term: query,
    start: String(start),
    count: String(PAGE_SIZE),
    dynamic_data: '',
    sort_by: '_ASC',
    category1: '998',
    infinite: '1',
    cc,
    l: lang,
  }).toString();

  const response = await fetch(searchUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 Steam Search Worker',
      'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Steam search returned ${response.status}`);
  }

  const data = await response.json();
  const html = data.results_html || '';

  return extractAppids(html).slice(0, PAGE_SIZE);
}

function extractAppids(html) {
  const appids = [];
  const seen = new Set();
  const patterns = [
    /data-ds-appid="(\d+)"/g,
    /\/app\/(\d+)/g,
  ];

  patterns.forEach(pattern => {
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const appid = Number(match[1]);

      if (!seen.has(appid)) {
        seen.add(appid);
        appids.push(appid);
      }
    }
  });

  return appids;
}

async function fetchAppDetailsWithReviews(appids, cc, lang) {
  const details = await Promise.all(appids.map(async appid => {
    const detail = await fetchSingleAppDetail(appid, cc, lang);

    if (!detail) {
      return null;
    }

    try {
      detail.top_review = await fetchTopReview(appid, lang);
    } catch {
      detail.top_review = getEmptyReview();
    }

    return detail;
  }));

  return details.filter(Boolean);
}

async function fetchSingleAppDetail(appid, cc, lang) {
  const detailsUrl = new URL(STEAM_DETAILS_URL);

  detailsUrl.search = new URLSearchParams({
    appids: String(appid),
    cc,
    l: lang,
  }).toString();

  const response = await fetch(detailsUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 Steam Search Worker',
      'Accept': 'application/json,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const appData = data[String(appid)];

  if (!appData?.success || !appData.data) {
    return null;
  }

  return normalizeAppDetail(appid, appData.data);
}

async function fetchTopReview(appid, lang) {
  const baseParams = {
    json: '1',
    filter: 'all',
    day_range: '365',
    cursor: '*',
    review_type: 'all',
    purchase_type: 'all',
    num_per_page: '1',
  };

  for (const language of [lang, 'all']) {
    const reviewUrl = new URL(`${STEAM_REVIEWS_URL}${appid}`);

    reviewUrl.search = new URLSearchParams({
      ...baseParams,
      language,
    }).toString();

    let response;

    try {
      response = await fetch(reviewUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 Steam Search Worker',
          'Accept': 'application/json,*/*;q=0.8',
        },
      });
    } catch {
      continue;
    }

    if (!response.ok) {
      continue;
    }

    let data;

    try {
      data = await response.json();
    } catch {
      continue;
    }
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    const review = reviews[0];

    if (!review) {
      continue;
    }

    return {
      text: cleanText(review.review || '', 350),
      voted_up: typeof review.voted_up === 'boolean' ? review.voted_up : null,
      votes_up: Number(review.votes_up || 0),
      weighted_vote_score: String(review.weighted_vote_score || '0'),
    };
  }

  return getEmptyReview();
}

function normalizeAppDetail(appid, details) {
  const price = details.price_overview || {};
  const metacritic = details.metacritic || {};
  const releaseDate = details.release_date || {};
  const recommendations = details.recommendations || {};

  const genres = Array.isArray(details.genres)
    ? details.genres.map(item => item.description).filter(Boolean).slice(0, 5)
    : [];

  const categories = Array.isArray(details.categories)
    ? details.categories.map(item => item.description).filter(Boolean).slice(0, 5)
    : [];

  return {
    appid,
    name: details.name || 'Unknown Game',
    discount: Number(price.discount_percent || 0),
    original_price: price.initial_formatted || formatPrice(price.initial, price.currency),
    final_price: price.final_formatted || formatPrice(price.final, price.currency),
    final_price_num: Number(price.final || 0) / 100,
    description: cleanText(details.short_description || ''),
    popularity: Number(recommendations.total || 0),
    image_url: details.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    genres,
    categories,
    metacritic_score: metacritic.score || null,
    release_date: releaseDate.date || '未知',
    developers: Array.isArray(details.developers) ? details.developers.slice(0, 2) : [],
    publishers: Array.isArray(details.publishers) ? details.publishers.slice(0, 2) : [],
    platforms: details.platforms || {},
    url: `https://store.steampowered.com/app/${appid}`,
    top_review: getEmptyReview(),
  };
}

function getEmptyReview() {
  return {
    text: '暂无热门评论',
    voted_up: null,
    votes_up: 0,
    weighted_vote_score: '0',
  };
}

function formatPrice(value, currency) {
  if (typeof value !== 'number') {
    return '未知';
  }

  const prefix = currency === 'CNY' ? '¥ ' : `${currency || ''} `;

  return `${prefix}${(value / 100).toFixed(2)}`.trim();
}

function cleanText(text, maxLength = 450) {
  const cleaned = String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '暂无简介';
  }

  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function sanitizeParam(value, fallback) {
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : fallback;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
