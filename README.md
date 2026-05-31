# GitHub Story Map

An elegant interface to visualize and manage GitHub issues as a story map or Kanban board.

## What it does

GitHub Story Map connects to any GitHub repository and presents issues in two structured views — a **Grid** (user activities × waves) and a **Kanban** (status columns × wave swimlanes). All placement is driven by GitHub labels, so the board always reflects what's on the issue.

## Views

### Grid view
Issues are laid out in a matrix:
- **Columns** = user activity labels (`e_*`, e.g. `e_Auth`)
- **Rows** = wave labels (`w_*`, e.g. `w_Q1`)

Each cell shows the issues that carry both that user activity and that wave label. A "No Wave" row catches issues with a user activity but no wave assigned.

### Kanban view
Issues are organized as a standard Kanban with swimlanes:
- **Columns** = status labels (`s_*`, e.g. `s_Todo`, `s_In Progress`, `s_Done`)
- **Swimlanes** = wave labels (`w_*`)

A "No Status" column and "No Wave" swimlane catch any untagged issues.

### Table view
Issues are displayed in a dense, spreadsheet-like tabular layout:
- **Columns**: #, Title, Status, User Activity, Wave (Milestone), Assignees, Updated Date, Actions
- **Sortable** by any column — click a column header to sort ascending/descending
- **Filter bar** at the top to instantly search across title, number, wave, and user activity
- **Click any row** to open the standard read-only issue modal
- **Inline actions** (Edit, Close/Reopen, Delete) appear on each row on hover
- Respects the show/hide closed issues toggle in the toolbar
- Reacts instantly to all issue state changes without a page refresh

## Label conventions

All structure comes from GitHub labels with these prefixes:

| Prefix | Example | Purpose |
|--------|---------|---------| 
| `e_` | `e_Auth` | User Activity — defines Grid columns |
| `w_` | `w_Q1` | Wave / release — defines Grid rows and Kanban swimlanes |
| `s_` | `s_Done` | Status — defines Kanban columns |
| `epic` | `epic` | Marks an issue as a User Activity (shown as context, not in cells) |

Labels are created automatically on GitHub when you add them through the **User Activities & Waves** manager or when creating an issue.

## Features

- Connect to any GitHub repository via personal access token
- Grid view: user activity × wave matrix with per-cell issue creation
- Kanban view: status columns with wave swimlanes
- **Table view**: dense, sortable, filterable spreadsheet of all issues
- Grid/Kanban/Table toggle in the toolbar
- Create issues with pre-filled user activity, wave, and status from any cell
- **Read-only issue view** — clicking an issue card opens a formatted read-only modal (see below)
- Edit, close, reopen, and permanently delete issues inline
- **Reopen closed issues** — a purple ↺ Reopen button replaces the Close button on closed issue cards (hover overlay) and in the read-only modal, sending a `PATCH` request to the GitHub Issues API to restore the issue to `open` state; the board updates immediately without a page refresh
- Manage epic, wave, and status labels without leaving the app
- Layout persisted to Firestore (optional — works fully offline)
- Real-time sync with GitHub Issues API
- Resizable columns in both Grid and Kanban views (see below)
- Describe with AI uses the user activity, the wave, the issue title, example issues, the code and additional instructions to create the issue's spec
- Code with AI delegate issue implementation to a Claude Managed Agent (creates branch, writes code, opens PR)

## Read-only issue view

Clicking any issue card in the Grid or Kanban view opens a **read-only modal** that presents the issue in a clean, safe reading environment:

- **Formatted Markdown** — the description is fully rendered with support for headings, bold/italic/strikethrough, fenced code blocks (with syntax highlighting theme), inline code, unordered and ordered lists, task lists (`- [ ]` / `- [x]`), blockquotes, thematic breaks, and Markdown links.
- **Metadata chips** — wave (milestone), user activity (project), status label, and assignee avatars are shown at a glance below the title.
- **Action toolbar** (top-right corner) — contains the same actions available on issue cards:
  | Button | Action |
  |--------|--------|
  | ✏️ Edit | Opens the edit modal (description tab) |
  | ✓ Close | Closes the issue on GitHub *(open issues only)* |
  | ↺ Reopen | Reopens the issue on GitHub *(closed issues only)* |
  | 🗑 Delete | Permanently deletes the issue |
  | ✦ Describe with AI | Opens the edit modal to generate a description via Gemini (visible when Gemini is configured) |
  | ⚡ Code with AI | Opens the edit modal on the Implementation tab to start an AI coding session (visible when Anthropic is configured) |
- **Deep-link support** — the URL updates to `/issue/{number}` when the modal is open; reloading the page reopens the same modal.

### Quick-edit fast path

The hover overlay on each card still exposes **Edit**, **Close** (open issues) / **Reopen** (closed issues), and **Delete** buttons directly, letting power users skip the read view and jump straight to the action.

## Getting started

### Prerequisites

- Node.js 18+
- A GitHub personal access token with `repo` scope

### Install

```bash
git clone https://github.com/lucssmassuh/github-story-map.git
cd github-story-map
npm install
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), enter your GitHub token and `owner/repo`, then use **User Activities & Waves** in the toolbar to add your first labels.

## Code with AI

The **⚡ Code with AI** button appears in the issue edit modal when the feature is configured. Clicking it starts a [Claude Managed Agent](https://docs.anthropic.com/en/docs/agents) session that reads the issue, creates a branch, writes the implementation, and opens a pull request — all without leaving the app.

A live **Agent Log** streams tool calls and messages in real time. Once the agent finishes, a **Branch** and **Pull Request** link appear in the modal and are saved to the issue description for anyone to follow.

### Setup

1. **Create a Managed Agent** (one-time, via the Anthropic API or console):
   - Give it a system prompt describing your repo conventions
   - Attach a **GitHub MCP server** so it can call the GitHub API
   - Note the returned `agent_id`

2. **Create a Vault** that holds your GitHub OAuth token:
   - Note the returned `vault_id`

3. **Create an Environment** (compute environment for the agent):
   - Note the returned `env_id`

4. **Configure in the app** — go to **Settings → Code with AI** and enter:
   - Anthropic API Key (`sk-ant-…`)
   - Agent ID (`agent_…`)
   - Environment ID (`env_…`)
   - Vault ID (`vlt_…`)

All values are stored in `localStorage` only.

> **Note:** The Managed Agents API is called directly from the browser using `fetch`. This requires Anthropic's API to allow cross-origin requests from your domain. If you encounter CORS errors, set up a lightweight proxy (e.g., a Firebase Cloud Function or Vite dev proxy) that forwards requests to `https://api.anthropic.com`.

## Tech stack

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS
- **GitHub integration:** GitHub REST API (Octokit)
- **State management:** Zustand
- **Persistence:** Firebase Firestore (optional)
- **AI — description generation:** Google Gemini API (direct `fetch`)
- **AI — code implementation:** Anthropic Claude Managed Agents API (direct `fetch`, beta `managed-agents-2026-04-01`)
- **Markdown rendering:** Built-in lightweight renderer (`src/lib/markdown.ts`) — no extra dependency
- **Build:** Vite

## Changelog

### Table View (#5)

A new **Table** tab is now available in the main toolbar, providing a high-density spreadsheet-style view of all issues:

- **`src/components/TableView.tsx`** — new component rendering issues as a dense HTML table with eight columns:
  | Column | Description |
  |--------|-------------|
  | # | Issue number badge, linked to GitHub |
  | Title | Issue title (truncated to one line) |
  | Status | Native project status badge (color-coded) |
  | User Activity | Project / user activity the issue belongs to |
  | Wave | Milestone / wave the issue is assigned to |
  | Assignees | Assignee avatars + login names |
  | Updated | Last-updated date |
  | Actions | Hover-to-reveal Edit, Close/Reopen, Delete buttons |
- **Sortable columns** — click any column header to sort ascending/descending; an arrow indicator shows the current sort.
- **Filter bar** — real-time text filter across title, number, wave, and user activity.
- **Row click → read modal** — clicking any table row opens the existing `IssueReadModal`, keeping the full action toolbar (Edit, Close/Reopen, Delete, AI actions) accessible.
- **Inline actions on hover** — the Actions column reveals Edit, Close/Reopen, and Delete buttons on row hover, matching the behavior of other views.
- **`src/types/index.ts`** — added `updated_at: string` field to `GitHubIssue`.
- **`src/store/appStore.ts`** — added `'table'` to the `view` union type and mapped `updated_at` in `fetchIssues` and `createIssue`/`updateIssue` responses.
- **`src/components/Header.tsx`** — added the `table` tab to the view toggle strip; the show/hide closed issues button now also applies to the Table view.
- **`src/App.tsx`** — imports and renders `TableView` when `view === 'table'`.

### Issue Reopen (#30)

Closed issues can now be reopened directly from the board without switching to the native GitHub UI:

- **IssueCard (hover overlay):** The green ✓ Close button is replaced by a purple ↺ Reopen button when the issue is already closed. Clicking it confirms and sends a `PATCH /repos/{owner}/{repo}/issues/{number}` request with `state: open`.
- **IssueReadModal (action toolbar):** A purple ↺ Reopen button appears in place of the Close button for closed issues, giving the same action from the detailed view.
- **State management (`appStore`):** A new `reopenIssue(number)` action updates the issue's `state` to `open` in the local Zustand cache immediately. If the issue was previously closed inline (and therefore removed from the layout), it is automatically restored to the backlog so it reappears on the Grid and Kanban views — preserving all existing `e_` and `w_` labels (user activity and wave labels).

## Troubleshooting

### NPM Permission Denied (EACCES)
If you encounter `EACCES` errors when installing packages globally (e.g., `firebase-tools`), it is likely because some files in your NVM directory are owned by `root`. To fix this, run:

```bash
sudo chown -R $(whoami) ~/.nvm
```
Then try the installation again.

### GitHub Token Config
For advanced features like the **[Describe]** skill, ensure you have a valid GitHub Personal Access Token in your `.env` file. You can find the required variables in `.env.example`.

## License

MIT
