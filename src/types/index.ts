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
  // key is epic issue number as string, or "backlog" for unassigned
  storyOrder: Record<string, number[]>;
}
