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
  const { kanbanIssueStatuses, kanbanStatusColors } = useAppStore();

  const [showReadModal, setShowReadModal] = useState(
    () => window.location.pathname === `/issue/${issue.number}`,
  );
  const [showEdit, setShowEdit] = useState(false);
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

  return (
    <>
      <div
        ref={cardRef}
        onMouseEnter={onCardEnter}
        onMouseLeave={onCardLeave}
        onClick={() => setShowReadModal(true)}
        className={`relative select-none cursor-pointer text-sm ${hovered ? 'z-20' : ''} ${
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
