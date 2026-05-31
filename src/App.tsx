import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { observeAuth, getCachedGithubToken } from './lib/auth';
import Login from './components/Login';
import Setup from './components/Setup';
import Header from './components/Header';
import StoryMap from './components/StoryMap';
import KanbanView from './components/KanbanView';
import TableView from './components/TableView';
import WavesView from './components/WavesView';
import UserActivitiesView from './components/UserActivitiesView';
import RoadmapView from './components/RoadmapView';
import TimelineView from './components/TimelineView';
import SettingsView from './components/SettingsView';

export default function App() {
  const {
    token, owner, repo, issues, loading, error,
    fetchIssues, fetchLabels, fetchProjects, fetchMilestones, fetchAllProjectStatuses,
    view, authStatus, setAuthSignedIn, setAuthSignedOut,
  } = useAppStore();

  useEffect(() => {
    const unsub = observeAuth((user) => {
      if (user) {
        const cachedToken = getCachedGithubToken();
        const login =
          user.providerData.find((p) => p.providerId === 'github.com')?.displayName ?? '';
        setAuthSignedIn(cachedToken, login);
      } else {
        setAuthSignedOut();
      }
    });
    return unsub;
  }, [setAuthSignedIn, setAuthSignedOut]);

  const isConfigured = Boolean(token && owner && repo);

  useEffect(() => {
    if (authStatus === 'signed-in' && isConfigured && issues.length === 0) {
      fetchIssues();
      fetchLabels();
      fetchProjects().then(() => fetchAllProjectStatuses());
      fetchMilestones();
    }
  }, [authStatus, isConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (authStatus === 'signed-out' || !token) return <Login />;

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
          {view === 'grid' && <StoryMap />}
          {view === 'kanban' && <KanbanView />}
          {view === 'table' && <TableView />}
          {view === 'waves' && <WavesView />}
          {view === 'user-activities' && <UserActivitiesView />}
          {view === 'roadmap' && <RoadmapView />}
          {view === 'timeline' && <TimelineView />}
          {view === 'settings' && <SettingsView />}
        </div>
      )}
    </div>
  );
}
