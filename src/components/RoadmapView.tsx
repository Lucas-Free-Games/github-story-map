import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubProject, GitHubMilestone } from '../types';

// Map GitHub Project color enum values to hex
const GITHUB_COLOR_HEX: Record<string, string> = {
  GREEN:  '#4ade80',
  YELLOW: '#facc15',
  ORANGE: '#fb923c',
  RED:    '#f87171',
  BLUE:   '#60a5fa',
  PURPLE: '#c084fc',
  PINK:   '#f472b6',
  GRAY:   '#9ca3af',
};

const CLOSED_COLOR  = '#4ade80';
const NO_STATUS_COLOR = '#e5e7eb';

function githubColorToHex(name: string): string {
  return GITHUB_COLOR_HEX[name.toUpperCase()] ?? NO_STATUS_COLOR;
}

interface Segment { label: string; count: number; color: string }

function buildSegments(
  issues: GitHubIssue[],
  kanbanIssueStatuses: Record<number, string>,
  kanbanStatusColors: Record<string, string>,
): Segment[] {
  const closed = issues.filter((i) => i.state === 'closed').length;
  const statusCounts: Record<string, number> = {};
  let noStatus = 0;

  issues.filter((i) => i.state === 'open').forEach((i) => {
    const s = kanbanIssueStatuses[i.number];
    if (s) statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    else noStatus++;
  });

  const segs: Segment[] = [];
  if (closed > 0)
    segs.push({ label: 'Closed', count: closed, color: CLOSED_COLOR });
  Object.entries(statusCounts).forEach(([label, count]) =>
    segs.push({ label, count, color: githubColorToHex(kanbanStatusColors[label] ?? '') }),
  );
  if (noStatus > 0)
    segs.push({ label: 'No status', count: noStatus, color: NO_STATUS_COLOR });
  return segs;
}

const SIZE = 39;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function DonutChart({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);

  if (total === 0) {
    return (
      <div
        style={{ width: SIZE, height: SIZE }}
        className="rounded-full border-2 border-dashed border-gray-200"
      />
    );
  }

  const allClosed = segments.length === 1 && segments[0].label === 'Closed';

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const length = (seg.count / total) * CIRCUMFERENCE;
    const dashoffset = -cumulative;
    cumulative += length;
    return { ...seg, length, dashoffset };
  });

  return (
    <svg width={SIZE} height={SIZE}>
      {!allClosed && (
        <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
      )}
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
          transform={`rotate(-90, ${CX}, ${CY})`}
        />
      ))}
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#6b7280"
        fontSize={9}
        fontFamily="sans-serif"
      >
        {total}
      </text>
    </svg>
  );
}

function RoadmapCell({
  issues,
  kanbanIssueStatuses,
  kanbanStatusColors,
}: {
  issues: GitHubIssue[];
  kanbanIssueStatuses: Record<number, string>;
  kanbanStatusColors: Record<string, string>;
}) {
  const segments = buildSegments(issues, kanbanIssueStatuses, kanbanStatusColors);
  const total = segments.reduce((s, seg) => s + seg.count, 0);

  function issueLabel(issue: GitHubIssue): { label: string; color: string } {
    if (issue.state === 'closed') return { label: 'Closed', color: CLOSED_COLOR };
    const s = kanbanIssueStatuses[issue.number];
    if (s) return { label: s, color: githubColorToHex(kanbanStatusColors[s] ?? '') };
    return { label: 'No status', color: NO_STATUS_COLOR };
  }

  return (
    <div className="relative group/cell flex items-center justify-center p-2 min-w-[52px] min-h-[52px]">
      <DonutChart segments={segments} />
      {total > 0 && (
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover/cell:opacity-100 transition-opacity max-w-xs">
          <div className="flex flex-col gap-1">
            {issues.map((issue) => {
              const { label, color } = issueLabel(issue);
              return (
                <span key={issue.number} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-gray-400 font-mono">#{issue.number}</span>
                  <span className="truncate max-w-[200px]">{issue.title}</span>
                  <span className="text-gray-500 ml-auto pl-2">{label}</span>
                </span>
              );
            })}
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
  const {
    issues, projects, milestones, projectIssues, layout,
    kanbanIssueStatuses, kanbanStatusColors, kanbanStatusColumns,
  } = useAppStore();

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
                  <RoadmapCell
                    issues={cellIssues(project.id, m.number)}
                    kanbanIssueStatuses={kanbanIssueStatuses}
                    kanbanStatusColors={kanbanStatusColors}
                  />
                </td>
              ))}
              <td className="border border-gray-200 bg-white p-0">
                <RoadmapCell
                  issues={cellIssues(project.id, null)}
                  kanbanIssueStatuses={kanbanIssueStatuses}
                  kanbanStatusColors={kanbanStatusColors}
                />
              </td>
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 z-10 bg-white border border-gray-200 px-4 py-2 text-xs font-normal italic text-gray-400 whitespace-nowrap">
              No User Activity
            </td>
            {cols.map((m) => (
              <td key={m.number} className="border border-gray-200 bg-white p-0">
                <RoadmapCell
                  issues={cellIssues(null, m.number)}
                  kanbanIssueStatuses={kanbanIssueStatuses}
                  kanbanStatusColors={kanbanStatusColors}
                />
              </td>
            ))}
            <td className="border border-gray-200 bg-white p-0">
              <RoadmapCell
                issues={cellIssues(null, null)}
                kanbanIssueStatuses={kanbanIssueStatuses}
                kanbanStatusColors={kanbanStatusColors}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 text-xs text-gray-500 border-t border-gray-100 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: CLOSED_COLOR }} />
          Closed
        </span>
        {kanbanStatusColumns.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: githubColorToHex(kanbanStatusColors[status] ?? '') }}
            />
            {status}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: NO_STATUS_COLOR }} />
          No status
        </span>
      </div>
    </div>
  );
}
