import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';

interface Repo {
  full_name: string;
  description: string | null;
  private: boolean;
}

export default function Setup() {
  const { token, setCredentials, signOut, fetchIssues, fetchLabels, fetchProjects, fetchMilestones } = useAppStore();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [repoError, setRepoError] = useState('');
  const [search, setSearch] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!token) return;
    setFetchingRepos(true);
    setRepoError('');
    (async () => {
      try {
        const all: Repo[] = [];
        let page = 1;
        while (true) {
          const res = await fetch(
            `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
            { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } },
          );
          if (!res.ok) throw new Error('GitHub returned ' + res.status + ' — your session may have expired. Sign out and back in.');
          const data: Repo[] = await res.json();
          all.push(...data);
          if (data.length < 100) break;
          page++;
        }
        setRepos(all);
      } catch (e) {
        setRepoError(e instanceof Error ? e.message : 'Failed to fetch repositories');
      } finally {
        setFetchingRepos(false);
      }
    })();
  }, [token]);

  async function handleSelectRepo(fullName: string) {
    const [owner, repo] = fullName.split('/');
    setCredentials(token, owner, repo);
    setConnecting(true);
    await Promise.all([fetchIssues(), fetchLabels(), fetchProjects(), fetchMilestones()]);
    setConnecting(false);
  }

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">GitHub Story Map</h1>
          <button
            type="button"
            onClick={() => { void signOut(); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Sign out
          </button>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Pick the repository whose issues you want to visualize.
        </p>

        <div className="space-y-4">
          {fetchingRepos && (
            <p className="text-sm text-gray-400">Fetching repositories…</p>
          )}

          {repoError && (
            <p className="text-sm text-red-500">{repoError}</p>
          )}

          {repos.length > 0 && (
            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter repositories…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {filtered.map((r) => (
                  <li key={r.full_name}>
                    <button
                      onClick={() => handleSelectRepo(r.full_name)}
                      disabled={connecting}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <span className="text-sm font-medium text-gray-800">{r.full_name}</span>
                      {r.private && (
                        <span className="ml-2 text-xs text-gray-400">private</span>
                      )}
                      {r.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{r.description}</p>
                      )}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-3 text-sm text-gray-400">No repositories match.</li>
                )}
              </ul>
            </div>
          )}

          {connecting && (
            <p className="text-sm text-gray-400 text-center">Connecting…</p>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          GitHub Projects become User Activity columns. Milestones become rows. Drag issues between cells to organise your story map.
        </p>
      </div>
    </div>
  );
}
