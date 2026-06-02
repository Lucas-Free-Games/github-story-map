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
exports.geminiProxy = exports.anthropicProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const https = __importStar(require("https"));
const url_1 = require("url");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const ANTHROPIC_API_KEY = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const GEMINI_API_KEY = (0, params_1.defineSecret)('GEMINI_API_KEY');
async function requireSignedInUser(req, res) {
    var _a;
    const header = (_a = req.headers.authorization) !== null && _a !== void 0 ? _a : '';
    const match = /^Bearer\s+(.+)$/.exec(header);
    if (!match) {
        res.status(401).json({ error: 'Missing Authorization: Bearer <Firebase ID token>' });
        return false;
    }
    try {
        await (0, auth_1.getAuth)().verifyIdToken(match[1]);
        return true;
    }
    catch (_b) {
        res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
        return false;
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
exports.anthropicProxy = (0, https_1.onRequest)({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 3600, cors: false }, async (req, res) => {
    if (!(await requireSignedInUser(req, res)))
        return;
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
        if (k === 'host' || k === 'authorization' || k === 'x-api-key')
            continue;
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
});
exports.geminiProxy = (0, https_1.onRequest)({ secrets: [GEMINI_API_KEY], timeoutSeconds: 540, cors: false }, async (req, res) => {
    if (!(await requireSignedInUser(req, res)))
        return;
    const targetPath = req.path.replace(/^\/gemini-api/, '') || '/';
    const targetUrl = new url_1.URL(`https://generativelanguage.googleapis.com${targetPath}`);
    if (req.query) {
        Object.entries(req.query).forEach(([k, v]) => {
            if (k.toLowerCase() === 'key')
                return;
            targetUrl.searchParams.set(k, String(v));
        });
    }
    targetUrl.searchParams.set('key', GEMINI_API_KEY.value());
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
//# sourceMappingURL=index.js.map