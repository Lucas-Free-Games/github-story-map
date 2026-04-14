import { useAppStore } from '../store/appStore';

export default function Header() {
  const { owner, repo, issues, fetchIssues, reset, loading } = useAppStore();

  return (
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
  );
}
