// Vercel Serverless Function: echte Google-Bewertungen (Places API New)
// Env: GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID (nur in Vercel setzen, nie im Code)

const CACHE = 's-maxage=21600, stale-while-revalidate=86400';

function send(res, body) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', CACHE);
  res.end(JSON.stringify(body));
}

function mapPlace(data) {
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  return {
    configured: true,
    rating: typeof data.rating === 'number' ? data.rating : null,
    count: typeof data.userRatingCount === 'number' ? data.userRatingCount : 0,
    mapsUrl: data.googleMapsUri || null,
    reviews: reviews
      .map((r) => {
        const a = r.authorAttribution || {};
        return {
          author: a.displayName || '',
          photo: a.photoUri || null,
          rating: typeof r.rating === 'number' ? r.rating : null,
          text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || '',
          relativeTime: r.relativePublishTimeDescription || '',
          authorUrl: a.uri || null,
        };
      })
      .filter((r) => r.author && r.rating),
  };
}

async function handler(req, res) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  const empty = { configured: false, reviews: [] };
  if (!key || !placeId) return send(res, empty);

  try {
    const url = 'https://places.googleapis.com/v1/places/' + encodeURIComponent(placeId) + '?languageCode=de';
    const r = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri',
      },
    });
    if (!r.ok) return send(res, empty);
    const data = await r.json();
    return send(res, mapPlace(data));
  } catch (e) {
    return send(res, empty);
  }
}

module.exports = handler;
module.exports.mapPlace = mapPlace;
