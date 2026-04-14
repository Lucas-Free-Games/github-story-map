import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubMilestone } from '../types';

interface Props {
  onClose: () => void;
}

function MilestoneRow({
  milestone,
  onUpdate,
  onDelete,
}: {
  milestone: GitHubMilestone;
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
      <div className="p-3 rounded-lg border border-purple-200 bg-purple-50 space-y-2">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Milestone title"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setEditing(false); setTitle(milestone.title); setDescription(milestone.description ?? ''); }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 group">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{milestone.title}</p>
        {milestone.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{milestone.description}</p>
        )}
        {milestone.due_on && (
          <p className="text-xs text-gray-400 mt-0.5">
            Due {new Date(milestone.due_on).toLocaleDateString()}
          </p>
        )}
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-40 transition-colors text-xs"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function MilestonesManagerModal({ onClose }: Props) {
  const { milestones, fetchMilestones, createMilestone, updateMilestone, deleteMilestone } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchMilestones().finally(() => setLoading(false));
  }, [fetchMilestones]);

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
      setCreateError(err instanceof Error ? err.message : 'Failed to create milestone');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">Milestones</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : milestones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 italic">No open milestones yet</p>
          ) : (
            <div className="space-y-1">
              {milestones.map((m) => (
                <MilestoneRow
                  key={m.number}
                  milestone={m}
                  onUpdate={updateMilestone}
                  onDelete={deleteMilestone}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
          {showCreate ? (
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={(e) => { setNewTitle(e.target.value); setCreateError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Milestone title"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {createError && <p className="text-red-500 text-xs">{createError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowCreate(false); setNewTitle(''); setNewDescription(''); setCreateError(''); }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              + New Milestone
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
