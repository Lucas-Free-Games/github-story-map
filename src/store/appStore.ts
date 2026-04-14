import { create } from 'zustand';
import { Octokit } from '@octokit/rest';
import type { GitHubIssue, GitHubProject, StoryMapLayout } from '../types';
import { loadLayout, saveLayout } from '../lib/firebase';

interface AppState {
  token: string;
  owner: string;
  repo: string;
  issues: GitHubIssue[];
  layout: StoryMapLayout;
  loading: boolean;
  error: string | null;
  epicLabels: string[];   // values without prefix, e.g. ["Auth", "Backend"]
  waveLabels: string[];   // values without prefix, e.g. ["Q1", "Q2"]
  statusLabels: string[]; // values without prefix, e.g. ["Todo", "In Progress", "Done"]
  view: 'grid' | 'kanban';
  projects: GitHubProject[];

  setCredentials: (token: string, owner: string, repo: string) => void;
  fetchIssues: () => Promise<void>;
  fetchLabels: () => Promise<void>;
  addEpicLabel: (name: string) => Promise<void>;
  addWaveLabel: (name: string) => Promise<void>;
  addStatusLabel: (name: string) => Promise<void>;
  setView: (view: 'grid' | 'kanban') => void;
  moveStory: (
    storyNumber: number,
    fromKey: string,
    toKey: string,
    toIndex: number,
  ) => void;
  reorderEpics: (fromIndex: number, toIndex: number) => void;
  reset: () => void;
  createIssue: (
    title: string,
    body: string,
    epicKey?: string,
    epicLabel?: string,
    waveLabel?: string,
    statusLabel?: string,
  ) => Promise<void>;
  updateIssue: (number: number, title: string, body: string) => Promise<void>;
  closeIssue: (number: number) => Promise<void>;
  deleteIssue: (number: number, nodeId: string) => Promise<void>;
  fetchProjects: () => Promise<void>;
  createProject: (title: string, description: string) => Promise<void>;
  updateProject: (id: string, title: string, description: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const emptyLayout: StoryMapLayout = { epicOrder: [], storyOrder: { backlog: [] } };

async function gql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as { data?: T; errors?: { message: string; path?: string[] }[] };
  if (json.errors?.length) {
    const { message, path } = json.errors[0];
    const location = path?.length ? ` (at: ${path.join(' → ')})` : '';
    throw new Error(`${message}${location}`);
  }
  return json.data as T;
}

function isEpic(issue: GitHubIssue) {
  return issue.labels.some((l) => l.name.toLowerCase() === 'epic');
}

async function ensureLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  name: string,
  color: string,
) {
  try {
    await octokit.rest.issues.createLabel({ owner, repo, name, color });
  } catch {
    // 422 = label already exists — safe to ignore
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  token: localStorage.getItem('gh_token') ?? '',
  owner: localStorage.getItem('gh_owner') ?? '',
  repo: localStorage.getItem('gh_repo') ?? '',
  issues: [],
  layout: emptyLayout,
  loading: false,
  error: null,
  epicLabels: [],
  waveLabels: [],
  statusLabels: [],
  view: 'grid',
  projects: [],

  setCredentials: (token, owner, repo) => {
    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_owner', owner);
    localStorage.setItem('gh_repo', repo);
    set({ token, owner, repo, issues: [], layout: emptyLayout, error: null, epicLabels: [], waveLabels: [], statusLabels: [] });
  },

  reset: () => {
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_owner');
    localStorage.removeItem('gh_repo');
    set({ token: '', owner: '', repo: '', issues: [], layout: emptyLayout, error: null, epicLabels: [], waveLabels: [], statusLabels: [] });
  },

  setView: (view) => set({ view }),

  fetchLabels: async () => {
    const { token, owner, repo } = get();
    if (!token || !owner || !repo) return;
    const octokit = new Octokit({ auth: token });
    const allLabels: string[] = [];
    let page = 1;
    while (true) {
      const { data } = await octokit.rest.issues.listLabelsForRepo({ owner, repo, per_page: 100, page });
      if (data.length === 0) break;
      allLabels.push(...data.map((l) => l.name));
      if (data.length < 100) break;
      page++;
    }
    set({
      epicLabels: allLabels.filter((n) => n.startsWith('e_')).map((n) => n.slice(2)),
      waveLabels: allLabels.filter((n) => n.startsWith('w_')).map((n) => n.slice(2)),
      statusLabels: allLabels.filter((n) => n.startsWith('s_')).map((n) => n.slice(2)),
    });
  },

  addEpicLabel: async (name) => {
    const { token, owner, repo, epicLabels } = get();
    const octokit = new Octokit({ auth: token });
    await ensureLabel(octokit, owner, repo, `e_${name}`, '0075ca');
    set({ epicLabels: [...epicLabels, name] });
  },

  addWaveLabel: async (name) => {
    const { token, owner, repo, waveLabels } = get();
    const octokit = new Octokit({ auth: token });
    await ensureLabel(octokit, owner, repo, `w_${name}`, '7057ff');
    set({ waveLabels: [...waveLabels, name] });
  },

  addStatusLabel: async (name) => {
    const { token, owner, repo, statusLabels } = get();
    const octokit = new Octokit({ auth: token });
    await ensureLabel(octokit, owner, repo, `s_${name}`, '0e8a16');
    set({ statusLabels: [...statusLabels, name] });
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
            node_id: item.node_id,
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

  createIssue: async (title, body, epicKey, epicLabel, waveLabel, statusLabel) => {
    const { token, owner, repo, issues, layout } = get();
    const octokit = new Octokit({ auth: token });

    // Ensure labels exist on the repo, then collect names to attach
    const labelNames: string[] = [];
    if (epicLabel?.trim()) {
      const name = `e_${epicLabel.trim()}`;
      await ensureLabel(octokit, owner, repo, name, '0075ca');
      labelNames.push(name);
    }
    if (waveLabel?.trim()) {
      const name = `w_${waveLabel.trim()}`;
      await ensureLabel(octokit, owner, repo, name, '7057ff');
      labelNames.push(name);
    }
    if (statusLabel?.trim()) {
      const name = `s_${statusLabel.trim()}`;
      await ensureLabel(octokit, owner, repo, name, '0e8a16');
      labelNames.push(name);
    }

    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels: labelNames,
    });

    const newIssue: GitHubIssue = {
      number: data.number,
      node_id: data.node_id,
      title: data.title,
      body: data.body ?? null,
      labels: (data.labels ?? []).map((l) =>
        typeof l === 'string'
          ? { id: 0, name: l, color: 'cccccc' }
          : { id: l.id ?? 0, name: l.name ?? '', color: l.color ?? 'cccccc' },
      ),
      assignees: (data.assignees ?? []).map((u) => ({ login: u.login, avatar_url: u.avatar_url })),
      milestone: data.milestone ? { number: data.milestone.number, title: data.milestone.title } : null,
      state: 'open',
      html_url: data.html_url,
    };

    const targetKey = epicKey ?? 'backlog';
    const newLayout: StoryMapLayout = {
      ...layout,
      storyOrder: {
        ...layout.storyOrder,
        [targetKey]: [newIssue.number, ...(layout.storyOrder[targetKey] ?? [])],
      },
    };

    set({ issues: [...issues, newIssue], layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },

  updateIssue: async (number, title, body) => {
    const { token, owner, repo, issues } = get();
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.update({ owner, repo, issue_number: number, title, body });
    set({
      issues: issues.map((i) =>
        i.number === number ? { ...i, title: data.title, body: data.body ?? null } : i,
      ),
    });
  },

  closeIssue: async (number) => {
    const { token, owner, repo, issues, layout } = get();
    const octokit = new Octokit({ auth: token });
    await octokit.rest.issues.update({ owner, repo, issue_number: number, state: 'closed' });

    const newStoryOrder = Object.fromEntries(
      Object.entries(layout.storyOrder).map(([key, nums]) => [key, nums.filter((n) => n !== number)]),
    );
    const newLayout: StoryMapLayout = {
      epicOrder: layout.epicOrder.filter((n) => n !== number),
      storyOrder: newStoryOrder,
    };

    set({ issues: issues.filter((i) => i.number !== number), layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },

  deleteIssue: async (number, nodeId) => {
    const { token, owner, repo, issues, layout } = get();

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation DeleteIssue($id: ID!) { deleteIssue(input: {issueId: $id}) { repository { id } } }`,
        variables: { id: nodeId },
      }),
    });
    const json = await res.json() as { errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);

    const newStoryOrder = Object.fromEntries(
      Object.entries(layout.storyOrder).map(([key, nums]) => [key, nums.filter((n) => n !== number)]),
    );
    const newLayout: StoryMapLayout = {
      epicOrder: layout.epicOrder.filter((n) => n !== number),
      storyOrder: newStoryOrder,
    };

    set({ issues: issues.filter((i) => i.number !== number), layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },

  fetchProjects: async () => {
    const { token, owner } = get();
    if (!token || !owner) return;
    const data = await gql<{
      repositoryOwner: {
        projectsV2?: { nodes: GitHubProject[] };
      } | null;
    }>(token, `
      query($login: String!) {
        repositoryOwner(login: $login) {
          ... on User { projectsV2(first: 50) { nodes { id number title shortDescription url closed } } }
          ... on Organization { projectsV2(first: 50) { nodes { id number title shortDescription url closed } } }
        }
      }
    `, { login: owner });
    set({ projects: data.repositoryOwner?.projectsV2?.nodes ?? [] });
  },

  createProject: async (title, description) => {
    const { token, owner, repo, projects } = get();

    const repoData = await gql<{
      repository: { id: string; owner: { id: string } };
    }>(token, `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          owner { id }
        }
      }
    `, { owner, repo });

    const ownerId = repoData.repository.owner.id;
    const repositoryId = repoData.repository.id;

    const createData = await gql<{
      createProjectV2: { projectV2: GitHubProject };
    }>(token, `
      mutation($ownerId: ID!, $title: String!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title }) {
          projectV2 { id number title shortDescription url closed }
        }
      }
    `, { ownerId, title });

    const project = { ...createData.createProjectV2.projectV2 };

    if (description.trim()) {
      await gql(token, `
        mutation($projectId: ID!, $desc: String!) {
          updateProjectV2(input: { projectId: $projectId, shortDescription: $desc }) {
            projectV2 { id }
          }
        }
      `, { projectId: project.id, desc: description.trim() });
      project.shortDescription = description.trim();
    }

    await gql(token, `
      mutation($projectId: ID!, $repositoryId: ID!) {
        linkProjectV2ToRepository(input: { projectId: $projectId, repositoryId: $repositoryId }) {
          repository { id }
        }
      }
    `, { projectId: project.id, repositoryId });

    set({ projects: [project, ...projects] });
  },

  updateProject: async (id, title, description) => {
    const { token, projects } = get();
    await gql(token, `
      mutation($projectId: ID!, $title: String!, $desc: String) {
        updateProjectV2(input: { projectId: $projectId, title: $title, shortDescription: $desc }) {
          projectV2 { id }
        }
      }
    `, { projectId: id, title, desc: description.trim() || null });
    set({
      projects: projects.map((p) =>
        p.id === id ? { ...p, title, shortDescription: description.trim() || null } : p,
      ),
    });
  },

  deleteProject: async (id) => {
    const { token, projects } = get();
    await gql(token, `
      mutation($projectId: ID!) {
        deleteProjectV2(input: { projectId: $projectId }) {
          projectV2 { id }
        }
      }
    `, { projectId: id });
    set({ projects: projects.filter((p) => p.id !== id) });
  },
}));
