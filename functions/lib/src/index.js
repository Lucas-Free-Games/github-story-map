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
exports.anthropicProxy = void 0;
const functions = __importStar(require("firebase-functions"));
const https = __importStar(require("https"));
const url_1 = require("url");
/**
 * Proxies requests from /anthropic-api/* to https://api.anthropic.com/*
 * so the browser avoids CORS restrictions.
 */
exports.anthropicProxy = functions.https.onRequest((req, res) => {
    // Strip the /anthropic-api prefix
    const targetPath = req.path.replace(/^\/anthropic-api/, '') || '/';
    const targetUrl = new url_1.URL(`https://api.anthropic.com${targetPath}`);
    if (req.query) {
        Object.entries(req.query).forEach(([k, v]) => {
            targetUrl.searchParams.set(k, String(v));
        });
    }
    // Forward all headers except host
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() !== 'host')
            forwardHeaders[key] = value;
    }
    const options = {
        hostname: targetUrl.hostname,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: forwardHeaders,
    };
    const proxyReq = https.request(options, (proxyRes) => {
        var _a;
        res.status((_a = proxyRes.statusCode) !== null && _a !== void 0 ? _a : 502);
        // Forward response headers (needed for SSE)
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
    if (req.body && Buffer.isBuffer(req.body)) {
        proxyReq.write(req.body);
    }
    else if (req.body) {
        proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
});
//# sourceMappingURL=index.js.map