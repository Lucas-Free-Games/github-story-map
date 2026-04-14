import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import Setup from './components/Setup';
import Header from './components/Header';
import StoryMap from './components/StoryMap';
import KanbanView from './components/KanbanView';

export default function App() {
  const { token, owner, repo, issues, loading, error, fetchIssues, fetchLabels, fetchProjects, view } = useAppStore();

  const isConfigured = Boolean(token && owner && repo);

  useEffect(() => {
    if (isConfigured && issues.length === 0) {
      fetchIssues();
      fetchLabels();
      fetchProjects();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isConfigured) return <Setup />;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header />

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading issues…</div>
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-red-700 text-sm max-w-md text-center">
            <p className="font-medium mb-1">Failed to load issues</p>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1 overflow-hidden flex">
          {view === 'grid' ? <StoryMap /> : <KanbanView />}
        </div>
      )}
    </div>
  );
}
