import * as functions from 'firebase-functions';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Proxies requests from /anthropic-api/* to https://api.anthropic.com/*
 * so the browser avoids CORS restrictions.
 */
export const anthropicProxy = functions.https.onRequest((req, res) => {
  // Strip the /anthropic-api prefix
  const targetPath = req.path.replace(/^\/anthropic-api/, '') || '/';
  const targetUrl = new URL(`https://api.anthropic.com${targetPath}`);
  if (req.query) {
    Object.entries(req.query).forEach(([k, v]) => {
      targetUrl.searchParams.set(k, String(v));
    });
  }

  // Forward all headers except host
  const forwardHeaders: http.OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() !== 'host') forwardHeaders[key] = value;
  }

  const options: https.RequestOptions = {
    hostname: targetUrl.hostname,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: forwardHeaders,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode ?? 502);
    // Forward response headers (needed for SSE)
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) res.setHeader(key, value);
    }
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(502).json({ error: err.message });
  });

  if (req.body && Buffer.isBuffer(req.body)) {
    proxyReq.write(req.body);
  } else if (req.body) {
    proxyReq.write(JSON.stringify(req.body));
  }

  proxyReq.end();
});
