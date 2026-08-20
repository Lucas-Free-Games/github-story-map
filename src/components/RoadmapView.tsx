import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubProject, GitHubMilestone } from '../types';
import { githubColorToHex, CLOSED_COLOR, NO_STATUS_COLOR } from '../lib/githubColors';

type CellMode = 'donut' | 'dots';

function statusSortKey(name: string): number {
  const n = name.toLowerCase().trim();
  if (n === 'to do' || n === 'todo') return 0;
  if (n.includes('progress')) return 1;
  if (n === 'done') return 2;
  return 3;
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
  Object.entries(statusCounts)
    .sort(([a], [b]) => statusSortKey(a) - statusSortKey(b))
    .forEach(([label, count]) =>
      segs.push({ label, count, color: githubColorToHex(kanbanStatusColors[label] ?? '') }),
    );
  if (closed > 0)
    segs.push({ label: 'Done', count: closed, color: CLOSED_COLOR });
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
  mode,
}: {
  issues: GitHubIssue[];
  kanbanIssueStatuses: Record<number, string>;
  kanbanStatusColors: Record<string, string>;
  mode: CellMode;
}) {
  const segments = buildSegments(issues, kanbanIssueStatuses, kanbanStatusColors);
  const total = segments.reduce((s, seg) => s + seg.count, 0);

  function issueLabel(issue: GitHubIssue): { label: string; color: string } {
    if (issue.state === 'closed') return { label: 'Closed', color: CLOSED_COLOR };
    const s = kanbanIssueStatuses[issue.number];
    if (s) return { label: s, color: githubColorToHex(kanbanStatusColors[s] ?? '') };
    return { label: 'No status', color: NO_STATUS_COLOR };
  }

  const tooltip = total > 0 && (
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
  );

  return (
    <div className="relative group/cell p-2 min-w-[52px] min-h-[52px] flex flex-wrap gap-1 content-start">
      {issues.map((issue) => {
        const { color } = issueLabel(issue);
        return (
          <span
            key={issue.number}
            className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${mode === 'donut' ? 'opacity-0' : ''}`}
            style={{ background: color }}
          />
        );
      })}
      {mode === 'donut' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <DonutChart segments={segments} />
        </div>
      )}
      {tooltip}
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
    issues, projects, milestones, projectIssues, layout, linkedProjectIds,
    kanbanIssueStatuses, kanbanStatusColors, kanbanStatusColumns,
  } = useAppStore();

  const [cellMode, setCellMode] = useState<CellMode>('donut');

  const rows = sortedProjects(projects, layout.userActivityOrder).filter((p) =>
    linkedProjectIds.includes(p.id),
  );
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
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 flex-wrap">
        <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
          <button
            className={`px-3 py-1 transition-colors ${cellMode === 'donut' ? 'bg-gray-100 font-medium text-gray-800' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            onClick={() => setCellMode('donut')}
          >
            Donut
          </button>
          <button
            className={`px-3 py-1 border-l border-gray-200 transition-colors ${cellMode === 'dots' ? 'bg-gray-100 font-medium text-gray-800' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            onClick={() => setCellMode('dots')}
          >
            Dots
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          {[...kanbanStatusColumns]
            .sort((a, b) => statusSortKey(a) - statusSortKey(b))
            .map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: statusSortKey(status) === 2 ? CLOSED_COLOR : githubColorToHex(kanbanStatusColors[status] ?? '') }}
                />
                {status}
              </span>
            ))}
        </div>
      </div>
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
                    mode={cellMode}
                  />
                </td>
              ))}
              <td className="border border-gray-200 bg-white p-0">
                <RoadmapCell
                  issues={cellIssues(project.id, null)}
                  kanbanIssueStatuses={kanbanIssueStatuses}
                  kanbanStatusColors={kanbanStatusColors}
                  mode={cellMode}
                />
              </td>
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 z-10 bg-white border border-gray-200 px-4 py-2 text-xs font-normal italic text-gray-400 whitespace-nowrap">
            </td>
            {cols.map((m) => (
              <td key={m.number} className="border border-gray-200 bg-white p-0">
                <RoadmapCell
                  issues={cellIssues(null, m.number)}
                  kanbanIssueStatuses={kanbanIssueStatuses}
                  kanbanStatusColors={kanbanStatusColors}
                  mode={cellMode}
                />
              </td>
            ))}
            <td className="border border-gray-200 bg-white p-0">
              <RoadmapCell
                issues={cellIssues(null, null)}
                kanbanIssueStatuses={kanbanIssueStatuses}
                kanbanStatusColors={kanbanStatusColors}
                mode={cellMode}
              />
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  );
}
