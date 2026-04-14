import { create } from 'zustand';
import { Octokit } from '@octokit/rest';
import type { GitHubIssue, StoryMapLayout } from '../types';
import { loadLayout, saveLayout } from '../lib/firebase';

interface AppState {
  token: string;
  owner: string;
  repo: string;
  issues: GitHubIssue[];
  layout: StoryMapLayout;
  loading: boolean;
  error: string | null;

  setCredentials: (token: string, owner: string, repo: string) => void;
  fetchIssues: () => Promise<void>;
  moveStory: (
    storyNumber: number,
    fromKey: string,
    toKey: string,
    toIndex: number,
  ) => void;
  reorderEpics: (fromIndex: number, toIndex: number) => void;
  reset: () => void;
}

const emptyLayout: StoryMapLayout = { epicOrder: [], storyOrder: { backlog: [] } };

function isEpic(issue: GitHubIssue) {
  return issue.labels.some((l) => l.name.toLowerCase() === 'epic');
}

export const useAppStore = create<AppState>((set, get) => ({
  token: localStorage.getItem('gh_token') ?? '',
  owner: localStorage.getItem('gh_owner') ?? '',
  repo: localStorage.getItem('gh_repo') ?? '',
  issues: [],
  layout: emptyLayout,
  loading: false,
  error: null,

  setCredentials: (token, owner, repo) => {
    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_owner', owner);
    localStorage.setItem('gh_repo', repo);
    set({ token, owner, repo, issues: [], layout: emptyLayout, error: null });
  },

  reset: () => {
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_owner');
    localStorage.removeItem('gh_repo');
    set({ token: '', owner: '', repo: '', issues: [], layout: emptyLayout, error: null });
  },

  fetchIssues: async () => {
    const { token, owner, repo } = get();
    if (!token || !owner || !repo) return;

    set({ loading: true, error: null });
    try {
      const octokit = new Octokit({ auth: token });
      const allItems: GitHubIssue[] = [];
      let page = 1;

      while (true) {
        const { data } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: 'open',
          per_page: 100,
          page,
        });
        if (data.length === 0) break;

        const mapped = data
          .filter((item) => !(item as { pull_request?: unknown }).pull_request)
          .map((item) => ({
            number: item.number,
            title: item.title,
            body: item.body ?? null,
            labels: (item.labels ?? []).map((l) =>
              typeof l === 'string'
                ? { id: 0, name: l, color: 'cccccc' }
                : { id: l.id ?? 0, name: l.name ?? '', color: l.color ?? 'cccccc' },
            ),
            assignees: (item.assignees ?? []).map((u) => ({
              login: u.login,
              avatar_url: u.avatar_url,
            })),
            milestone: item.milestone
              ? { number: item.milestone.number, title: item.milestone.title }
              : null,
            state: item.state as 'open' | 'closed',
            html_url: item.html_url,
          } as GitHubIssue));

        allItems.push(...mapped);
        if (data.length < 100) break;
        page++;
      }

      // Load or build layout — Firestore is optional; app works without it
      let savedLayout: StoryMapLayout | null = null;
      try {
        savedLayout = await loadLayout(owner, repo);
      } catch (firestoreErr) {
        console.warn('Firestore unavailable, building layout from issues', firestoreErr);
      }

      let layout: StoryMapLayout;
      if (!savedLayout) {
        const epics = allItems.filter(isEpic);
        const stories = allItems.filter((i) => !isEpic(i));
        layout = {
          epicOrder: epics.map((e) => e.number),
          storyOrder: {
            backlog: stories.map((i) => i.number),
            ...Object.fromEntries(epics.map((e) => [String(e.number), []])),
          },
        };
        try { await saveLayout(owner, repo, layout); } catch { /* offline */ }
      } else {
        layout = savedLayout;
        // Add any new issues not yet in the layout
        const allInLayout = new Set([
          ...layout.epicOrder,
          ...Object.values(layout.storyOrder).flat(),
        ]);

        const newEpics = allItems.filter(isEpic).filter((i) => !allInLayout.has(i.number));
        const newStories = allItems
          .filter((i) => !isEpic(i))
          .filter((i) => !allInLayout.has(i.number));

        if (newEpics.length || newStories.length) {
          layout = {
            epicOrder: [...layout.epicOrder, ...newEpics.map((e) => e.number)],
            storyOrder: {
              ...layout.storyOrder,
              backlog: [...(layout.storyOrder.backlog ?? []), ...newStories.map((i) => i.number)],
              ...Object.fromEntries(newEpics.map((e) => [String(e.number), []])),
            },
          };
          try { await saveLayout(owner, repo, layout); } catch { /* offline */ }
        }
      }

      set({ issues: allItems, layout, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch issues';
      set({ error: message, loading: false });
    }
  },

  moveStory: (storyNumber, fromKey, toKey, toIndex) => {
    const { layout, owner, repo } = get();
    const order = { ...layout.storyOrder };

    order[fromKey] = (order[fromKey] ?? []).filter((n) => n !== storyNumber);
    const dest = [...(order[toKey] ?? [])];
    dest.splice(toIndex, 0, storyNumber);
    order[toKey] = dest;

    const newLayout = { ...layout, storyOrder: order };
    set({ layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },

  reorderEpics: (fromIndex, toIndex) => {
    const { layout, owner, repo } = get();
    const epicOrder = [...layout.epicOrder];
    const [moved] = epicOrder.splice(fromIndex, 1);
    epicOrder.splice(toIndex, 0, moved);
    const newLayout = { ...layout, epicOrder };
    set({ layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },
}));
