import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubMilestone } from '../types';
import IssueCard from './IssueCard';

function SidebarItem({
  milestone,
  selected,
  onSelect,
  onUpdate,
  openCount,
  closedCount,
  owner,
  repo,
}: {
  milestone: GitHubMilestone;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (number: number, title: string, description: string) => Promise<void>;
  openCount: number;
  closedCount: number;
  owner: string;
  repo: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onUpdate(milestone.number, title.trim(), description);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="px-3 py-2 space-y-1.5 border-b border-gray-100">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Wave title"
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-1 justify-end">
          <button
            onClick={() => { setEditing(false); setTitle(milestone.title); setDescription(milestone.description ?? ''); }}
            className="px-2 py-0.5 text-xs text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-2 py-0.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={`flex flex-col border-b border-gray-100 px-3 py-2.5 cursor-pointer ${selected ? 'bg-purple-50 border-r-2 border-r-purple-500' : 'hover:bg-gray-50'}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          onClick={(e) => { e.stopPropagation(); onSelect(); setEditing(true); }}
          className={`text-sm truncate cursor-text hover:underline ${selected ? 'font-medium text-purple-800' : 'text-gray-700'}`}
          title="Click to edit"
        >
          {milestone.title}
        </span>
        <span className="shrink-0 text-xs text-gray-400 font-mono">#{milestone.number}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-xs text-green-600">{openCount} open</span>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs text-gray-400">{closedCount} closed</span>
        <a
          href={`https://github.com/${owner}/${repo}/milestone/${milestone.number}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
          title="View on GitHub"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
        </a>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function WavesView() {
  const { milestones, issues, owner, repo, showClosedIssues, createMilestone, updateMilestone, deleteMilestone } = useAppStore();
  const [selectedNumber, setSelectedNumber] = useState<number | null>(
    milestones.length > 0 ? milestones[0].number : null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const issueCounts = issues.reduce<Record<number, { open: number; closed: number }>>((acc, i) => {
    if (!i.milestone) return acc;
    const n = i.milestone.number;
    if (!acc[n]) acc[n] = { open: 0, closed: 0 };
    acc[n][i.state]++;
    return acc;
  }, {});

  const selected = milestones.find((m) => m.number === selectedNumber) ?? milestones[0] ?? null;

  const milestoneIssues = selected
    ? issues.filter((i) => {
        if (i.milestone?.number !== selected.number) return false;
        if (!showClosedIssues && i.state === 'closed') return false;
        return true;
      })
    : [];

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMilestone(selected.number);
      setSelectedNumber(null);
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
      await createMilestone(newTitle.trim(), newDescription);
      setNewTitle('');
      setNewDescription('');
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create wave');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="px-3 py-2.5 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Waves</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {milestones.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400 italic">No waves yet</p>
          ) : (
            milestones.map((m) => (
              <SidebarItem
                key={m.number}
                milestone={m}
                selected={m.number === selected?.number}
                onSelect={() => setSelectedNumber(m.number)}
                onUpdate={updateMilestone}
                openCount={issueCounts[m.number]?.open ?? 0}
                closedCount={issueCounts[m.number]?.closed ?? 0}
                owner={owner}
                repo={repo}
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
                placeholder="Wave title"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              + New Wave
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-8">
        {!selected ? (
          <p className="text-sm text-gray-400 italic">No waves found</p>
        ) : (
          <div>
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{selected.title}</h1>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete wave permanently"
                  className="shrink-0 text-red-500 p-1 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-40 transition-colors mt-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {deleteError && <p className="text-xs text-red-600 mb-2">{deleteError}</p>}
              {selected.description && (
                <p className="text-sm text-gray-500 mb-2">{selected.description}</p>
              )}
              {selected.due_on && (
                <p className="text-xs text-gray-400 mb-2">
                  Due {new Date(selected.due_on).toLocaleDateString()}
                </p>
              )}
              <a
                href={`https://github.com/${owner}/${repo}/milestone/${selected.number}`}
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
            </div>

            {milestoneIssues.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No issues in this wave</p>
            ) : (
              <div className="space-y-2 max-w-2xl">
                {milestoneIssues.map((issue) => (
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
