import { useState, useRef, useEffect, useMemo, type RefObject } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue } from '../types';
import { generateDescription, loadGeminiSettings, GEMINI_MODELS } from '../lib/gemini';
import type { IssueContext } from '../lib/gemini';
import { fetchIssueImplementation, parseImagesFromBody } from '../lib/github';
import ImageAttacher, { type AttachedImage } from './ImageAttacher';
import {
  loadAnthropicSettings,
  createSession,
  sendTaskMessage,
  streamEvents,
  archiveSession,
  parseAiLinks,
  encodeAiLinks,
  extractLinks,
  branchFromUrl,
} from '../lib/anthropic';
import type { AiLinks, AgentEvent } from '../lib/anthropic';

interface Props {
  issue: GitHubIssue;
  onClose: () => void;
  /** Which tab to show on first render. Defaults to 'description'. */
  initialTab?: 'description' | 'ai';
}

interface LogEntry {
  id: number;
  type: 'status' | 'message' | 'tool' | 'result' | 'error';
  text: string;
  ts: Date;
}

type CodingState = 'idle' | 'starting' | 'running' | 'done' | 'error';

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-2 py-0.5 rounded border border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 transition-colors shrink-0"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function AiImplementationPanel({
  links, loading, logs, codingState, logEndRef,
}: {
  links: AiLinks;
  loading: boolean;
  logs: LogEntry[];
  codingState: CodingState;
  logEndRef: RefObject<HTMLDivElement>;
}) {
  const branchName = links.branch ? branchFromUrl(links.branch) : null;
  const prNum = links.pr?.match(/\/pull\/(\d+)/)?.[1];
  const checkoutCmd = branchName
    ? `git fetch origin && git checkout ${branchName} && npm run dev`
    : null;

  const placeholder = loading
    ? <span className="flex items-center gap-1 text-xs text-gray-400"><Spinner />Loading…</span>
    : <span className="text-xs text-gray-300 italic">not yet available</span>;

  return (
    <div className="flex-1 flex flex-col rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 gap-2.5 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500 shrink-0">Branch</span>
        {branchName ? (
          <a href={links.branch} target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate min-w-0">
            {branchName}
          </a>
        ) : placeholder}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500 shrink-0">Pull Request</span>
        {prNum ? (
          <a href={links.pr} target="_blank" rel="noreferrer"
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline">
            #{prNum}
          </a>
        ) : placeholder}
      </div>

      <div className="space-y-1">
        <span className="text-xs text-gray-500">Run locally</span>
        <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
          {checkoutCmd ? (
            <>
              <code className="text-xs text-white font-mono flex-1 select-all break-all">{checkoutCmd}</code>
              <CopyButton text={checkoutCmd} />
            </>
          ) : (
            <span className="text-xs text-gray-600 italic font-mono">
              {loading ? 'Loading…' : 'available after branch is created'}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 mt-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">agent log</span>
            <div className="flex items-center gap-3">
              {codingState === 'starting' && (
                <span className="flex items-center gap-1 text-xs text-gray-400"><Spinner />Starting…</span>
              )}
              {codingState === 'running' && (
                <span className="flex items-center gap-1.5 text-xs text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Running…
                </span>
              )}
              {codingState === 'done' && <span className="text-xs text-green-600 font-medium">✓ Complete</span>}
              {codingState === 'error' && <span className="text-xs text-red-500 font-medium">✗ Error</span>}
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const text = logs.map(e => `[${e.ts.toISOString()}] ${e.text}`).join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-1.5 py-0.5 rounded border border-gray-300 hover:border-gray-400"
                >
                  Copy log
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-950 rounded-xl p-3 font-mono text-xs select-text min-h-0">
            {logs.length === 0 ? (
              <span className="text-gray-600 italic">ready…</span>
            ) : logs.map((entry) => {
              const hh = entry.ts.getHours().toString().padStart(2, '0');
              const mm = entry.ts.getMinutes().toString().padStart(2, '0');
              const ss = entry.ts.getSeconds().toString().padStart(2, '0');
              const ms = entry.ts.getMilliseconds().toString().padStart(3, '0');
              const textColor =
                entry.type === 'status'  ? 'text-green-400' :
                entry.type === 'error'   ? 'text-red-400'   :
                entry.type === 'tool'    ? 'text-blue-300'  :
                entry.type === 'result'  ? 'text-gray-500'  :
                'text-gray-200';
              return (
                <div key={entry.id} className="flex gap-2 leading-5">
                  <span className="text-gray-600 shrink-0 select-none">{`${hh}:${mm}:${ss}.${ms}`}</span>
                  <span className={`${textColor} break-all`}>{entry.text}</span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>
    </div>
  );
}

export default function EditIssueModal({ issue, onClose, initialTab = 'description' }: Props) {
  const { token, owner, repo, projects, projectIssues, milestones, updateIssue, addIssueToProject, removeIssueFromProject } = useAppStore();

  const [title, setTitle] = useState(issue.title);

  // Body shown in editor — strip the AI section so the user doesn't edit it directly
  const [body, setBody] = useState(() => {
    const b = issue.body ?? '';
    const sentinelIdx = b.indexOf('\n\n<!-- ai-section -->');
    if (sentinelIdx >= 0) return b.slice(0, sentinelIdx);
    const legacyIdx = b.indexOf('\n\n<!-- ai-links\n');
    return legacyIdx >= 0 ? b.slice(0, legacyIdx) : b;
  });

  const initialProjectId = Object.entries(projectIssues).find(([, nums]) =>
    nums.includes(issue.number)
  )?.[0] ?? '';
  const [projectId, setProjectId] = useState(initialProjectId);

  const [milestoneNumber, setMilestoneNumber] = useState<string>(
    issue.milestone?.number.toString() ?? ''
  );

  const initialImages = useMemo(() => parseImagesFromBody(body), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(initialImages);
  const lockedCount = initialImages.length;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  // Gemini model selection
  const geminiSettings = loadGeminiSettings();
  const [geminiModel, setGeminiModel] = useState(geminiSettings.model);

  // AI coding
  const [aiLinks, setAiLinks] = useState<AiLinks>({});
  const [aiLinksLoading, setAiLinksLoading] = useState(false);
  const [codingState, setCodingState] = useState<CodingState>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  // Keep a live ref to body so we can read it inside async callbacks
  const bodyRef = useRef(body);
  useEffect(() => { bodyRef.current = body; }, [body]);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Abort stream on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const openProjects = projects.filter((p) => !p.closed);
  const hasGeminiKey = true;
  const anthropicSettings = loadAnthropicSettings();
  const hasAnthropicSettings = Boolean(
    anthropicSettings.agentId &&
    anthropicSettings.envId &&
    anthropicSettings.vaultId,
  );

  function pushLog(type: LogEntry['type'], text: string) {
    setLogs(prev => [...prev, { id: logIdRef.current++, type, text, ts: new Date() }]);
  }

  async function handleCodeWithAI() {
    setCodingState('starting');
    setLogs([]);
    const ac = new AbortController();
    abortRef.current = ac;

    let sessionId: string | null = null;
    // Use a local variable to accumulate detected links — avoids stale closure issues
    let detectedLinks: AiLinks = { branch: aiLinks.branch, pr: aiLinks.pr };

    try {
      pushLog('status', '▶ Creating session…');

      sessionId = await createSession(anthropicSettings);
      pushLog('status', `▶ Session: ${sessionId}`);

      // Open the SSE stream FIRST (GET /stream), then send the task message.
      // Per the docs: the stream must be open before sending to avoid race conditions.
      const streamPromise = streamEvents(
        sessionId,
        (event: AgentEvent) => {
          switch (event.type) {
            case 'status_running':
            case 'session.status_running':
              pushLog('status', '▶ Agent started working…');
              setCodingState('running');
              break;

            case 'agent.message':
            case 'message': {
              // Extract text from content array or plain string
              let text = '';
              if (typeof event.content === 'string') {
                text = event.content;
              } else if (Array.isArray(event.content)) {
                text = (event.content as { type: string; text?: string }[])
                  .filter(b => b.type === 'text')
                  .map(b => b.text ?? '')
                  .join('');
              }
              if (text) {
                pushLog('message', text);
                const found = extractLinks(text, owner, repo);
                detectedLinks = {
                  branch: found.branch ?? detectedLinks.branch,
                  pr:     found.pr     ?? detectedLinks.pr,
                };
                setAiLinks({ ...detectedLinks });
              }
              break;
            }

            case 'agent.mcp_tool_use':
            case 'tool_use': {
              const inputStr = event.input
                ? JSON.stringify(event.input).slice(0, 140)
                : '';
              pushLog('tool', `→ ${String(event.name ?? 'tool')}(${inputStr})`);
              break;
            }

            case 'agent.mcp_tool_result':
            case 'tool_result': {
              let text = '';
              if (typeof event.content === 'string') {
                text = event.content.slice(0, 200);
              } else if (Array.isArray(event.content)) {
                text = (event.content as { type: string; text?: string }[])
                  .filter(b => b.type === 'text')
                  .map(b => b.text ?? '')
                  .join('')
                  .slice(0, 200);
              }
              if (text) {
                pushLog('result', `  ↳ ${text}`);
                const found = extractLinks(text, owner, repo);
                detectedLinks = {
                  branch: found.branch ?? detectedLinks.branch,
                  pr:     found.pr     ?? detectedLinks.pr,
                };
                setAiLinks({ ...detectedLinks });
              }
              break;
            }

            case 'status_terminated':
            case 'session.status_terminated':
              pushLog('error', '✗ Session terminated (unrecoverable error)');
              break;

            case 'session.error': {
              const msg = typeof event.error === 'string'
                ? event.error
                : JSON.stringify(event.error);
              pushLog('error', `✗ ${msg}`);
              break;
            }

            case 'status_idle':
            case 'status_closed':
            case 'session.status_idle':
              // Terminal — handled by streamEvents, nothing extra to log here
              break;

            default:
              pushLog('result', `[${event.type}]`);
          }
        },
        (raw) => pushLog('result', raw),
        ac.signal,
      );

      pushLog('status', '▶ Sending task…');
      await sendTaskMessage(
        sessionId,
        `implement issue #${issue.number} for ${owner}/${repo}`,
      );

      await streamPromise;

      // Persist links to the GitHub issue body
      if (detectedLinks.branch || detectedLinks.pr) {
        const newBody = encodeAiLinks(bodyRef.current, detectedLinks);
        updateIssue(issue.number, title, newBody).catch(() => {});
      }

      setCodingState('done');
      pushLog('status', '✓ Done');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      pushLog('error', `✗ ${msg}`);
      setCodingState('error');
    } finally {
      if (sessionId) archiveSession(sessionId).catch(() => {});
    }
  }

  async function handleGenerate() {
    if (!title.trim()) { setError('Add a title before generating.'); return; }
    setGenerating(true);
    setError('');
    try {
      const userActivity = openProjects.find((p) => p.id === projectId);
      const wave = milestones.find((m) => m.number === Number(milestoneNumber));
      const context: IssueContext = {
        userActivityName: userActivity?.title,
        userActivityDescription: userActivity?.shortDescription ?? undefined,
        waveName: wave?.title,
        waveDescription: wave?.description ?? undefined,
      };
      const result = await generateDescription(token, owner, repo, title.trim(), body.trim(), context, geminiModel);
      setBody(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (projectId !== initialProjectId) {
        if (initialProjectId) await removeIssueFromProject(issue.node_id, initialProjectId);
        if (projectId) await addIssueToProject(issue.node_id, projectId);
      }
      const newMilestone = milestoneNumber ? Number(milestoneNumber) : null;
      const milestoneChanged = newMilestone !== (issue.milestone?.number ?? null);
      const newImages = attachedImages.slice(lockedCount);
      const imageMarkdown = newImages.length > 0
        ? '\n\n' + newImages.map(img => `![${img.name}](${img.url})`).join('\n')
        : '';
      const savedBody = encodeAiLinks(body.trim() + imageMarkdown, aiLinks);
      await updateIssue(
        issue.number,
        title.trim(),
        savedBody,
        milestoneChanged ? newMilestone : undefined,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue');
      setSaving(false);
    }
  }

  // initialTab controls which tab is active on first render.
  const [descTab, setDescTab] = useState<'description' | 'ai'>(initialTab);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Edit Issue</h2>
            <p className="text-xs text-gray-400 mt-0.5">#{issue.number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 px-6 py-4 gap-4 overflow-hidden">
          {/* Title */}
          <div className="shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Tabbed description / AI section */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-gray-200 mb-3">
              <button
                type="button"
                onClick={() => setDescTab('description')}
                className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                  descTab === 'description'
                    ? 'text-blue-600 border-b-2 border-blue-500 -mb-px bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Description
              </button>
              <button
                type="button"
                onClick={() => {
                  setDescTab('ai');
                  // Parse body first (fast); if empty, fetch live from GitHub
                  const parsed = parseAiLinks(issue.body ?? '');
                  if (parsed.branch || parsed.pr) {
                    setAiLinks(parsed);
                    return;
                  }
                  setAiLinksLoading(true);
                  fetchIssueImplementation(token, owner, repo, issue.number)
                    .then(setAiLinks)
                    .finally(() => setAiLinksLoading(false));
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                  descTab === 'ai'
                    ? 'text-orange-600 border-b-2 border-orange-500 -mb-px bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Implementation
                {(codingState === 'starting' || codingState === 'running') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                )}
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
            {descTab === 'description' && (
              <div className="h-full flex flex-col">
                <div className="flex justify-end mb-1">
                  {hasGeminiKey && (
                    <div className="flex items-center gap-2">
                      <select
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        className="text-xs border border-purple-200 rounded-lg px-2 py-1 text-purple-700 bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                        title="Select Gemini model"
                      >
                        {GEMINI_MODELS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating || !title.trim()}
                        className="flex items-center justify-center gap-1.5 w-36 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {generating ? <><Spinner />Generating…</> : <>✦ Generate with AI</>}
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full flex-1 min-h-[6rem] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="shrink-0 mt-2">
                  <ImageAttacher
                    token={token}
                    owner={owner}
                    repo={repo}
                    images={attachedImages}
                    lockedCount={lockedCount}
                    onAdd={(img) => setAttachedImages(prev => [...prev, img])}
                    onRemove={(idx) => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 shrink-0">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Activity</label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— none —</option>
                      {openProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wave</label>
                    <select
                      value={milestoneNumber}
                      onChange={(e) => setMilestoneNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="">— none —</option>
                      {milestones.map((m) => (
                        <option key={m.number} value={m.number}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {descTab === 'ai' && (
              <div className="h-full flex flex-col">
                <div className="flex justify-end mb-1">
                  {hasAnthropicSettings && (
                    <button
                      type="button"
                      onClick={handleCodeWithAI}
                      disabled={codingState === 'starting' || codingState === 'running'}
                      className="flex items-center justify-center gap-1.5 w-36 px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {(codingState === 'starting' || codingState === 'running') ? (
                        <><Spinner />Coding…</>
                      ) : (
                        <>⚡ Code with AI</>
                      )}
                    </button>
                  )}
                </div>

                <AiImplementationPanel
                  links={aiLinks}
                  loading={aiLinksLoading}
                  logs={logs}
                  codingState={codingState}
                  logEndRef={logEndRef}
                />
              </div>
            )}
            </div>{/* end fixed-height tab panel */}
          </div>

          {error && <p className="text-red-500 text-sm shrink-0">{error}</p>}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
