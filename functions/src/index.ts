import { onRequest, type Request } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as https from 'https';
import * as http from 'http';
import type { Response } from 'express';
import { URL } from 'url';

if (!getApps().length) initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

async function requireSignedInUser(req: Request, res: Response): Promise<boolean> {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <Firebase ID token>' });
    return false;
  }
  try {
    await getAuth().verifyIdToken(match[1]);
    return true;
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
    return false;
  }
}

function pipeUpstream(
  res: Response,
  options: https.RequestOptions,
  body: Buffer | string | undefined,
): void {
  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode ?? 502);
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) res.setHeader(key, value);
    }
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(502).json({ error: err.message });
  });
  if (body) proxyReq.write(body);
  proxyReq.end();
}

export const anthropicProxy = onRequest(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 3600, cors: false },
  async (req, res) => {
    if (!(await requireSignedInUser(req, res))) return;

    const targetPath = req.path.replace(/^\/anthropic-api/, '') || '/';
    const targetUrl = new URL(`https://api.anthropic.com${targetPath}`);
    if (req.query) {
      Object.entries(req.query).forEach(([k, v]) => {
        targetUrl.searchParams.set(k, String(v));
      });
    }

    const forwardHeaders: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const k = key.toLowerCase();
      if (k === 'host' || k === 'authorization' || k === 'x-api-key') continue;
      forwardHeaders[key] = value;
    }
    forwardHeaders['x-api-key'] = ANTHROPIC_API_KEY.value();

    const body = Buffer.isBuffer(req.body)
      ? req.body
      : req.body
        ? JSON.stringify(req.body)
        : undefined;

    pipeUpstream(res, {
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: forwardHeaders,
    }, body);
  },
);

export const geminiProxy = onRequest(
  { secrets: [GEMINI_API_KEY], timeoutSeconds: 540, cors: false },
  async (req, res) => {
    if (!(await requireSignedInUser(req, res))) return;

    const targetPath = req.path.replace(/^\/gemini-api/, '') || '/';
    const targetUrl = new URL(`https://generativelanguage.googleapis.com${targetPath}`);
    if (req.query) {
      Object.entries(req.query).forEach(([k, v]) => {
        if (k.toLowerCase() === 'key') return;
        targetUrl.searchParams.set(k, String(v));
      });
    }
    targetUrl.searchParams.set('key', GEMINI_API_KEY.value());

    const forwardHeaders: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const k = key.toLowerCase();
      if (k === 'host' || k === 'authorization') continue;
      forwardHeaders[key] = value;
    }

    const body = Buffer.isBuffer(req.body)
      ? req.body
      : req.body
        ? JSON.stringify(req.body)
        : undefined;

    pipeUpstream(res, {
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: forwardHeaders,
    }, body);
  },
);
