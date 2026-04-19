export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
}

export interface GitHubMilestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  due_on: string | null;
}

export interface GitHubIssue {
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  state: 'open' | 'closed';
  html_url: string;
}

export interface StoryMapLayout {
  epicOrder: number[];
  milestoneOrder: number[];
  // key is project number as string, or "backlog" for unassigned
  storyOrder: Record<string, number[]>;
}

export interface GitHubProject {
  id: string;          // GraphQL node ID
  number: number;
  title: string;
  shortDescription: string | null;
  url: string;
  closed: boolean;
}

export interface ProjectV2StatusOption {
  id: string;
  name: string;
  color: string;
}

export interface ProjectV2StatusField {
  id: string;
  name: string;
  options: ProjectV2StatusOption[];
}
