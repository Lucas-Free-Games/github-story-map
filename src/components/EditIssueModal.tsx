import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue } from '../types';
import { generateDescription, loadGeminiSettings } from '../lib/gemini';
import type { IssueContext } from '../lib/gemini';

interface Props {
  issue: GitHubIssue;
  onClose: () => void;
}

export default function EditIssueModal({ issue, onClose }: Props) {
  const { token, owner, repo, projects, projectIssues, milestones, updateIssue, addIssueToProject, removeIssueFromProject } = useAppStore();

  const [title, setTitle] = useState(issue.title);
  const [body, setBody] = useState(issue.body ?? '');

  const initialProjectId = Object.entries(projectIssues).find(([, nums]) =>
    nums.includes(issue.number)
  )?.[0] ?? '';
  const [projectId, setProjectId] = useState(initialProjectId);

  const [milestoneNumber, setMilestoneNumber] = useState<string>(
    issue.milestone?.number.toString() ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const openProjects = projects.filter((p) => !p.closed);
  const hasGeminiKey = Boolean(loadGeminiSettings().apiKey);

  async function handleGenerate() {
    if (!title.trim()) { setError('Add a title before generating.'); return; }
    setGenerating(true);
    setError('');
    try {
      const epic = openProjects.find((p) => p.id === projectId);
      const wave = milestones.find((m) => m.number === Number(milestoneNumber));
      const context: IssueContext = {
        epicName: epic?.title,
        epicDescription: epic?.shortDescription ?? undefined,
        waveName: wave?.title,
        waveDescription: wave?.description ?? undefined,
      };
      const result = await generateDescription(token, owner, repo, title.trim(), body.trim(), context);
      setBody(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (projectId !== initialProjectId) {
        if (initialProjectId) await removeIssueFromProject(issue.node_id, initialProjectId);
        if (projectId) await addIssueToProject(issue.node_id, projectId);
      }
      const newMilestone = milestoneNumber ? Number(milestoneNumber) : null;
      const milestoneChanged = newMilestone !== (issue.milestone?.number ?? null);
      await updateIssue(
        issue.number,
        title.trim(),
        body.trim(),
        milestoneChanged ? newMilestone : undefined,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Edit Issue</h2>
            <p className="text-xs text-gray-400 mt-0.5">#{issue.number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              {hasGeminiKey && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !title.trim()}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {generating ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Generating…
                    </>
                  ) : (
                    <>✦ Generate with AI</>
                  )}
                </button>
              )}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Epic</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— none —</option>
                {openProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wave</label>
              <select
                value={milestoneNumber}
                onChange={(e) => setMilestoneNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="">— none —</option>
                {milestones.map((m) => (
                  <option key={m.number} value={m.number}>{m.title}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
