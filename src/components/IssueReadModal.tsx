import { useState, useMemo } from 'react';
import type { GitHubIssue } from '../types';
import { useAppStore } from '../store/appStore';
import EditIssueModal from './EditIssueModal';
import { parseMarkdownToHTML } from '../lib/markdown';
import { parseImagesFromBody } from '../lib/github';
import ImageAttacher from './ImageAttacher';
import { ghStyle } from '../lib/githubColors';

interface Props {
  issue: GitHubIssue;
  onClose: () => void;
}

export default function IssueReadModal({ issue, onClose }: Props) {
  const { closeIssue, deleteIssue, reopenIssue, projects, projectIssues, kanbanIssueStatuses, kanbanStatusColors } = useAppStore();

  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  // Find the user activity (project) this issue belongs to
  const userActivity = projects.find((p) => (projectIssues[p.id] ?? []).includes(issue.number));

  // Strip the AI section from the body before rendering
  const displayBody = (() => {
    const b = issue.body ?? '';
    const sentinelIdx = b.indexOf('\n\n<!-- ai-section -->');
    if (sentinelIdx >= 0) return b.slice(0, sentinelIdx);
    const legacyIdx = b.indexOf('\n\n<!-- ai-links\n');
    return legacyIdx >= 0 ? b.slice(0, legacyIdx) : b;
  })();

  const renderedBody = displayBody.trim() ? parseMarkdownToHTML(displayBody) : null;
  const galleryImages = useMemo(() => parseImagesFromBody(displayBody), [displayBody]);

  const nativeStatus = kanbanIssueStatuses[issue.number] ?? (issue.state === 'open' ? 'Todo' : null);
  const statusDisplayLabel = nativeStatus ?? (issue.state === 'closed' ? 'Closed' : 'Todo');
  const statusColor = nativeStatus ? (kanbanStatusColors[nativeStatus] ?? 'GRAY') : (issue.state === 'closed' ? 'GREEN' : 'GRAY');

  async function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Close issue #${issue.number}?`)) return;
    setBusy(true);
    try {
      await closeIssue(issue.number);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  async function handleReopen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Reopen issue #${issue.number}?`)) return;
    setBusy(true);
    try {
      await reopenIssue(issue.number);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Permanently delete issue #${issue.number}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteIssue(issue.number, issue.node_id);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
      setBusy(false);
    }
  }

  function openEdit() {
    setShowEdit(true);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col h-[90vh] ${
          busy ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 gap-4 shrink-0">
          {/* Left: status, number, title, metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Native project status badge */}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={ghStyle(statusColor)}
              >
                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="4" />
                </svg>
                {statusDisplayLabel}
              </span>

              {/* Issue number → GitHub link */}
              <a
                href={issue.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                #{issue.number} ↗
              </a>
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-gray-900 mt-1.5 leading-snug break-words">
              {issue.title}
            </h2>

            {/* Meta chips */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {issue.milestone && (
                <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  🌊 {issue.milestone.title}
                </span>
              )}
              {userActivity && (
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  ⬡ {userActivity.title}
                </span>
              )}
              {issue.assignees.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1">
                    {issue.assignees.map((user) => (
                      <img
                        key={user.login}
                        src={user.avatar_url}
                        alt={user.login}
                        title={user.login}
                        className="w-5 h-5 rounded-full ring-1 ring-white"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">
                    {issue.assignees.map((u) => u.login).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: action toolbar */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {/* Edit */}
            <button
              onClick={() => openEdit()}
              title="Edit issue"
              className="p-1 text-blue-500 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>

            {/* Close issue (only when open) */}
            {issue.state === 'open' && (
              <button
                onClick={handleClose}
                title="Close issue"
                className="p-1 text-green-600 rounded-md border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            {/* Reopen issue (only when closed) */}
            {issue.state === 'closed' && (
              <button
                onClick={handleReopen}
                title="Reopen issue"
                className="p-1 text-purple-600 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            {/* Delete */}
            <button
              onClick={handleDelete}
              title="Delete issue permanently"
              className="p-1 text-red-500 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Dismiss modal */}
            <button
              onClick={onClose}
              title="Close"
              className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors ml-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 relative">
          {renderedBody ? (
            <div
              className="issue-body"
              // Content originates from GitHub Issues written by repo contributors.
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderedBody }}
            />
          ) : (
            <p className="text-sm text-gray-400 italic">No description provided.</p>
          )}
          {galleryImages.length > 0 && (
            <div className="sticky bottom-0 -mx-6 px-6 py-2 bg-white/85 backdrop-blur-sm">
              <ImageAttacher readOnly images={galleryImages} />
            </div>
          )}
        </div>
      </div>

      {/* Edit modal stacked on top when needed */}
      {showEdit && (
        <EditIssueModal
          issue={issue}
          initialTab="description"
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
