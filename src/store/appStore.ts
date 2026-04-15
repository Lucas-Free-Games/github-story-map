import { create } from 'zustand';
import { Octokit } from '@octokit/rest';
import type { GitHubIssue, GitHubMilestone, GitHubProject, StoryMapLayout } from '../types';
import { loadLayout, saveLayout } from '../lib/firebase';

interface AppState {
  token: string;
  owner: string;
  repo: string;
  issues: GitHubIssue[];
  layout: StoryMapLayout;
  loading: boolean;
  error: string | null;
  milestones: GitHubMilestone[];
  statusLabels: string[]; // values without prefix, e.g. ["Todo", "In Progress", "Done"]
  view: 'grid' | 'kanban' | 'waves' | 'epics' | 'settings';
  showClosedIssues: boolean;
  projects: GitHubProject[];
  projectIssues: Record<string, number[]>; // project node_id → issue numbers

  setCredentials: (token: string, owner: string, repo: string) => void;
  fetchIssues: () => Promise<void>;
  toggleShowClosedIssues: () => void;
  fetchLabels: () => Promise<void>;
  fetchMilestones: () => Promise<void>;
  createMilestone: (title: string, description: string) => Promise<void>;
  updateMilestone: (number: number, title: string, description: string) => Promise<void>;
  deleteMilestone: (number: number) => Promise<void>;
  addStatusLabel: (name: string) => Promise<void>;
  setView: (view: 'grid' | 'kanban' | 'waves' | 'epics' | 'settings') => void;
  moveStory: (
    storyNumber: number,
    fromKey: string,
    toKey: string,
    toIndex: number,
  ) => void;
  reset: () => void;
  createIssue: (
    title: string,
    body: string,
    projectId?: string,
    milestoneNumber?: number,
    statusLabel?: string,
  ) => Promise<void>;
  updateIssue: (number: number, title: string, body: string, milestoneNumber?: number | null) => Promise<void>;
  closeIssue: (number: number) => Promise<void>;
  deleteIssue: (number: number, nodeId: string) => Promise<void>;
  fetchProjects: () => Promise<void>;
  createProject: (title: string, description: string) => Promise<void>;
  updateProject: (id: string, title: string, description: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addIssueToProject: (issueNodeId: string, projectId: string) => Promise<void>;
  removeIssueFromProject: (issueNodeId: string, projectId: string) => Promise<void>;
  reorderProjects: (fromIndex: number, toIndex: number) => void;
  reorderMilestones: (fromIndex: number, toIndex: number) => void;
  moveIssueInGrid: (
    issueNumber: number,
    fromProjectId: string,
    toProjectId: string,
    fromMilestoneNumber: number | null,
    toMilestoneNumber: number | null,
  ) => Promise<void>;
  moveIssueInKanban: (
    issueNumber: number,
    fromStatus: string | null,
    toStatus: string | null,
    fromMilestoneNumber: number | null,
    toMilestoneNumber: number | null,
  ) => Promise<void>;
}

const emptyLayout: StoryMapLayout = { epicOrder: [], milestoneOrder: [], storyOrder: { backlog: [] } };

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
  token: localStorage.getItem('gh_token') ?? import.meta.env.VITE_GITHUB_TOKEN ?? '',
  owner: localStorage.getItem('gh_owner') ?? import.meta.env.VITE_GITHUB_OWNER ?? '',
  repo: localStorage.getItem('gh_repo') ?? import.meta.env.VITE_GITHUB_REPO ?? '',
  issues: [],
  layout: emptyLayout,
  loading: false,
  error: null,
  milestones: [],
  statusLabels: [],
  view: 'grid',
  showClosedIssues: false,
  projects: [],
  projectIssues: {},

  setCredentials: (token, owner, repo) => {
    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_owner', owner);
    localStorage.setItem('gh_repo', repo);
    set({ token, owner, repo, issues: [], layout: emptyLayout, error: null, milestones: [], statusLabels: [], projects: [], projectIssues: {} });
  },

  reset: () => {
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_owner');
    localStorage.removeItem('gh_repo');
    set({ token: '', owner: '', repo: '', issues: [], layout: emptyLayout, error: null, milestones: [], statusLabels: [], projects: [], projectIssues: {} });
  },

  setView: (view) => set({ view }),

  toggleShowClosedIssues: () => set((state) => ({ showClosedIssues: !state.showClosedIssues })),

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
    set({ statusLabels: allLabels.filter((n) => n.startsWith('s_')).map((n) => n.slice(2)) });
  },

  fetchMilestones: async () => {
    const { token, owner, repo, layout } = get();
    if (!token || !owner || !repo) return;
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.listMilestones({ owner, repo, state: 'open', per_page: 100 });
    const milestones: GitHubMilestone[] = data.map((m) => ({
      number: m.number,
      title: m.title,
      description: m.description ?? null,
      state: m.state as 'open' | 'closed',
      due_on: m.due_on ?? null,
    }));

    const milestoneNumbers = milestones.map((m) => m.number);
    const preserved = (layout.milestoneOrder ?? []).filter((n) => milestoneNumbers.includes(n));
    const added = milestoneNumbers.filter((n) => !preserved.includes(n));
    const newMilestoneOrder = [...preserved, ...added];
    const orderChanged = newMilestoneOrder.length !== (layout.milestoneOrder ?? []).length ||
      newMilestoneOrder.some((n, i) => n !== (layout.milestoneOrder ?? [])[i]);

    if (orderChanged) {
      const newLayout = { ...layout, milestoneOrder: newMilestoneOrder };
      set({ milestones, layout: newLayout });
      saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
    } else {
      set({ milestones });
    }
  },

  createMilestone: async (title, description) => {
    const { token, owner, repo, milestones } = get();
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.createMilestone({ owner, repo, title, description: description || undefined });
    set({
      milestones: [...milestones, {
        number: data.number,
        title: data.title,
        description: data.description ?? null,
        state: 'open',
        due_on: data.due_on ?? null,
      }],
    });
  },

  updateMilestone: async (number, title, description) => {
    const { token, owner, repo, milestones } = get();
    const octokit = new Octokit({ auth: token });
    await octokit.rest.issues.updateMilestone({ owner, repo, milestone_number: number, title, description: description || undefined });
    set({ milestones: milestones.map((m) => m.number === number ? { ...m, title, description: description || null } : m) });
  },

  deleteMilestone: async (number) => {
    const { token, owner, repo, milestones } = get();
    const octokit = new Octokit({ auth: token });
    await octokit.rest.issues.deleteMilestone({ owner, repo, milestone_number: number });
    set({ milestones: milestones.filter((m) => m.number !== number) });
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
          state: 'all',
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
              ? { number: item.milestone.number, title: item.milestone.title, description: item.milestone.description ?? null, state: item.milestone.state as 'open' | 'closed', due_on: item.milestone.due_on ?? null }
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
        layout = {
          epicOrder: [],
          milestoneOrder: [],
          storyOrder: { backlog: allItems.map((i) => i.number) },
        };
        try { await saveLayout(owner, repo, layout); } catch { /* offline */ }
      } else {
        layout = savedLayout;
        const allInLayout = new Set(Object.values(layout.storyOrder).flat());
        const newIssues = allItems.filter((i) => !allInLayout.has(i.number));
        if (newIssues.length) {
          layout = {
            ...layout,
            storyOrder: {
              ...layout.storyOrder,
              backlog: [...(layout.storyOrder.backlog ?? []), ...newIssues.map((i) => i.number)],
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

  createIssue: async (title, body, projectId, milestoneNumber, statusLabel) => {
    const { token, owner, repo, issues } = get();
    const octokit = new Octokit({ auth: token });

    const labelNames: string[] = [];
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
      milestone: milestoneNumber,
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
      milestone: data.milestone ? { number: data.milestone.number, title: data.milestone.title, description: null, state: 'open', due_on: null } : null,
      state: 'open',
      html_url: data.html_url,
    };

    set({ issues: [...issues, newIssue] });

    if (projectId) {
      await get().addIssueToProject(data.node_id, projectId);
    }
  },

  updateIssue: async (number, title, body, milestoneNumber) => {
    const { token, owner, repo, issues, milestones } = get();
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.update({
      owner, repo, issue_number: number, title, body,
      ...(milestoneNumber !== undefined ? { milestone: milestoneNumber ?? null } : {}),
    });
    const milestone = data.milestone
      ? milestones.find((m) => m.number === data.milestone!.number) ?? {
          number: data.milestone.number,
          title: data.milestone.title,
          description: null,
          state: 'open' as const,
          due_on: data.milestone.due_on ?? null,
        }
      : null;
    set({
      issues: issues.map((i) =>
        i.number === number ? { ...i, title: data.title, body: data.body ?? null, milestone } : i,
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
      milestoneOrder: layout.milestoneOrder ?? [],
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
      milestoneOrder: layout.milestoneOrder ?? [],
      storyOrder: newStoryOrder,
    };

    set({ issues: issues.filter((i) => i.number !== number), layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },

  fetchProjects: async () => {
    const { token, owner, repo, layout } = get();
    if (!token || !owner) return;

    type ProjectNode = GitHubProject & {
      items: { nodes: Array<{ content: { number: number } | null }> };
    };

    const data = await gql<{
      repositoryOwner: { projectsV2?: { nodes: ProjectNode[] } } | null;
    }>(token, `
      query($login: String!) {
        repositoryOwner(login: $login) {
          ... on User {
            projectsV2(first: 50) {
              nodes {
                id number title shortDescription url closed
                items(first: 100) { nodes { content { ... on Issue { number } } } }
              }
            }
          }
          ... on Organization {
            projectsV2(first: 50) {
              nodes {
                id number title shortDescription url closed
                items(first: 100) { nodes { content { ... on Issue { number } } } }
              }
            }
          }
        }
      }
    `, { login: owner });

    const nodes = data.repositoryOwner?.projectsV2?.nodes ?? [];
    const projects: GitHubProject[] = nodes.map(({ items: _items, ...p }) => p);
    const projectIssues: Record<string, number[]> = {};
    for (const node of nodes) {
      projectIssues[node.id] = node.items.nodes
        .map((item) => item.content?.number)
        .filter((n): n is number => n !== undefined);
    }

    // Sync epicOrder with current project numbers (preserving saved order, appending new)
    const projectNumbers = projects.map((p) => p.number);
    const preserved = layout.epicOrder.filter((n) => projectNumbers.includes(n));
    const added = projectNumbers.filter((n) => !preserved.includes(n));
    const newEpicOrder = [...preserved, ...added];
    const orderChanged = newEpicOrder.some((n, i) => n !== layout.epicOrder[i]) ||
      newEpicOrder.length !== layout.epicOrder.length;

    if (orderChanged) {
      const newLayout = { ...layout, epicOrder: newEpicOrder };
      set({ projects, projectIssues, layout: newLayout });
      saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
    } else {
      set({ projects, projectIssues });
    }
  },

  addIssueToProject: async (issueNodeId, projectId) => {
    const { token, projectIssues, issues } = get();
    await gql(token, `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }
    `, { projectId, contentId: issueNodeId });

    const issue = issues.find((i) => i.node_id === issueNodeId);
    if (issue) {
      set({
        projectIssues: {
          ...projectIssues,
          [projectId]: [issue.number, ...(projectIssues[projectId] ?? [])],
        },
      });
    }
  },

  removeIssueFromProject: async (issueNodeId, projectId) => {
    const { token, projectIssues, issues } = get();

    // Find the ProjectV2Item ID for this issue within the project
    const data = await gql<{
      node: { items: { nodes: Array<{ id: string; content: { id: string } | null }> } } | null;
    }>(token, `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content { ... on Issue { id } }
              }
            }
          }
        }
      }
    `, { projectId });

    const item = data.node?.items.nodes.find((n) => n.content?.id === issueNodeId);
    if (!item) return;

    await gql(token, `
      mutation($projectId: ID!, $itemId: ID!) {
        deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
          deletedItemId
        }
      }
    `, { projectId, itemId: item.id });

    const issue = issues.find((i) => i.node_id === issueNodeId);
    if (issue) {
      set({
        projectIssues: {
          ...projectIssues,
          [projectId]: (projectIssues[projectId] ?? []).filter((n) => n !== issue.number),
        },
      });
    }
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

  reorderProjects: (fromIndex, toIndex) => {
    const { layout, owner, repo } = get();
    const epicOrder = [...layout.epicOrder];
    const [moved] = epicOrder.splice(fromIndex, 1);
    epicOrder.splice(toIndex, 0, moved);
    const newLayout = { ...layout, epicOrder };
    set({ layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },

  reorderMilestones: (fromIndex, toIndex) => {
    const { layout, owner, repo } = get();
    const milestoneOrder = [...(layout.milestoneOrder ?? [])];
    const [moved] = milestoneOrder.splice(fromIndex, 1);
    milestoneOrder.splice(toIndex, 0, moved);
    const newLayout = { ...layout, milestoneOrder };
    set({ layout: newLayout });
    saveLayout(owner, repo, newLayout).catch(() => { /* offline */ });
  },

  moveIssueInGrid: async (issueNumber, fromProjectId, toProjectId, fromMilestoneNumber, toMilestoneNumber) => {
    const { token, owner, repo, issues, projectIssues, milestones } = get();
    const issue = issues.find((i) => i.number === issueNumber);
    if (!issue) return;

    const snapIssues = issues;
    const snapProjectIssues = projectIssues;

    // Optimistic update — milestone and project membership
    const newMilestone = toMilestoneNumber === null
      ? null
      : milestones.find((m) => m.number === toMilestoneNumber) ?? null;

    let updatedProjectIssues = { ...projectIssues };
    if (fromProjectId !== toProjectId) {
      if (fromProjectId) {
        updatedProjectIssues = {
          ...updatedProjectIssues,
          [fromProjectId]: (updatedProjectIssues[fromProjectId] ?? []).filter((n) => n !== issueNumber),
        };
      }
      if (toProjectId) {
        updatedProjectIssues = {
          ...updatedProjectIssues,
          [toProjectId]: [issueNumber, ...(updatedProjectIssues[toProjectId] ?? [])],
        };
      }
    }

    set({
      issues: issues.map((i) => i.number === issueNumber ? { ...i, milestone: newMilestone } : i),
      projectIssues: updatedProjectIssues,
    });

    try {
      if (fromProjectId !== toProjectId) {
        if (fromProjectId) {
          const data = await gql<{
            node: { items: { nodes: Array<{ id: string; content: { id: string } | null }> } } | null;
          }>(token, `
            query($projectId: ID!) {
              node(id: $projectId) {
                ... on ProjectV2 {
                  items(first: 100) {
                    nodes { id content { ... on Issue { id } } }
                  }
                }
              }
            }
          `, { projectId: fromProjectId });
          const item = data.node?.items.nodes.find((n) => n.content?.id === issue.node_id);
          if (item) {
            await gql(token, `
              mutation($projectId: ID!, $itemId: ID!) {
                deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) { deletedItemId }
              }
            `, { projectId: fromProjectId, itemId: item.id });
          }
        }
        if (toProjectId) {
          await gql(token, `
            mutation($projectId: ID!, $contentId: ID!) {
              addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
            }
          `, { projectId: toProjectId, contentId: issue.node_id });
        }
      }
      if (fromMilestoneNumber !== toMilestoneNumber) {
        const octokit = new Octokit({ auth: token });
        await octokit.rest.issues.update({
          owner, repo, issue_number: issueNumber,
          milestone: toMilestoneNumber,
        });
      }
    } catch (err) {
      set({ issues: snapIssues, projectIssues: snapProjectIssues });
      throw err;
    }
  },

  moveIssueInKanban: async (issueNumber, fromStatus, toStatus, fromMilestoneNumber, toMilestoneNumber) => {
    const { token, owner, repo, issues, milestones } = get();
    const issue = issues.find((i) => i.number === issueNumber);
    if (!issue) return;

    const snapIssues = issues;

    const baseLabels = issue.labels.filter((l) => !l.name.startsWith('s_'));
    const newLabels = toStatus
      ? [...baseLabels, { id: 0, name: `s_${toStatus}`, color: '0e8a16' }]
      : baseLabels;

    const newMilestone = toMilestoneNumber === null
      ? null
      : milestones.find((m) => m.number === toMilestoneNumber) ?? null;

    set({
      issues: issues.map((i) =>
        i.number === issueNumber ? { ...i, labels: newLabels, milestone: newMilestone } : i
      ),
    });

    try {
      const octokit = new Octokit({ auth: token });
      if (fromStatus !== toStatus) {
        if (toStatus) await ensureLabel(octokit, owner, repo, `s_${toStatus}`, '0e8a16');
        await octokit.rest.issues.setLabels({
          owner, repo, issue_number: issueNumber,
          labels: newLabels.map((l) => l.name),
        });
      }
      if (fromMilestoneNumber !== toMilestoneNumber) {
        await octokit.rest.issues.update({
          owner, repo, issue_number: issueNumber,
          milestone: toMilestoneNumber,
        });
      }
    } catch (err) {
      set({ issues: snapIssues });
      throw err;
    }
  },
}));
