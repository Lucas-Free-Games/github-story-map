# GitHub Story Map

An elegant and usable interface to visualize and manage GitHub issues as a story map.

## What it does

GitHub Story Map connects to your GitHub repositories and presents issues in a structured story map layout — making it easy to plan, prioritize, and track work across epics, user stories, and tasks without leaving a clean, focused UI.

## Features

- Connect to any GitHub repository via personal access token
- Visualize issues as a story map (epics → stories → tasks)
- Drag-and-drop to reorganize and reprioritize
- Filter by label, milestone, or assignee
- Real-time sync with GitHub Issues API

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

Open [http://localhost:3000](http://localhost:3000) and connect your GitHub token to get started.

## Tech stack

- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS
- **GitHub integration:** GitHub REST API (Octokit)
- **State management:** Zustand

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

## License

MIT
