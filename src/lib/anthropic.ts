// Requests go through a local proxy (Vite dev) or Firebase Function (production)
// to avoid browser CORS restrictions on api.anthropic.com
const BASE = '/anthropic-api/v1';
// Session lifecycle uses managed-agents only; events/stream use agent-api only
const BETA_SESSIONS = 'managed-agents-2026-04-01';
const BETA_EVENTS   = 'agent-api-2026-03-01';
const VERSION = '2023-06-01';

// --- Settings ---

export interface AnthropicSettings {
  apiKey: string;
  agentId: string;
  envId: string;
  vaultId: string;
}

export function loadAnthropicSettings(): AnthropicSettings {
  return {
    apiKey:  localStorage.getItem('anthropic_api_key')  ?? import.meta.env.VITE_ANTHROPIC_API_KEY  ?? '',
    agentId: localStorage.getItem('anthropic_agent_id') ?? import.meta.env.VITE_ANTHROPIC_AGENT_ID ?? '',
    envId:   localStorage.getItem('anthropic_env_id')   ?? import.meta.env.VITE_ANTHROPIC_ENV_ID   ?? '',
    vaultId: localStorage.getItem('anthropic_vault_id') ?? import.meta.env.VITE_ANTHROPIC_VAULT_ID ?? '',
  };
}

export function saveAnthropicSettings(s: AnthropicSettings): void {
  localStorage.setItem('anthropic_api_key',  s.apiKey.trim());
  localStorage.setItem('anthropic_agent_id', s.agentId.trim());
  localStorage.setItem('anthropic_env_id',   s.envId.trim());
  localStorage.setItem('anthropic_vault_id', s.vaultId.trim());
}

// --- HTTP helpers ---

function jsonHeaders(apiKey: string, beta = BETA_SESSIONS): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': VERSION,
    'anthropic-beta': beta,
    'content-type': 'application/json',
  };
}

// --- Session lifecycle ---

export async function createSession(
  settings: AnthropicSettings,
): Promise<string> {
  const url = `${BASE}/sessions`;
  console.log('[anthropic] POST', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: jsonHeaders(settings.apiKey),
    body: JSON.stringify({
      agent: { type: 'agent', id: settings.agentId },
      environment_id: settings.envId,
      vault_ids: [settings.vaultId],
    }),
  });
  console.log('[anthropic] createSession status:', res.status);
  const text = await res.text();
  console.log('[anthropic] createSession body:', text);
  if (!res.ok) {
    let msg = `Anthropic ${res.status}`;
    try { msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
  const data = JSON.parse(text) as { id: string };
  return data.id;
}

/** Send a task message to the session (POST /sessions/:id/events). */
export async function sendTaskMessage(
  apiKey: string,
  sessionId: string,
  text: string,
): Promise<void> {
  const url = `${BASE}/sessions/${sessionId}/events?beta=true`;
  console.log('[anthropic] POST events', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: jsonHeaders(apiKey, BETA_EVENTS),
    body: JSON.stringify({
      events: [{ type: 'user', content: [{ type: 'text', text }] }],
    }),
  });
  console.log('[anthropic] sendTaskMessage status:', res.status);
  if (!res.ok) {
    const body = await res.text();
    console.log('[anthropic] sendTaskMessage error:', body);
    let msg = `Anthropic ${res.status}`;
    try { msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
}

export async function archiveSession(apiKey: string, sessionId: string): Promise<void> {
  await fetch(`${BASE}/sessions/${sessionId}/archive`, {
    method: 'POST',
    headers: jsonHeaders(apiKey, BETA_EVENTS),
    body: '{}',
  });
}

// --- SSE event streaming ---

export interface AgentEvent {
  type: string;
  content?: string;
  name?: string;
  input?: unknown;
  error?: unknown;
  usage?: unknown;
  stop_reason?: string;
  [key: string]: unknown;
}

/**
 * Opens a live SSE stream at GET /sessions/:id/stream (the correct streaming
 * endpoint per the docs — NOT /events, which returns paginated history).
 *
 * Per the docs: open the stream FIRST, then send the task via sendTaskMessage.
 * The stream stays alive until session.status_idle or session.status_terminated.
 */
export async function streamEvents(
  apiKey: string,
  sessionId: string,
  onEvent: (e: AgentEvent) => void,
  onRaw: (line: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Correct endpoint: /stream (live SSE feed), NOT /events (history list)
  const url = `${BASE}/sessions/${sessionId}/stream?beta=true`;
  console.log('[anthropic] GET (SSE stream)', url);
  const res = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': VERSION,
      'anthropic-beta': BETA_EVENTS,
      accept: 'text/event-stream',
    },
    signal,
  });

  console.log('[anthropic] stream status:', res.status, 'content-type:', res.headers.get('content-type'));

  if (!res.ok) {
    const body = await res.text();
    console.log('[anthropic] stream error body:', body);
    let msg = `Stream ${res.status}`;
    try { msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* */ }
    throw new Error(msg);
  }

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[anthropic] stream done (server closed)');
        break;
      }

      const chunk = dec.decode(value, { stream: true });
      console.log('[anthropic] raw chunk:', JSON.stringify(chunk));
      buf += chunk;

      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.trim()) continue;
        let eventType = '';
        let dataStr = '';
        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
        }
        if (!dataStr) continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(dataStr) as Record<string, unknown>;
        } catch { continue; }

        // The SSE `event:` line is always "message" — the real type is inside the JSON
        const type = (data.type as string) ?? eventType;
        onRaw(`[raw] ${type}: ${dataStr.slice(0, 120)}`);
        onEvent({ ...data, type } as AgentEvent);

        // Terminal events (using JSON type, not SSE event: line)
        if (
          type === 'status_idle' ||
          type === 'status_closed' ||
          type === 'status_terminated' ||
          type === 'session.status_idle' ||
          type === 'session.status_terminated' ||
          type === 'session.error'
        ) {
          reader.cancel().catch(() => {});
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- Issue body helpers ---

const AI_MARKER_START = '<!-- ai-links\n';
const AI_MARKER_END = '-->';

export interface AiLinks { branch?: string; pr?: string }

export function parseAiLinks(body: string): AiLinks {
  const start = body.indexOf(AI_MARKER_START);
  if (start === -1) return {};
  const end = body.indexOf(AI_MARKER_END, start);
  if (end === -1) return {};
  const section = body.slice(start + AI_MARKER_START.length, end);
  const branch = section.match(/branch:\s*(https?:\/\/\S+)/)?.[1];
  const pr     = section.match(/pr:\s*(https?:\/\/\S+)/)?.[1];
  return { branch, pr };
}

export function encodeAiLinks(body: string, links: AiLinks): string {
  const markerIdx = body.indexOf('\n\n' + AI_MARKER_START);
  const base = (markerIdx >= 0 ? body.slice(0, markerIdx) : body).trimEnd();
  if (!links.branch && !links.pr) return base;
  const lines: string[] = [];
  if (links.branch) lines.push(`branch: ${links.branch}`);
  if (links.pr)     lines.push(`pr: ${links.pr}`);
  return `${base}\n\n${AI_MARKER_START}${lines.join('\n')}\n${AI_MARKER_END}`;
}

/** Extract GitHub branch and PR URLs from free text. */
export function extractLinks(text: string, owner: string, repo: string): AiLinks {
  const escaped = `https://github\\.com/${owner}/${repo}`;
  const prMatch     = text.match(new RegExp(`${escaped}/pull/(\\d+)`));
  const branchMatch = text.match(new RegExp(`${escaped}/(?:tree|compare)/([^\\s)>"']+)`));
  return {
    pr:     prMatch     ? `https://github.com/${owner}/${repo}/pull/${prMatch[1]}`     : undefined,
    branch: branchMatch ? `https://github.com/${owner}/${repo}/tree/${branchMatch[1]}` : undefined,
  };
}
