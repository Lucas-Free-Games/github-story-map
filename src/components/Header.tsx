import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import CreateIssueModal from './CreateIssueModal';
import ChangeRepoModal from './ChangeRepoModal';

type View = 'grid' | 'kanban' | 'table' | 'waves' | 'user-activities' | 'roadmap' | 'timeline' | 'settings';

const NAV_ITEMS: { view: View; label: string; icon: React.ReactNode }[] = [
  {
    view: 'grid',
    label: 'Story Map',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    view: 'kanban',
    label: 'Board',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zM8 4a1 1 0 011-1h3a1 1 0 011 1v7a1 1 0 01-1 1H9a1 1 0 01-1-1V4zM15 4a1 1 0 00-1 1v4a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1h-2z" />
      </svg>
    ),
  },
  {
    view: 'table',
    label: 'Table',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    view: 'timeline',
    label: 'Timeline',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    view: 'roadmap',
    label: 'Roadmap',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    view: 'waves',
    label: 'Waves',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    view: 'user-activities',
    label: 'Activities',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
      </svg>
    ),
  },
  {
    view: 'settings',
    label: 'Settings',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function Header() {
  const {
    owner, repo, fetchIssues, fetchProjects, fetchMilestones, fetchAllProjectStatuses,
    signOut, loading, view, setView, showClosedIssues, toggleShowClosedIssues,
    kanbanShowClosedIssues, toggleKanbanShowClosedIssues,
  } = useAppStore();

  const activeShowClosed = (view === 'kanban' || view === 'table') ? kanbanShowClosedIssues : showClosedIssues;
  const activeToggleClosed = (view === 'kanban' || view === 'table') ? toggleKanbanShowClosedIssues : toggleShowClosedIssues;

  const [showCreate, setShowCreate] = useState(false);
  const [showChangeRepo, setShowChangeRepo] = useState(false);

  return (
    <>
      <aside
        className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{
          background: 'var(--n-sidebar)',
          borderColor: 'var(--n-border)',
        }}
      >
        {/* Workspace header */}
        <div className="px-3 pt-4 pb-2">
          <a
            href={`https://github.com/${owner}/${repo}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors group"
            style={{ color: 'var(--n-text)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-hover-strong)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span
              className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'var(--n-blue)' }}
            >
              {(repo[0] ?? 'G').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--n-text)' }}>
                {repo}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--n-text-3)' }}>
                {owner}
              </div>
            </div>
          </a>

          {/* Change repo button */}
          <button
            onClick={() => setShowChangeRepo(true)}
            className="mt-1 w-full text-left px-2 py-1 rounded-md text-xs transition-colors"
            style={{ color: 'var(--n-text-3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--n-hover)';
              e.currentTarget.style.color = 'var(--n-text-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--n-text-3)';
            }}
          >
            ↗ switch repo
          </button>
        </div>

        {/* Divider */}
        <div className="mx-3 mb-1" style={{ height: 1, background: 'var(--n-border)' }} />

        {/* Quick actions */}
        <div className="px-3 py-1 flex items-center gap-1">
          {/* New issue */}
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ color: 'var(--n-text-2)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--n-hover)';
              e.currentTarget.style.color = 'var(--n-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--n-text-2)';
            }}
            title="New issue"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New issue
          </button>

          {/* Sync */}
          <button
            onClick={() => { fetchIssues(); fetchProjects().then(() => fetchAllProjectStatuses()); fetchMilestones(); }}
            disabled={loading}
            className="p-1.5 rounded-md transition-colors disabled:opacity-40"
            style={{ color: 'var(--n-text-3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--n-hover)';
              e.currentTarget.style.color = 'var(--n-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--n-text-3)';
            }}
            title={loading ? 'Syncing…' : 'Sync'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="mx-3 mb-1 mt-0.5" style={{ height: 1, background: 'var(--n-border)' }} />

        {/* Navigation */}
        <nav className="flex-1 px-2 py-1 space-y-0.5">
          {NAV_ITEMS.map(({ view: v, label, icon }) => {
            const isActive = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left"
                style={{
                  background: isActive ? 'var(--n-hover-strong)' : 'transparent',
                  color: isActive ? 'var(--n-text)' : 'var(--n-text-2)',
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--n-hover)';
                    e.currentTarget.style.color = 'var(--n-text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--n-text-2)';
                  }
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.7 }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 pb-3 space-y-0.5">
          <div className="mx-1 mb-1" style={{ height: 1, background: 'var(--n-border)' }} />

          {/* Show/hide closed */}
          <button
            onClick={activeToggleClosed}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left"
            style={{ color: 'var(--n-text-2)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--n-hover)';
              e.currentTarget.style.color = 'var(--n-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--n-text-2)';
            }}
          >
            {activeShowClosed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            )}
            <span>{activeShowClosed ? 'Hide closed' : 'Show closed'}</span>
          </button>

          {/* Sign out */}
          <button
            onClick={() => { void signOut(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left"
            style={{ color: 'var(--n-text-3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--n-hover)';
              e.currentTarget.style.color = 'var(--n-text-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--n-text-3)';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {showCreate && <CreateIssueModal onClose={() => setShowCreate(false)} />}
      {showChangeRepo && <ChangeRepoModal onClose={() => setShowChangeRepo(false)} />}
    </>
  );
}
