import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import CreateIssueModal from './CreateIssueModal';

export default function Header() {
  const { owner, repo, fetchIssues, fetchProjects, fetchMilestones, fetchAllProjectStatuses, reset, loading, view, setView, showClosedIssues, toggleShowClosedIssues, milestones, kanbanMilestoneNumber, setKanbanMilestone } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 shrink-0">
        <div className="flex items-center justify-between">
          {/* Pill + Tabs */}
          <div className="flex items-center gap-1">
            <span className="mr-2 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 border border-green-200 rounded-full shrink-0">
              {owner}/{repo}
            </span>
            {(['grid', 'kanban', 'waves', 'epics', 'settings'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  view === v
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {v === 'grid' ? 'Story Map' : v === 'kanban' ? 'Kanban' : v === 'waves' ? 'Waves' : v === 'epics' ? 'Epics' : 'Settings'}
              </button>
            ))}
          </div>

          {/* Kanban wave selector */}
          {view === 'kanban' && milestones.length > 0 && (
            <select
              value={kanbanMilestoneNumber ?? ''}
              onChange={(e) => setKanbanMilestone(e.target.value ? Number(e.target.value) : null)}
              disabled={loading}
              className="ml-3 text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
            >
              <option value="">All Waves</option>
              {milestones.map((m) => (
                <option key={m.number} value={m.number}>{m.title}</option>
              ))}
            </select>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Show/hide closed */}
            <div className="relative group">
              <button
                onClick={toggleShowClosedIssues}
                className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                {showClosedIssues ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                )}
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {showClosedIssues ? 'Hide closed issues' : 'Show closed issues'}
              </span>
            </div>

            {/* New Issue */}
            <div className="relative group">
              <button
                onClick={() => setShowCreate(true)}
                className="p-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                New issue
              </span>
            </div>

            {/* Sync */}
            <div className="relative group">
              <button
                onClick={() => { fetchIssues(); fetchProjects().then(() => fetchAllProjectStatuses()); fetchMilestones(); }}
                disabled={loading}
                className="p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {loading ? 'Syncing…' : 'Sync'}
              </span>
            </div>

            {/* Disconnect */}
            <div className="relative group">
              <button
                onClick={reset}
                className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                Disconnect
              </span>
            </div>
          </div>
        </div>
      </header>

      {showCreate && <CreateIssueModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
