import { onRequest, onCall, HttpsError, type Request } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as https from 'https';
import * as http from 'http';
import type { Response } from 'express';
import { URL } from 'url';

if (!getApps().length) initializeApp();

type Provider = 'anthropic' | 'gemini' | 'github';

interface UserKeysDoc {
  anthropic?: string;
  gemini?: string;
  github?: string;
}

async function getUserKey(uid: string, provider: Provider): Promise<string | null> {
  const snap = await getFirestore().doc(`userKeys/${uid}`).get();
  const data = snap.data() as UserKeysDoc | undefined;
  return data?.[provider]?.trim() || null;
}

async function requireSignedInUid(req: Request, res: Response): Promise<string | null> {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <Firebase ID token>' });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
    return null;
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
  { timeoutSeconds: 3600, cors: false },
  async (req, res) => {
    const uid = await requireSignedInUid(req, res);
    if (!uid) return;

    const apiKey = await getUserKey(uid, 'anthropic');
    if (!apiKey) {
      res.status(400).json({ error: 'No Anthropic API key configured. Add one in Settings.' });
      return;
    }

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
      // Drop browser-origin fingerprints so Anthropic doesn't classify this
      // as a direct browser call and demand the dangerous-access header.
      if (
        k === 'host' || k === 'authorization' || k === 'x-api-key' ||
        k === 'origin' || k === 'referer' || k === 'user-agent' ||
        k.startsWith('sec-') || k === 'cookie'
      ) continue;
      forwardHeaders[key] = value;
    }
    forwardHeaders['x-api-key'] = apiKey;
    forwardHeaders['user-agent'] = 'github-story-map';

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
  { timeoutSeconds: 540, cors: false },
  async (req, res) => {
    const uid = await requireSignedInUid(req, res);
    if (!uid) return;

    const apiKey = await getUserKey(uid, 'gemini');
    if (!apiKey) {
      res.status(400).json({ error: 'No Gemini API key configured. Add one in Settings.' });
      return;
    }

    const targetPath = req.path.replace(/^\/gemini-api/, '') || '/';
    const targetUrl = new URL(`https://generativelanguage.googleapis.com${targetPath}`);
    if (req.query) {
      Object.entries(req.query).forEach(([k, v]) => {
        if (k.toLowerCase() === 'key') return;
        targetUrl.searchParams.set(k, String(v));
      });
    }
    targetUrl.searchParams.set('key', apiKey);

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

function assertProvider(value: unknown): asserts value is Provider {
  if (value !== 'anthropic' && value !== 'gemini' && value !== 'github') {
    throw new HttpsError('invalid-argument', 'provider must be "anthropic", "gemini", or "github"');
  }
}

export const saveUserKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { provider, apiKey } = (request.data ?? {}) as { provider?: unknown; apiKey?: unknown };
  assertProvider(provider);
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    throw new HttpsError('invalid-argument', 'apiKey is required.');
  }
  await getFirestore().doc(`userKeys/${request.auth.uid}`).set(
    { [provider]: apiKey.trim() },
    { merge: true },
  );
  return { ok: true };
});

export const deleteUserKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { provider } = (request.data ?? {}) as { provider?: unknown };
  assertProvider(provider);
  await getFirestore().doc(`userKeys/${request.auth.uid}`).set(
    { [provider]: FieldValue.delete() },
    { merge: true },
  );
  return { ok: true };
});

export const getUserKeyStatus = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const snap = await getFirestore().doc(`userKeys/${request.auth.uid}`).get();
  const data = (snap.data() ?? {}) as UserKeysDoc;
  return {
    anthropic: !!data.anthropic,
    gemini: !!data.gemini,
    github: !!data.github,
  };
});

export const githubProxy = onRequest(
  { timeoutSeconds: 540, cors: false },
  async (req, res) => {
    const uid = await requireSignedInUid(req, res);
    if (!uid) return;

    const token = await getUserKey(uid, 'github');
    if (!token) {
      res.status(400).json({ error: 'No GitHub token stored. Sign in with GitHub to refresh it.' });
      return;
    }

    const targetPath = req.path.replace(/^\/github-api/, '') || '/';
    const targetUrl = new URL(`https://api.github.com${targetPath}`);
    if (req.query) {
      Object.entries(req.query).forEach(([k, v]) => {
        targetUrl.searchParams.set(k, String(v));
      });
    }

    const forwardHeaders: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const k = key.toLowerCase();
      if (k === 'host' || k === 'authorization') continue;
      forwardHeaders[key] = value;
    }
    forwardHeaders['authorization'] = `Bearer ${token}`;
    if (!forwardHeaders['user-agent']) forwardHeaders['user-agent'] = 'github-story-map';

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
