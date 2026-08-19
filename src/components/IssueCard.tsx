import { createPortal } from 'react-dom';
import { useState, useRef, useEffect } from 'react';
import type { GitHubIssue } from '../types';
import { useAppStore } from '../store/appStore';
import EditIssueModal from './EditIssueModal';
import IssueReadModal from './IssueReadModal';
import { ghStyle } from '../lib/githubColors';

interface Props {
  issue: GitHubIssue;
  hideLabels?: boolean;
  showStatus?: boolean;
}

export default function IssueCard({ issue }: Props) {
  const { closeIssue, deleteIssue, reopenIssue, kanbanIssueStatuses, kanbanStatusColors } = useAppStore();

  const [showReadModal, setShowReadModal] = useState(
    () => window.location.pathname === `/issue/${issue.number}`,
  );
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showBadgeTip, setShowBadgeTip] = useState(false);
  const [calloutStyle, setCalloutStyle] = useState<React.CSSProperties | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const calloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          issue.state === 'closed' ? 'opacity-50' : ''
        }`}
      >
        <div
          className="relative px-2 py-1.5 rounded-md transition-all"
          style={{
            background: 'var(--n-bg)',
            border: `1px solid ${hovered ? 'rgba(55,53,47,0.2)' : 'var(--n-border)'}`,
            boxShadow: hovered ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
          }}
        >
          {/* Title row */}
          <div className="flex items-start gap-1.5 min-w-0">
            {/* ID badge */}
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
                className="block px-1.5 py-0.5 rounded text-xs font-medium tabular-nums leading-none transition-opacity hover:opacity-80"
                style={badgeStyle}
              >
                #{issue.number}
              </a>

              {showBadgeTip && (
                <div
                  className="absolute bottom-full left-0 mb-1.5 z-30 text-xs rounded-md px-2.5 py-2 shadow-lg whitespace-nowrap min-w-max"
                  style={{ background: 'var(--n-text)', color: '#fff' }}
                >
                  {nativeStatus && <div className="font-semibold mb-1">{nativeStatus}</div>}
                  <a
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="hover:underline"
                    style={{ color: '#8BBFE8' }}
                  >
                    View on GitHub →
                  </a>
                </div>
              )}
            </div>

            {/* Title */}
            <span
              className="flex-1 min-w-0 font-medium leading-snug line-clamp-2"
              style={{ color: 'var(--n-text)', fontSize: '0.8125rem' }}
            >
              {issue.title}
            </span>

            {/* Assignees */}
            {issue.assignees.length > 0 && (
              <div className="flex shrink-0 -space-x-1">
                {issue.assignees.map((user) => (
                  <img key={user.login} src={user.avatar_url} alt={user.login} title={user.login} className="w-4 h-4 rounded-full ring-1 ring-white" />
                ))}
              </div>
            )}
          </div>

          {/* Hover action buttons */}
          <div
            className={`absolute right-1 inset-y-0 flex items-center gap-0.5 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <button
              onClick={e => { e.stopPropagation(); setShowEdit(true); }}
              title="Edit issue"
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--n-text-2)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover-strong)'; e.currentTarget.style.color = 'var(--n-text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--n-text-2)'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>

            {issue.state === 'open' ? (
              <button
                onClick={handleClose}
                title="Close issue"
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--n-text-2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover-strong)'; e.currentTarget.style.color = 'var(--n-text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--n-text-2)'; }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleReopen}
                title="Reopen issue"
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--n-text-2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover-strong)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            <button
              onClick={handleDelete}
              title="Delete issue permanently"
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--n-text-3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF2F2'; e.currentTarget.style.color = '#E03E3E'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--n-text-3)'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Description callout on hover */}
      {calloutStyle && createPortal(
        <div
          style={{
            ...calloutStyle,
            background: 'var(--n-bg)',
            border: '1px solid var(--n-border)',
            borderRadius: 8,
            boxShadow: 'var(--n-shadow-lg)',
            padding: '12px 14px',
          }}
          className="pointer-events-none"
        >
          <div className="font-semibold text-xs mb-1.5" style={{ color: 'var(--n-text)' }}>{issue.title}</div>
          {issue.body ? (
            <div className="text-xs leading-relaxed line-clamp-6 whitespace-pre-wrap break-words" style={{ color: 'var(--n-text-2)' }}>
              {issue.body}
            </div>
          ) : (
            <div className="text-xs italic" style={{ color: 'var(--n-text-3)' }}>No description.</div>
          )}
        </div>,
        document.body
      )}

      {showReadModal && (
        <IssueReadModal issue={issue} onClose={() => setShowReadModal(false)} />
      )}

      {showEdit && (
        <EditIssueModal issue={issue} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}
