import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import CreateIssueModal from './CreateIssueModal';
import LabelsManagerModal from './LabelsManagerModal';

export default function Header() {
  const { owner, repo, issues, fetchIssues, reset, loading } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

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
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Issue
          </button>
          <button
            onClick={() => setShowLabels(true)}
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Epics & Waves
          </button>
          <button
            onClick={fetchIssues}
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
    </>
  );
}
