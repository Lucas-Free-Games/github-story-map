"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubProxy = exports.getUserKeyStatus = exports.deleteUserKey = exports.saveUserKey = exports.geminiProxy = exports.anthropicProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https = __importStar(require("https"));
const url_1 = require("url");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
async function getUserKey(uid, provider) {
    var _a;
    const snap = await (0, firestore_1.getFirestore)().doc(`userKeys/${uid}`).get();
    const data = snap.data();
    return ((_a = data === null || data === void 0 ? void 0 : data[provider]) === null || _a === void 0 ? void 0 : _a.trim()) || null;
}
async function requireSignedInUid(req, res) {
    var _a;
    const header = (_a = req.headers.authorization) !== null && _a !== void 0 ? _a : '';
    const match = /^Bearer\s+(.+)$/.exec(header);
    if (!match) {
        res.status(401).json({ error: 'Missing Authorization: Bearer <Firebase ID token>' });
        return null;
    }
    try {
        const decoded = await (0, auth_1.getAuth)().verifyIdToken(match[1]);
        return decoded.uid;
    }
    catch (_b) {
        res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
        return null;
    }
}
function pipeUpstream(res, options, body) {
    const proxyReq = https.request(options, (proxyRes) => {
        var _a;
        res.status((_a = proxyRes.statusCode) !== null && _a !== void 0 ? _a : 502);
        for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (value !== undefined)
                res.setHeader(key, value);
        }
        proxyRes.pipe(res, { end: true });
    });
    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.status(502).json({ error: err.message });
    });
    if (body)
        proxyReq.write(body);
    proxyReq.end();
}
exports.anthropicProxy = (0, https_1.onRequest)({ timeoutSeconds: 3600, cors: false }, async (req, res) => {
    const uid = await requireSignedInUid(req, res);
    if (!uid)
        return;
    const apiKey = await getUserKey(uid, 'anthropic');
    if (!apiKey) {
        res.status(400).json({ error: 'No Anthropic API key configured. Add one in Settings.' });
        return;
    }
    const targetPath = req.path.replace(/^\/anthropic-api/, '') || '/';
    const targetUrl = new url_1.URL(`https://api.anthropic.com${targetPath}`);
    if (req.query) {
        Object.entries(req.query).forEach(([k, v]) => {
            targetUrl.searchParams.set(k, String(v));
        });
    }
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        const k = key.toLowerCase();
        // Drop browser-origin fingerprints so Anthropic doesn't classify this
        // as a direct browser call and demand the dangerous-access header.
        if (k === 'host' || k === 'authorization' || k === 'x-api-key' ||
            k === 'origin' || k === 'referer' || k === 'user-agent' ||
            k.startsWith('sec-') || k === 'cookie')
            continue;
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
});
exports.geminiProxy = (0, https_1.onRequest)({ timeoutSeconds: 540, cors: false }, async (req, res) => {
    const uid = await requireSignedInUid(req, res);
    if (!uid)
        return;
    const apiKey = await getUserKey(uid, 'gemini');
    if (!apiKey) {
        res.status(400).json({ error: 'No Gemini API key configured. Add one in Settings.' });
        return;
    }
    const targetPath = req.path.replace(/^\/gemini-api/, '') || '/';
    const targetUrl = new url_1.URL(`https://generativelanguage.googleapis.com${targetPath}`);
    if (req.query) {
        Object.entries(req.query).forEach(([k, v]) => {
            if (k.toLowerCase() === 'key')
                return;
            targetUrl.searchParams.set(k, String(v));
        });
    }
    targetUrl.searchParams.set('key', apiKey);
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        const k = key.toLowerCase();
        if (k === 'host' || k === 'authorization')
            continue;
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
});
function assertProvider(value) {
    if (value !== 'anthropic' && value !== 'gemini' && value !== 'github') {
        throw new https_1.HttpsError('invalid-argument', 'provider must be "anthropic", "gemini", or "github"');
    }
}
exports.saveUserKey = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    const { provider, apiKey } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    assertProvider(provider);
    if (typeof apiKey !== 'string' || apiKey.trim().length < 8) {
        throw new https_1.HttpsError('invalid-argument', 'apiKey is required.');
    }
    await (0, firestore_1.getFirestore)().doc(`userKeys/${request.auth.uid}`).set({ [provider]: apiKey.trim() }, { merge: true });
    return { ok: true };
});
exports.deleteUserKey = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    const { provider } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    assertProvider(provider);
    await (0, firestore_1.getFirestore)().doc(`userKeys/${request.auth.uid}`).set({ [provider]: firestore_1.FieldValue.delete() }, { merge: true });
    return { ok: true };
});
exports.getUserKeyStatus = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    const snap = await (0, firestore_1.getFirestore)().doc(`userKeys/${request.auth.uid}`).get();
    const data = ((_a = snap.data()) !== null && _a !== void 0 ? _a : {});
    return {
        anthropic: !!data.anthropic,
        gemini: !!data.gemini,
        github: !!data.github,
    };
});
exports.githubProxy = (0, https_1.onRequest)({ timeoutSeconds: 540, cors: false }, async (req, res) => {
    const uid = await requireSignedInUid(req, res);
    if (!uid)
        return;
    const token = await getUserKey(uid, 'github');
    if (!token) {
        res.status(400).json({ error: 'No GitHub token stored. Sign in with GitHub to refresh it.' });
        return;
    }
    const targetPath = req.path.replace(/^\/github-api/, '') || '/';
    const targetUrl = new url_1.URL(`https://api.github.com${targetPath}`);
    if (req.query) {
        Object.entries(req.query).forEach(([k, v]) => {
            targetUrl.searchParams.set(k, String(v));
        });
    }
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        const k = key.toLowerCase();
        if (k === 'host' || k === 'authorization')
            continue;
        forwardHeaders[key] = value;
    }
    forwardHeaders['authorization'] = `Bearer ${token}`;
    if (!forwardHeaders['user-agent'])
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
});
//# sourceMappingURL=index.js.map