import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubProject, GitHubMilestone } from '../types';

interface IssueCounts { open: number; done: number; closed: number }

function isDone(issue: GitHubIssue): boolean {
  return issue.labels.some((l) => /^s_done$/i.test(l.name));
}

function countIssues(issues: GitHubIssue[]): IssueCounts {
  return issues.reduce<IssueCounts>(
    (acc, issue) => {
      if (issue.state === 'closed') acc.closed++;
      else if (isDone(issue)) acc.done++;
      else acc.open++;
      return acc;
    },
    { open: 0, done: 0, closed: 0 },
  );
}

const SIZE = 56;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function DonutChart({ open, done, closed }: IssueCounts) {
  const total = open + done + closed;

  if (total === 0) {
    return (
      <div
        style={{ width: SIZE, height: SIZE }}
        className="rounded-full border-2 border-dashed border-gray-200"
      />
    );
  }

  const segments = [
    { count: closed, color: '#4ade80' },
    { count: done,   color: '#60a5fa' },
    { count: open,   color: '#e5e7eb' },
  ].filter((s) => s.count > 0);

  let cumulative = 0;
  const arcs = segments.map((s) => {
    const length = (s.count / total) * CIRCUMFERENCE;
    const dashoffset = CIRCUMFERENCE / 4 - cumulative;
    cumulative += length;
    return { ...s, length, dashoffset };
  });

  return (
    <svg width={SIZE} height={SIZE}>
      <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke={arc.color}
          strokeWidth={STROKE}
          strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
          strokeDashoffset={arc.dashoffset}
        />
      ))}
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#6b7280"
        fontSize={13}
        fontFamily="sans-serif"
      >
        {total}
      </text>
    </svg>
  );
}

function RoadmapCell({ issues }: { issues: GitHubIssue[] }) {
  const counts = countIssues(issues);
  const total = counts.open + counts.done + counts.closed;

  return (
    <div className="relative group/cell flex items-center justify-center p-2 min-w-[72px] min-h-[72px]">
      <DonutChart {...counts} />
      {total > 0 && (
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover/cell:opacity-100 transition-opacity">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#e5e7eb' }} />
              Open: {counts.open}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#60a5fa' }} />
              Done: {counts.done}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#4ade80' }} />
              Closed: {counts.closed}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function sortedProjects(projects: GitHubProject[], order: number[]): GitHubProject[] {
  return [...projects.filter((p) => !p.closed)].sort((a, b) => {
    const ai = order.indexOf(a.number);
    const bi = order.indexOf(b.number);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function sortedMilestones(milestones: GitHubMilestone[], order: number[]): GitHubMilestone[] {
  return [...milestones].sort((a, b) => {
    const ai = (order ?? []).indexOf(a.number);
    const bi = (order ?? []).indexOf(b.number);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function RoadmapView() {
  const { issues, projects, milestones, projectIssues, layout } = useAppStore();

  const rows = sortedProjects(projects, layout.userActivityOrder);
  const cols = sortedMilestones(milestones, layout.milestoneOrder ?? []);

  const allProjectIssueNumbers = new Set(Object.values(projectIssues).flat());

  function cellIssues(projectId: string | null, milestoneNumber: number | null): GitHubIssue[] {
    return issues.filter((issue) => {
      const pMatch = projectId === null
        ? !allProjectIssueNumbers.has(issue.number)
        : (projectIssues[projectId] ?? []).includes(issue.number);
      const mMatch = milestoneNumber === null
        ? issue.milestone === null
        : issue.milestone?.number === milestoneNumber;
      return pMatch && mMatch;
    });
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-white border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-400 min-w-[160px] text-left whitespace-nowrap">
              User Activity / Wave
            </th>
            {cols.map((m) => (
              <th
                key={m.number}
                className="sticky top-0 z-20 bg-purple-50 border border-gray-200 px-3 py-2 text-xs font-semibold text-purple-900 text-center whitespace-nowrap"
              >
                {m.title}
              </th>
            ))}
            <th className="sticky top-0 z-20 bg-purple-50 border border-gray-200 px-3 py-2 text-xs font-normal italic text-purple-400 text-center whitespace-nowrap">
              No Wave
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project) => (
            <tr key={project.id}>
              <td className="sticky left-0 z-10 bg-white border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                {project.title}
              </td>
              {cols.map((m) => (
                <td key={m.number} className="border border-gray-200 bg-white p-0">
                  <RoadmapCell issues={cellIssues(project.id, m.number)} />
                </td>
              ))}
              <td className="border border-gray-200 bg-white p-0">
                <RoadmapCell issues={cellIssues(project.id, null)} />
              </td>
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 z-10 bg-white border border-gray-200 px-4 py-2 text-xs font-normal italic text-gray-400 whitespace-nowrap">
              No User Activity
            </td>
            {cols.map((m) => (
              <td key={m.number} className="border border-gray-200 bg-white p-0">
                <RoadmapCell issues={cellIssues(null, m.number)} />
              </td>
            ))}
            <td className="border border-gray-200 bg-white p-0">
              <RoadmapCell issues={cellIssues(null, null)} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#e5e7eb' }} />
          Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#60a5fa' }} />
          Done (s_done label)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#4ade80' }} />
          Closed
        </span>
      </div>
    </div>
  );
}
