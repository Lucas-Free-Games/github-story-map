import { createPortal } from 'react-dom';
import { useState, useRef } from 'react';
import type { GitHubIssue } from '../types';
import { useAppStore } from '../store/appStore';
import EditIssueModal from './EditIssueModal';

function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 6) + '...' + text.slice(-3);
}

interface Props {
  issue: GitHubIssue;
  hideLabels?: boolean;
  showStatus?: boolean;
}

export default function IssueCard({ issue, hideLabels }: Props) {
  const { closeIssue, deleteIssue } = useAppStore();
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showBadgeTip, setShowBadgeTip] = useState(false);
  const [calloutStyle, setCalloutStyle] = useState<React.CSSProperties | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const calloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusLabel = issue.labels.find(l => l.name.startsWith('s_'));
  const statusName = statusLabel ? statusLabel.name.slice(2) : null;

  const badgeStyle: React.CSSProperties = issue.state === 'open'
    ? { backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }
    : { backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' };

  function onCardEnter() {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
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
    if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
    setCalloutStyle(null);
    leaveTimerRef.current = setTimeout(() => setHovered(false), 120);
  }

  function onTrayEnter() {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  }

  function onTrayLeave() {
    leaveTimerRef.current = setTimeout(() => setHovered(false), 120);
  }

  async function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Close issue #${issue.number}?`)) return;
    setBusy(true);
    try { await closeIssue(issue.number); } catch { setBusy(false); }
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
        className={`relative select-none cursor-pointer text-sm ${hovered ? 'z-20' : ''} ${
          busy ? 'opacity-40 pointer-events-none' :
          issue.state === 'closed' ? 'opacity-60' : ''
        }`}
      >
        {/* Card surface — z-10 so it sits visually in front of the tray */}
        <div
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
          className={`relative z-10 bg-white rounded-lg border px-2 py-1.5 shadow-sm transition-all ${
            hovered ? 'border-gray-300 shadow-md' : 'border-gray-200'
          }`}
        >

        {/* Single-line title row */}
        <div className="flex items-center gap-1.5 min-w-0">

          {/* ID badge — background reflects status color; tooltip on hover */}
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
              <div className="absolute bottom-full left-0 mb-1.5 z-20 bg-gray-900 text-white text-xs rounded-md px-2.5 py-2 shadow-lg whitespace-nowrap min-w-max">
                {statusName && <div className="font-semibold mb-1">{statusName}</div>}
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

          {/* Title — single line, middle-truncated */}
          <span className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-gray-900 font-medium leading-none">
            {truncateMiddle(issue.title, 45)}
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

        </div>{/* end card surface */}

        {/* Clip wrapper — pointer-events-none while hidden so cursor approaching from below is ignored */}
        <div
          onMouseEnter={onTrayEnter}
          onMouseLeave={onTrayLeave}
          className={`absolute left-0 right-0 top-full z-0 overflow-hidden rounded-b-lg ${hovered ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          <div className={`transition-transform duration-200 ease-out ${hovered ? 'translate-y-0' : '-translate-y-full'}
            bg-gray-100 border-x border-b border-gray-200 rounded-b-lg
            flex items-center justify-end gap-1 px-2 py-1.5
          `}>
            <button
              onClick={e => { e.stopPropagation(); setShowEdit(true); }}
              title="Edit issue"
              className="text-blue-500 p-1 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              title="Close issue"
              className="text-green-600 p-1 rounded-md border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
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

      {showEdit && <EditIssueModal issue={issue} onClose={() => setShowEdit(false)} />}
    </>
  );
}
