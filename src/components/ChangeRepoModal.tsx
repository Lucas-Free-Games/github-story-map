import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { getFirebaseIdToken } from '../lib/auth';

interface Repo {
  full_name: string;
  description: string | null;
  private: boolean;
}

export default function ChangeRepoModal({ onClose }: { onClose: () => void }) {
  const { setCredentials, fetchIssues, fetchLabels, fetchProjects, fetchMilestones } = useAppStore();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [repoError, setRepoError] = useState('');
  const [search, setSearch] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setFetchingRepos(true);
    setRepoError('');
    (async () => {
      try {
        const idToken = await getFirebaseIdToken();
        const all: Repo[] = [];
        let page = 1;
        while (true) {
          const res = await fetch(
            `/github-api/user/repos?per_page=100&page=${page}&sort=updated`,
            { headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/vnd.github.v3+json' } },
          );
          if (!res.ok) throw new Error('GitHub returned ' + res.status + ' — your session may have expired.');
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
  }, []);

  async function handleSelectRepo(fullName: string) {
    const [owner, repo] = fullName.split('/');
    setCredentials(owner, repo);
    setConnecting(true);
    await Promise.all([fetchIssues(), fetchLabels(), fetchProjects(), fetchMilestones()]);
    setConnecting(false);
    onClose();
  }

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md p-8 rounded-xl mx-4"
        style={{ background: 'var(--n-bg)', border: '1px solid var(--n-border)', boxShadow: 'var(--n-shadow-lg)' }}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-base font-semibold" style={{ color: 'var(--n-text)' }}>
            Change repository
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--n-text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover)'; e.currentTarget.style.color = 'var(--n-text-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--n-text-3)'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <p className="text-sm mb-6" style={{ color: 'var(--n-text-2)' }}>
          Pick a repository to switch to.
        </p>

        <div className="space-y-3">
          {fetchingRepos && (
            <p className="text-sm" style={{ color: 'var(--n-text-3)' }}>Fetching repositories…</p>
          )}

          {repoError && (
            <p className="text-sm" style={{ color: '#E03E3E' }}>{repoError}</p>
          )}

          {repos.length > 0 && (
            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter repositories…"
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-md mb-2 outline-none transition-all"
                style={{
                  border: '1px solid var(--n-border)',
                  background: 'var(--n-sidebar)',
                  color: 'var(--n-text)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--n-blue)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--n-blue-bg)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--n-border)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <ul
                className="rounded-md overflow-hidden max-h-64 overflow-y-auto"
                style={{ border: '1px solid var(--n-border)' }}
              >
                {filtered.map((r, i) => (
                  <li key={r.full_name} style={{ borderTop: i > 0 ? '1px solid var(--n-border)' : 'none' }}>
                    <button
                      onClick={() => handleSelectRepo(r.full_name)}
                      disabled={connecting}
                      className="w-full text-left px-3 py-2.5 transition-colors disabled:opacity-40"
                      style={{ background: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--n-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--n-text)' }}>
                          {r.full_name}
                        </span>
                        {r.private && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--n-hover)', color: 'var(--n-text-3)' }}>
                            private
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--n-text-3)' }}>
                          {r.description}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && !fetchingRepos && (
                  <li className="px-3 py-3 text-sm" style={{ color: 'var(--n-text-3)' }}>
                    No repositories match.
                  </li>
                )}
              </ul>
            </div>
          )}

          {connecting && (
            <p className="text-sm text-center" style={{ color: 'var(--n-text-3)' }}>Connecting…</p>
          )}
        </div>
      </div>
    </div>
  );
}
