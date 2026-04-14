import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubProject } from '../types';

interface Props {
  onClose: () => void;
}

function ProjectRow({
  project,
  onUpdate,
  onDelete,
}: {
  project: GitHubProject;
  onUpdate: (id: string, title: string, description: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.shortDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onUpdate(project.id, title.trim(), description);
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
      await onDelete(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 space-y-2">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setEditing(false); setTitle(project.title); setDescription(project.shortDescription ?? ''); }}
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
        <div className="flex items-center gap-2">
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline truncate"
          >
            {project.title}
          </a>
          {project.closed && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">closed</span>
          )}
        </div>
        {project.shortDescription && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{project.shortDescription}</p>
        )}
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs"
          title="Edit"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-40 transition-colors text-xs"
          title="Delete"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function ProjectsManagerModal({ onClose }: Props) {
  const { projects, fetchProjects, createProject, updateProject, deleteProject } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    setLoading(true);
    setFetchError('');
    fetchProjects()
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [fetchProjects]);

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
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
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
          <h2 className="font-semibold text-gray-900">Projects</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : fetchError ? (
            <div className="py-6 px-2 space-y-1">
              <p className="text-sm font-medium text-red-600">Failed to load projects</p>
              <p className="text-xs text-red-500 font-mono break-all">{fetchError}</p>
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 italic">No projects linked to this repository yet</p>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onUpdate={updateProject}
                  onDelete={deleteProject}
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
                placeholder="Project title"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              + New Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
