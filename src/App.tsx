import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { observeAuth } from './lib/auth';
import { getUserKeyStatus } from './lib/userKeys';
import Login from './components/Login';
import Setup from './components/Setup';
import Header from './components/Header';
import Spinner from './components/Spinner';
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
    owner, repo, issues, loading, error,
    fetchIssues, fetchLabels, fetchProjects, fetchMilestones, fetchAllProjectStatuses,
    view, authStatus, setAuthSignedIn, setAuthSignedOut,
  } = useAppStore();

  useEffect(() => {
    const unsub = observeAuth(async (user) => {
      if (!user) {
        setAuthSignedOut();
        return;
      }
      const login =
        user.providerData.find((p) => p.providerId === 'github.com')?.displayName ?? '';
      try {
        const status = await getUserKeyStatus();
        if (!status.github) {
          setAuthSignedOut();
          return;
        }
        setAuthSignedIn(login);
      } catch {
        setAuthSignedOut();
      }
    });
    return unsub;
  }, [setAuthSignedIn, setAuthSignedOut]);

  const isConfigured = Boolean(owner && repo);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--n-sidebar)' }}>
        <Spinner className="w-5 h-5" />
      </div>
    );
  }

  if (authStatus === 'signed-out') return <Login />;

  if (!isConfigured) return <Setup />;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--n-bg)' }}>
      {/* Left sidebar navigation */}
      <Header />

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Slim progress bar for syncs when content is already loaded */}
        {loading && issues.length > 0 && (
          <div className="shrink-0 h-0.5 w-full overflow-hidden" style={{ background: 'var(--n-border)' }}>
            <div
              className="h-full"
              style={{ background: 'var(--n-blue)', animation: 'loading-bar 1.4s ease-in-out infinite' }}
            />
          </div>
        )}

        {/* Initial load — full-area spinner */}
        {loading && issues.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Spinner className="w-6 h-6 text-gray-400" />
            <span className="text-sm" style={{ color: 'var(--n-text-3)' }}>Loading…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="rounded-lg px-5 py-4 text-sm max-w-md text-center" style={{ background: '#FFF2F2', border: '1px solid #FFD5D5', color: '#E03E3E' }}>
              <p className="font-medium mb-1">Failed to load issues</p>
              <p style={{ color: '#D44C47' }}>{error}</p>
            </div>
          </div>
        )}

        {(!loading || issues.length > 0) && !error && (
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
      </main>
    </div>
  );
}
