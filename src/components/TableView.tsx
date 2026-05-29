import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue } from '../types';
import IssueReadModal from './IssueReadModal';
import EditIssueModal from './EditIssueModal';

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface RowProps {
  issue: GitHubIssue;
  userActivity: string | null;
  nativeStatus: string | null;
  statusColor: string;
  onOpen: (issue: GitHubIssue) => void;
}

function TableRow({ issue, userActivity, nativeStatus, statusColor, onOpen }: RowProps) {
  const { closeIssue, deleteIssue, reopenIssue } = useAppStore();
  const [hovered, setHovered] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);

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
    try { await reopenIssue(issue.number); } finally { setBusy(false); }
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

  const statusLabel = nativeStatus ?? (issue.state === 'closed' ? 'Closed' : 'Open');

  return (
    <>
      <tr
        onClick={() => onOpen(issue)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`border-b border-gray-100 cursor-pointer transition-colors text-sm ${
          busy ? 'opacity-40 pointer-events-none' : ''
        } ${
          issue.state === 'closed' ? 'opacity-60' : ''
        } ${
          hovered ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'
        }`}
      >
        {/* # */}
        <td className="pl-4 pr-2 py-2 whitespace-nowrap">
          <a
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full"
            style={ghStyle(issue.state === 'closed' ? 'GREEN' : 'GRAY')}
          >
            #{issue.number}
          </a>
        </td>

        {/* Title */}
        <td className="px-3 py-2 max-w-xs">
          <span className="font-medium text-gray-900 line-clamp-1">{issue.title}</span>
        </td>

        {/* Status */}
        <td className="px-3 py-2 whitespace-nowrap">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={ghStyle(statusColor)}
          >
            <svg className="w-1.5 h-1.5" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="4" />
            </svg>
            {statusLabel}
          </span>
        </td>

        {/* User Activity */}
        <td className="px-3 py-2 whitespace-nowrap">
          {userActivity ? (
            <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {userActivity}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">—</span>
          )}
        </td>

        {/* Wave / Milestone */}
        <td className="px-3 py-2 whitespace-nowrap">
          {issue.milestone ? (
            <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              🌊 {issue.milestone.title}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">—</span>
          )}
        </td>

        {/* Assignees */}
        <td className="px-3 py-2 whitespace-nowrap">
          {issue.assignees.length > 0 ? (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {issue.assignees.map((u) => (
                  <img
                    key={u.login}
                    src={u.avatar_url}
                    alt={u.login}
                    title={u.login}
                    className="w-5 h-5 rounded-full ring-1 ring-white"
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500 ml-1">
                {issue.assignees.map((u) => u.login).join(', ')}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">—</span>
          )}
        </td>

        {/* Updated Date */}
        <td className="px-3 py-2 whitespace-nowrap">
          <span className="text-xs text-gray-500 tabular-nums">
            {formatDate(issue.updated_at)}
          </span>
        </td>

        {/* Actions */}
        <td className="pl-2 pr-4 py-2 whitespace-nowrap">
          <div className={`flex items-center gap-1 transition-opacity ${
            hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
            {/* Edit */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowEdit(true); }}
              title="Edit issue"
              className="p-1 rounded-md border border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>

            {/* Close / Reopen */}
            {issue.state === 'open' ? (
              <button
                onClick={handleClose}
                title="Close issue"
                className="p-1 rounded-md border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleReopen}
                title="Reopen issue"
                className="p-1 rounded-md border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
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
              className="p-1 rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {showEdit && (
        <EditIssueModal issue={issue} onClose={() => setShowEdit(false)} />
      )}
    </>
  );
}

type SortKey = 'number' | 'title' | 'status' | 'activity' | 'wave' | 'updated';
type SortDir = 'asc' | 'desc';

export default function TableView() {
  const {
    issues,
    showClosedIssues,
    projects,
    projectIssues,
    kanbanIssueStatuses,
    kanbanStatusColors,
  } = useAppStore();

  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterText, setFilterText] = useState('');

  // Map issue number → user activity title
  const issueActivity = new Map<number, string>();
  for (const project of projects) {
    for (const num of (projectIssues[project.id] ?? [])) {
      if (!issueActivity.has(num)) issueActivity.set(num, project.title);
    }
  }

  const visibleIssues = issues
    .filter((i) => showClosedIssues || i.state === 'open')
    .filter((i) => {
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase();
      return (
        i.title.toLowerCase().includes(q) ||
        String(i.number).includes(q) ||
        (i.milestone?.title.toLowerCase().includes(q) ?? false) ||
        (issueActivity.get(i.number)?.toLowerCase().includes(q) ?? false)
      );
    });

  function getStatusInfo(issue: GitHubIssue): { label: string; color: string } {
    const native = kanbanIssueStatuses[issue.number];
    if (native) {
      return { label: native, color: kanbanStatusColors[native] ?? 'GRAY' };
    }
    return {
      label: issue.state === 'closed' ? 'Closed' : 'Open',
      color: issue.state === 'closed' ? 'GREEN' : 'GRAY',
    };
  }

  function compareIssues(a: GitHubIssue, b: GitHubIssue): number {
    let result = 0;
    switch (sortKey) {
      case 'number':  result = a.number - b.number; break;
      case 'title':   result = a.title.localeCompare(b.title); break;
      case 'status':  result = getStatusInfo(a).label.localeCompare(getStatusInfo(b).label); break;
      case 'activity': result = (issueActivity.get(a.number) ?? '').localeCompare(issueActivity.get(b.number) ?? ''); break;
      case 'wave':    result = (a.milestone?.title ?? '').localeCompare(b.milestone?.title ?? ''); break;
      case 'updated': result = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break;
    }
    return sortDir === 'asc' ? result : -result;
  }

  const sorted = [...visibleIssues].sort(compareIssues);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) {
      return (
        <svg className="w-3 h-3 text-gray-300 ml-1 inline" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 12l5-5 5 5H5z" />
        </svg>
      );
    }
    return sortDir === 'asc' ? (
      <svg className="w-3 h-3 text-blue-500 ml-1 inline" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 12l5-5 5 5H5z" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-blue-500 ml-1 inline" viewBox="0 0 20 20" fill="currentColor">
        <path d="M15 8l-5 5-5-5h10z" />
      </svg>
    );
  }

  const thClass = "px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap select-none cursor-pointer hover:text-gray-900 hover:bg-gray-100 transition-colors";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Filter issues…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-60"
          />
        </div>
        <span className="text-xs text-gray-400">
          {sorted.length} issue{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className={`${thClass} pl-4`} onClick={() => handleSort('number')}>
                #<SortIcon col="number" />
              </th>
              <th className={thClass} onClick={() => handleSort('title')}>
                Title<SortIcon col="title" />
              </th>
              <th className={thClass} onClick={() => handleSort('status')}>
                Status<SortIcon col="status" />
              </th>
              <th className={thClass} onClick={() => handleSort('activity')}>
                User Activity<SortIcon col="activity" />
              </th>
              <th className={thClass} onClick={() => handleSort('wave')}>
                Wave<SortIcon col="wave" />
              </th>
              <th className={thClass}>
                Assignees
              </th>
              <th className={thClass} onClick={() => handleSort('updated')}>
                Updated<SortIcon col="updated" />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap pr-4">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-gray-400 italic">
                  {filterText ? 'No issues match your filter.' : 'No issues to display.'}
                </td>
              </tr>
            )}
            {sorted.map((issue) => {
              const { label: statusLabel, color: statusColor } = getStatusInfo(issue);
              return (
                <TableRow
                  key={issue.number}
                  issue={issue}
                  userActivity={issueActivity.get(issue.number) ?? null}
                  nativeStatus={statusLabel}
                  statusColor={statusColor}
                  onOpen={setSelectedIssue}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedIssue && (
        <IssueReadModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
}
