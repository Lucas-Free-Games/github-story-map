import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import CreateIssueModal from './CreateIssueModal';
import LabelsManagerModal from './LabelsManagerModal';
import ProjectsManagerModal from './ProjectsManagerModal';
import MilestonesManagerModal from './MilestonesManagerModal';

export default function Header() {
  const { owner, repo, issues, fetchIssues, fetchProjects, fetchMilestones, reset, loading, view, setView, showClosedIssues, toggleShowClosedIssues } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">
            {owner}/{repo}
          </span>
          <span className="text-sm text-gray-400">
            {issues.filter((i) => i.state === 'open').length} open issue{issues.filter((i) => i.state === 'open').length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden mr-2">
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                view === 'grid'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                view === 'kanban'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Kanban
            </button>
          </div>

          {/* Show/hide closed issues toggle */}
          <button
            onClick={toggleShowClosedIssues}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors mr-2 ${
              showClosedIssues
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
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
            {showClosedIssues ? 'Hide closed' : 'Show closed'}
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Issue
          </button>
          <button
            onClick={() => setShowMilestones(true)}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Milestones
          </button>
          <button
            onClick={() => setShowLabels(true)}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Status
          </button>
          <button
            onClick={() => setShowProjects(true)}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Projects
          </button>
          <button
            onClick={() => { fetchIssues(); fetchProjects(); fetchMilestones(); }}
            disabled={loading}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Syncing…' : 'Sync'}
          </button>
          <button
            onClick={reset}
            className="text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </header>

      {showCreate && <CreateIssueModal onClose={() => setShowCreate(false)} />}
      {showLabels && <LabelsManagerModal onClose={() => setShowLabels(false)} />}
      {showProjects && <ProjectsManagerModal onClose={() => setShowProjects(false)} />}
      {showMilestones && <MilestonesManagerModal onClose={() => setShowMilestones(false)} />}
    </>
  );
}
