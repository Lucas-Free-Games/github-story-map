import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubProject } from '../types';
import IssueCard from './IssueCard';

function SidebarItem({
  project,
  selected,
  onSelect,
  openCount,
  closedCount,
}: {
  project: GitHubProject;
  selected: boolean;
  onSelect: () => void;
  openCount: number;
  closedCount: number;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex flex-col border-b border-gray-100 px-3 py-2.5 cursor-pointer ${selected ? 'bg-blue-50 border-r-2 border-r-blue-500' : 'hover:bg-gray-50'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-sm truncate ${selected ? 'font-medium text-blue-800' : 'text-gray-700'}`}>
          {project.title}
        </span>
        {project.closed && (
          <span className="shrink-0 px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-400">closed</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-xs text-green-600">{openCount} open</span>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs text-gray-400">{closedCount} closed</span>
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="relative group/pill ml-auto shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-blue-600 transition-colors text-xs font-mono"
        >
          #{project.number}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-sans font-normal text-white opacity-0 group-hover/pill:opacity-100 transition-opacity">
            Open on GitHub
          </span>
        </a>
      </div>
    </div>
  );
}

export default function UserActivitiesView() {
  const { projects, issues, projectIssues, showClosedIssues, createProject, updateProject, deleteProject } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null,
  );

  function selectProject(id: string) {
    setSelectedId(id);
    setEditingDetail(false);
    setSaveDetailError('');
  }
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editingDetail, setEditingDetail] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [saveDetailError, setSaveDetailError] = useState('');

  const issueCounts = projects.reduce<Record<string, { open: number; closed: number }>>((acc, p) => {
    const nums = new Set(projectIssues[p.id] ?? []);
    acc[p.id] = { open: 0, closed: 0 };
    issues.forEach((i) => { if (nums.has(i.number)) acc[p.id][i.state]++; });
    return acc;
  }, {});

  const selected = projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  const userActivityIssues = selected
    ? issues.filter((i) => {
        const nums = new Set(projectIssues[selected.id] ?? []);
        if (!nums.has(i.number)) return false;
        if (!showClosedIssues && i.state === 'closed') return false;
        return true;
      })
    : [];

  function startDetailEdit() {
    if (!selected) return;
    setDetailTitle(selected.title);
    setDetailDescription(selected.shortDescription ?? '');
    setSaveDetailError('');
    setEditingDetail(true);
  }

  async function handleSaveDetail() {
    if (!selected || !detailTitle.trim()) return;
    setSavingDetail(true);
    setSaveDetailError('');
    try {
      await updateProject(selected.id, detailTitle.trim(), detailDescription);
      setEditingDetail(false);
    } catch (err) {
      setSaveDetailError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteProject(selected.id);
      setSelectedId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await createProject(newTitle.trim(), newDescription);
      setNewTitle('');
      setNewDescription('');
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user activity');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="px-3 py-2.5 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">User Activities</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400 italic">No user activities yet</p>
          ) : (
            projects.map((p) => (
              <SidebarItem
                key={p.id}
                project={p}
                selected={p.id === selected?.id}
                onSelect={() => selectProject(p.id)}
                openCount={issueCounts[p.id]?.open ?? 0}
                closedCount={issueCounts[p.id]?.closed ?? 0}
              />
            ))
          )}
        </div>

        <div className="border-t border-gray-100 p-2">
          {showCreate ? (
            <div className="space-y-1.5">
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={(e) => { setNewTitle(e.target.value); setCreateError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="User activity title"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {createError && <p className="text-red-500 text-xs">{createError}</p>}
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => { setShowCreate(false); setNewTitle(''); setNewDescription(''); setCreateError(''); }}
                  className="px-2 py-0.5 text-xs text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="px-2 py-0.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {creating ? '…' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-left text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
            >
              + New User Activity
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-8">
        {!selected ? (
          <p className="text-sm text-gray-400 italic">No user activities found</p>
        ) : (
          <div>
            <div className="mb-6">
              {editingDetail ? (
                <div className="space-y-3 max-w-2xl">
                  <input
                    autoFocus
                    type="text"
                    value={detailTitle}
                    onChange={(e) => setDetailTitle(e.target.value)}
                    placeholder="User activity title"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    value={detailDescription}
                    onChange={(e) => setDetailDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  {saveDetailError && <p className="text-xs text-red-600">{saveDetailError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDetail}
                      disabled={savingDetail || !detailTitle.trim()}
                      className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                      {savingDetail ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingDetail(false)}
                      className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-gray-900">{selected.title}</h1>
                      {selected.closed && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">closed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={startDetailEdit}
                        title="Edit user activity"
                        className="text-blue-500 p-1 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        title="Delete user activity permanently"
                        className="text-red-500 p-1 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-40 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {deleteError && <p className="text-xs text-red-600 mb-2">{deleteError}</p>}
                  {selected.shortDescription && (
                    <p className="text-sm text-gray-500 mb-2">{selected.shortDescription}</p>
                  )}
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View on GitHub
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </a>
                </>
              )}
            </div>

            {userActivityIssues.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No issues in this user activity</p>
            ) : (
              <div className="space-y-2 max-w-2xl">
                {userActivityIssues.map((issue) => (
                  <IssueCard key={issue.number} issue={issue} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
