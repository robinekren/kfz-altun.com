// Vercel Serverless Function: Google-Bewertungslink aus GOOGLE_PLACE_ID (kein API-Key nötig)

module.exports = function handler(req, res) {
  const placeId = process.env.GOOGLE_PLACE_ID;
  const url = placeId
    ? 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(placeId)
    : null;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
  res.end(JSON.stringify({ url }));
};
