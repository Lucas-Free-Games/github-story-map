# GitHub Story Map

An elegant interface to visualize and manage GitHub issues as a story map or Kanban board.

## What it does

GitHub Story Map connects to any GitHub repository and presents issues in two structured views — a **Grid** (epics × waves) and a **Kanban** (status columns × wave swimlanes). All placement is driven by GitHub labels, so the board always reflects what's on the issue.

## Views

### Grid view
Issues are laid out in a matrix:
- **Columns** = epic labels (`e_*`, e.g. `e_Auth`)
- **Rows** = wave labels (`w_*`, e.g. `w_Q1`)

Each cell shows the issues that carry both that epic and that wave label. A "No Wave" row catches issues with an epic but no wave assigned.

### Kanban view
Issues are organized as a standard Kanban with swimlanes:
- **Columns** = status labels (`s_*`, e.g. `s_Todo`, `s_In Progress`, `s_Done`)
- **Swimlanes** = wave labels (`w_*`)

A "No Status" column and "No Wave" swimlane catch any untagged issues.

## Label conventions

All structure comes from GitHub labels with these prefixes:

| Prefix | Example | Purpose |
|--------|---------|---------|
| `e_` | `e_Auth` | Epic — defines Grid columns |
| `w_` | `w_Q1` | Wave / release — defines Grid rows and Kanban swimlanes |
| `s_` | `s_Done` | Status — defines Kanban columns |
| `epic` | `epic` | Marks an issue as an Epic (shown as context, not in cells) |

Labels are created automatically on GitHub when you add them through the **Epics & Waves** manager or when creating an issue.

## Features

- Connect to any GitHub repository via personal access token
- Grid view: epic × wave matrix with per-cell issue creation
- Kanban view: status columns with wave swimlanes
- Grid/Kanban toggle in the toolbar
- Create issues with pre-filled epic, wave, and status from any cell
- Edit, close, and permanently delete issues inline
- Manage epic, wave, and status labels without leaving the app
- Layout persisted to Firestore (optional — works fully offline)
- Real-time sync with GitHub Issues API
- Resizable columns in both Grid and Kanban views (see below)
- Describe with AI uses the epic, the wave, the issue tilte, example issues, the code and additional instructions to create the issue's spec
- Code with AI delegate issue implementation to a Claude Managed Agent (creates branch, writes code, opens PR)

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

Open [http://localhost:5173](http://localhost:5173), enter your GitHub token and `owner/repo`, then use **Epics & Waves** in the toolbar to add your first labels.

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
- **Build:** Vite

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
