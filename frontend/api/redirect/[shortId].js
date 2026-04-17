const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function sanitizeBaseUrl(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return trimmed.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function getShortId(value) {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return typeof value === 'string' ? value : '';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed',
        data: {},
      });
    }

    const shortId = getShortId(req.query.shortId);
    if (!shortId || !SHORT_ID_PATTERN.test(shortId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid short ID format.',
        data: {},
      });
    }

    const backendBaseUrl =
      sanitizeBaseUrl(process.env.BACKEND_REDIRECT_BASE_URL) ||
      sanitizeBaseUrl(process.env.VITE_API_BASE_URL);

    if (!backendBaseUrl) {
      return res.status(500).json({
        success: false,
        message: 'Redirect proxy is not configured. Set BACKEND_REDIRECT_BASE_URL in Vercel.',
        data: {},
      });
    }

    const upstreamUrl = `${backendBaseUrl}/${encodeURIComponent(shortId)}`;

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'user-agent': 'ParrotNest-Vercel-Redirect/1.0',
        },
      });

      const location = upstreamResponse.headers.get('location');
      if (location && upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
        // Use explicit headers instead of res.redirect() for maximum runtime compatibility.
        res.statusCode = upstreamResponse.status;
        res.setHeader('Location', location);
        res.setHeader('Cache-Control', 'no-store');
        return res.end();
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await upstreamResponse.json();
        return res.status(upstreamResponse.status).json(payload);
      }

      const textPayload = await upstreamResponse.text();
      return res.status(upstreamResponse.status).send(textPayload || 'Upstream redirect service response.');
    } catch {
      return res.status(502).json({
        success: false,
        message: 'Unable to reach redirect service.',
        data: {},
      });
    }
  } catch (err) {
    console.error('[redirect proxy] Unhandled function error:', err);
    return res.status(500).json({
      success: false,
      message: 'Redirect proxy failed unexpectedly.',
      data: {},
    });
  }
}