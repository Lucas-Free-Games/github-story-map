import { useState } from 'react';
import type { GitHubIssue } from '../types';
import { useAppStore } from '../store/appStore';
import EditIssueModal from './EditIssueModal';

interface Props {
  issue: GitHubIssue;
  hideLabels?: boolean;
  showStatus?: boolean;
}

export default function IssueCard({ issue, hideLabels, showStatus }: Props) {
  const { closeIssue, deleteIssue } = useAppStore();
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Close issue #${issue.number}?`)) return;
    setBusy(true);
    try {
      await closeIssue(issue.number);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className={`group bg-white rounded-lg border p-3 text-sm select-none transition-shadow border-gray-200 hover:border-gray-300 hover:shadow-sm ${
          busy ? 'opacity-40 pointer-events-none' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 tabular-nums leading-none mt-0.5 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
            >
              #{issue.number}
            </a>
            <span className="text-gray-900 font-medium leading-snug line-clamp-2">
              {issue.title}
            </span>
          </div>

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); setShowEdit(true); }}
              title="Edit issue"
              className="text-gray-400 hover:text-blue-500 p-0.5 rounded transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              title="Close issue"
              className="text-gray-400 hover:text-orange-500 p-0.5 rounded transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              title="Delete issue permanently"
              className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {showStatus && (
          <div className="mb-1.5">
            {issue.state === 'open' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                Open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                Closed
              </span>
            )}
          </div>
        )}

        {!hideLabels && issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {issue.labels.map((label) => (
              <span
                key={label.id || label.name}
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `#${label.color}28`,
                  color: `#${label.color}`,
                  border: `1px solid #${label.color}50`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {issue.assignees.length > 0 && (
          <div className="flex gap-1 mt-1">
            {issue.assignees.map((user) => (
              <img
                key={user.login}
                src={user.avatar_url}
                alt={user.login}
                title={user.login}
                className="w-5 h-5 rounded-full"
              />
            ))}
          </div>
        )}
      </div>

      {showEdit && <EditIssueModal issue={issue} onClose={() => setShowEdit(false)} />}
    </>
  );
}
