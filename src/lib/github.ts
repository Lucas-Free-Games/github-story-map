import type { AiLinks } from './anthropic';

/**
 * Fetch implementation links (branch + PR) for an issue directly from GitHub.
 * Strategy:
 * 1. Search for PRs that reference the issue (REST search API)
 * 2. From the found PR, read head.ref for the branch name
 * 3. Fall back to GraphQL linkedBranches if no PR found
 */
export async function fetchIssueImplementation(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<AiLinks> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  // Step 1: find a PR that references this issue
  const prResult = await findLinkedPR(headers, owner, repo, issueNumber);
  if (prResult) {
    return prResult;
  }

  // Step 2: no PR found — try GraphQL linkedBranches only
  const branch = await fetchLinkedBranch(token, owner, repo, issueNumber);
  return { branch };
}

interface PRSearchItem {
  number: number;
  html_url: string;
  pull_request?: unknown;
}

async function findLinkedPR(
  headers: Record<string, string>,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<AiLinks | null> {
  try {
    const q = encodeURIComponent(`repo:${owner}/${repo} is:pr #${issueNumber}`);
    const res = await fetch(
      `https://api.github.com/search/issues?q=${q}&per_page=5&sort=updated`,
      { headers },
    );
    const json = await res.json() as { items?: PRSearchItem[] };
    const item = json.items?.find(i => i.pull_request);
    if (!item) return null;

    // Fetch full PR to get head.ref (branch name)
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${item.number}`,
      { headers },
    );
    const pr = await prRes.json() as { html_url: string; head?: { ref: string } };
    const branchName = pr.head?.ref;

    return {
      pr: pr.html_url,
      branch: branchName
        ? `https://github.com/${owner}/${repo}/tree/${branchName}`
        : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchLinkedBranch(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
              issue(number: $number) {
                linkedBranches(first: 5) {
                  nodes { ref { name } }
                }
              }
            }
          }
        `,
        variables: { owner, repo, number: issueNumber },
      }),
    });
    const json = await res.json() as {
      data?: { repository?: { issue?: { linkedBranches?: { nodes: { ref: { name: string } }[] } } } };
    };
    const name = json.data?.repository?.issue?.linkedBranches?.nodes?.[0]?.ref?.name;
    return name ? `https://github.com/${owner}/${repo}/tree/${name}` : undefined;
  } catch {
    return undefined;
  }
}
