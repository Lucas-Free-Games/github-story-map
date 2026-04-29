import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubMilestone } from '../types';
import IssueCard from './IssueCard';

function SidebarItem({
  milestone,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: {
  milestone: GitHubMilestone;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (number: number, title: string, description: string) => Promise<void>;
  onDelete: (number: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await onDelete(milestone.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
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
    <div className={`group flex items-center border-b border-gray-100 ${selected ? 'bg-purple-50 border-r-2 border-r-purple-500' : 'hover:bg-gray-50'}`}>
      <button
        onClick={onSelect}
        className="flex-1 text-left px-3 py-2.5 min-w-0"
      >
        <span className={`block text-sm truncate ${selected ? 'font-medium text-purple-800' : 'text-gray-700'}`}>
          {milestone.title}
        </span>
        {milestone.description && (
          <span className="block text-xs text-gray-400 truncate mt-0.5">{milestone.description}</span>
        )}
      </button>
      <div className="flex items-center gap-0.5 pr-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-40 transition-colors text-xs"
        >
          {deleting ? '…' : 'Del'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs px-3 pb-1">{error}</p>}
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

  const selected = milestones.find((m) => m.number === selectedNumber) ?? milestones[0] ?? null;

  const milestoneIssues = selected
    ? issues.filter((i) => {
        if (i.milestone?.number !== selected.number) return false;
        if (!showClosedIssues && i.state === 'closed') return false;
        return true;
      })
    : [];

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
                onDelete={deleteMilestone}
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
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{selected.title}</h1>
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
