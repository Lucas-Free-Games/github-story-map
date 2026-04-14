import { useState } from 'react';
import { useAppStore } from '../store/appStore';

export default function Setup() {
  const { setCredentials, fetchIssues } = useAppStore();
  const [token, setToken] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [connecting, setConnecting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parts = repoInput.trim().split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setValidationError('Enter repo as owner/repo (e.g. facebook/react)');
      return;
    }
    setValidationError('');
    const [owner, repo] = parts;
    setCredentials(token.trim(), owner, repo);
    setConnecting(true);
    await fetchIssues();
    setConnecting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">GitHub Story Map</h1>
        <p className="text-gray-500 text-sm mb-6">
          Visualize your GitHub issues as epics, stories, and tasks.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Classic PAT with <code>repo</code> and <code>project</code> scopes. Stored in localStorage only.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repository
            </label>
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {validationError && (
            <p className="text-red-500 text-sm">{validationError}</p>
          )}

          <button
            type="submit"
            disabled={connecting}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-4">
          GitHub Projects become Epic columns. Milestones become rows. Drag issues between cells to organise your story map.
        </p>
      </div>
    </div>
  );
}
