import { createPortal } from 'react-dom';
import { useState, useRef, useEffect } from 'react';
import type { GitHubIssue } from '../types';
import { useAppStore } from '../store/appStore';
import EditIssueModal from './EditIssueModal';
import IssueReadModal from './IssueReadModal';

function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 6) + '...' + text.slice(-3);
}

interface Props {
  issue: GitHubIssue;
  hideLabels?: boolean;
  showStatus?: boolean;
}

const GH_COLOR_STYLE: Record<string, [string, string, string]> = {
  GRAY:   ['#f9fafb', '#6b7280', '#e5e7eb'],
  BLUE:   ['#eff6ff', '#2563eb', '#bfdbfe'],
  GREEN:  ['#f0fdf4', '#16a34a', '#bbf7d0'],
  YELLOW: ['#fefce8', '#854d0e', '#fde047'],
  ORANGE: ['#fff7ed', '#c2410c', '#fed7aa'],
  RED:    ['#fef2f2', '#dc2626', '#fecaca'],
  PINK:   ['#fdf2f8', '#be185d', '#fbcfe8'],
  PURPLE: ['#faf5ff', '#7e22ce', '#e9d5ff'],
};
function ghStyle(color: string): React.CSSProperties {
  const [bg, text, border] = GH_COLOR_STYLE[color] ?? GH_COLOR_STYLE.GRAY;
  return { backgroundColor: bg, color: text, border: `1px solid ${border}` };
}

export default function IssueCard({ issue }: Props) {
  const { closeIssue, deleteIssue, reopenIssue, kanbanIssueStatuses, kanbanStatusColors } = useAppStore();

  // Read-only view — opens when the card body is clicked or when the URL
  // already points to this issue (deep-link / page-refresh support).
  const [showReadModal, setShowReadModal] = useState(
    () => window.location.pathname === `/issue/${issue.number}`,
  );

  // Direct-edit path — opened via the hover-action Edit button (fast path)
  // so power-users can skip the read modal entirely.
  const [showEdit, setShowEdit] = useState(false);

  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showBadgeTip, setShowBadgeTip] = useState(false);
  const [calloutStyle, setCalloutStyle] = useState<React.CSSProperties | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const calloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the browser URL in sync with the read modal.
  useEffect(() => {
    if (showReadModal) {
      history.pushState({}, '', `/issue/${issue.number}`);
    } else if (window.location.pathname === `/issue/${issue.number}`) {
      history.pushState({}, '', '/');
    }
  }, [showReadModal, issue.number]);

  const nativeStatus = kanbanIssueStatuses[issue.number] ?? (issue.state === 'open' ? 'Todo' : null);
  const badgeStyle = nativeStatus
    ? ghStyle(kanbanStatusColors[nativeStatus] ?? 'GRAY')
    : ghStyle(issue.state === 'closed' ? 'GREEN' : 'GRAY');

  function onCardEnter() {
    setHovered(true);
    calloutTimerRef.current = setTimeout(() => {
      if (!cardRef.current) return;
      const r = cardRef.current.getBoundingClientRect();
      const W = 280, H = 180;
      const style: React.CSSProperties = { position: 'fixed', width: W, zIndex: 9999 };
      style.left = r.right + 8 + W <= window.innerWidth ? r.right + 8 : r.left - W - 8;
      style.top = r.top + H <= window.innerHeight ? r.top : r.bottom - H;
      setCalloutStyle(style);
    }, 400);
  }

  function onCardLeave() {
    setHovered(false);
    if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
    setCalloutStyle(null);
  }

  async function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Close issue #${issue.number}?`)) return;
    setBusy(true);
    try { await closeIssue(issue.number); } catch { setBusy(false); }
  }

  async function handleReopen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Reopen issue #${issue.number}?`)) return;
    setBusy(true);
    try { await reopenIssue(issue.number); } catch { setBusy(false); }
    setBusy(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Permanently delete issue #${issue.number}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteIssue(issue.number, issue.node_id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
      setBusy(false);
    }
  }

  return (
    <>
      <div
        ref={cardRef}
        onMouseEnter={onCardEnter}
        onMouseLeave={onCardLeave}
        onClick={() => setShowReadModal(true)}
        className={`relative select-none cursor-pointer text-sm ${hovered ? 'z-20' : ''} ${
          busy ? 'opacity-40 pointer-events-none' :
          issue.state === 'closed' ? 'opacity-60' : ''
        }`}
      >
        <div className={`relative bg-white rounded-lg border px-2 py-1.5 shadow-sm transition-all ${
          hovered ? 'border-gray-300 shadow-md' : 'border-gray-200'
        }`}>

          {/* Title row */}
          <div className="flex items-start gap-1.5 min-w-0">

            {/* ID badge — background reflects open/closed state; tooltip on hover */}
            <div
              className="relative shrink-0"
              onMouseEnter={() => setShowBadgeTip(true)}
              onMouseLeave={() => setShowBadgeTip(false)}
            >
              <a
                href={issue.html_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="block px-1.5 py-0.5 rounded-full text-xs font-medium tabular-nums leading-none transition-colors"
                style={badgeStyle}
              >
                #{issue.number}
              </a>

              {showBadgeTip && (
                <div className="absolute bottom-full left-0 mb-1.5 z-30 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg whitespace-nowrap min-w-max">
                  {nativeStatus && <div className="font-semibold mb-1">{nativeStatus}</div>}
                  <a
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-300 hover:text-blue-200 transition-colors"
                  >
                    View on GitHub →
                  </a>
                </div>
              )}
            </div>

            {/* Title — up to 2 lines */}
            <span className="flex-1 min-w-0 text-gray-900 font-medium leading-snug line-clamp-2">
              {issue.title}
            </span>

            {/* Assignees — inline so they never add height */}
            {issue.assignees.length > 0 && (
              <div className="flex shrink-0 -space-x-1">
                {issue.assignees.map((user) => (
                  <img key={user.login} src={user.avatar_url} alt={user.login} title={user.login} className="w-4 h-4 rounded-full ring-1 ring-white" />
                ))}
              </div>
            )}
          </div>

          {/* Action buttons — absolute overlay on the right, visible on hover */}
          <div className={`absolute right-1.5 inset-y-0 flex items-center gap-1 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Edit — fast path: bypasses the read modal and opens the edit form directly */}
            <button
              onClick={e => { e.stopPropagation(); setShowEdit(true); }}
              title="Edit issue"
              className="text-blue-500 p-1 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>

            {/* Close (open issues) / Reopen (closed issues) */}
            {issue.state === 'open' ? (
              <button
                onClick={handleClose}
                title="Close issue"
                className="text-green-600 p-1 rounded-md border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleReopen}
                title="Reopen issue"
                className="text-purple-600 p-1 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            <button
              onClick={handleDelete}
              title="Delete issue permanently"
              className="text-red-500 p-1 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

        </div>
      </div>

      {/* Description callout — rendered into body to escape any stacking context */}
      {calloutStyle && createPortal(
        <div
          style={calloutStyle}
          className="pointer-events-none bg-white border border-gray-200 rounded-lg shadow-xl p-3"
        >
          <div className="font-semibold text-gray-900 text-xs mb-1.5">{issue.title}</div>
          {issue.body ? (
            <div className="text-gray-500 text-xs leading-relaxed line-clamp-6 whitespace-pre-wrap break-words">
              {issue.body}
            </div>
          ) : (
            <div className="text-gray-400 text-xs italic">No description.</div>
          )}
        </div>,
        document.body
      )}

      {/* Read-only view — opened by clicking the card body */}
      {showReadModal && (
        <IssueReadModal issue={issue} onClose={() => setShowReadModal(false)} />
      )}

      {/* Direct-edit fast path — opened via the hover Edit button */}
      {showEdit && (
        <EditIssueModal issue={issue} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}
