import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import CreateIssueModal from './CreateIssueModal';
import LabelsManagerModal from './LabelsManagerModal';
import ProjectsManagerModal from './ProjectsManagerModal';
import MilestonesManagerModal from './MilestonesManagerModal';

export default function Header() {
  const { owner, repo, issues, fetchIssues, fetchProjects, fetchMilestones, reset, loading, view, setView } = useAppStore();
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
            {issues.length} open issue{issues.length !== 1 ? 's' : ''}
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
