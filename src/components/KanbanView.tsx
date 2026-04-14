import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubMilestone } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';

function getStatusLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('s_'));
  return label ? label.name.slice(2) : null;
}

interface CellKey {
  milestoneNumber: number | null;
  statusLabel: string;
}

export default function KanbanView() {
  const { issues, milestones, statusLabels } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);

  // null sentinel = "No Milestone" swimlane
  const groups: (GitHubMilestone | null)[] = [...milestones, null];
  // '' sentinel = "No Status" column
  const cols = [...statusLabels, ''];

  function cellIssues(milestoneNumber: number | null, status: string): GitHubIssue[] {
    return issues.filter((issue) => {
      const mMatch = milestoneNumber === null
        ? issue.milestone === null
        : issue.milestone?.number === milestoneNumber;
      const sLabel = getStatusLabel(issue);
      const statusMatch = status === '' ? sLabel === null : sLabel === status;
      return mMatch && statusMatch;
    });
  }

  return (
    <>
      <div className="flex-1 overflow-auto h-full">
        <table className="border-collapse">
          <thead>
            <tr>
              {cols.map((status) => (
                <th
                  key={status || 'no-status'}
                  className="sticky top-0 z-20 bg-green-50 border border-gray-200 px-4 py-3 text-sm font-semibold text-green-900 text-center w-72 min-w-72 whitespace-nowrap"
                >
                  {status || <span className="text-green-400 font-normal italic">No Status</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((milestone) => (
              <>
                <tr key={`${milestone?.number ?? 'no-milestone'}-header`}>
                  <td
                    colSpan={cols.length}
                    className="sticky left-0 bg-purple-50 border border-gray-200 px-4 py-2 text-xs font-semibold text-purple-900 uppercase tracking-wide"
                  >
                    {milestone
                      ? milestone.title
                      : <span className="text-purple-400 font-normal italic normal-case tracking-normal">No Milestone</span>}
                  </td>
                </tr>

                <tr key={`${milestone?.number ?? 'no-milestone'}-cards`}>
                  {cols.map((status) => {
                    const milestoneNumber = milestone?.number ?? null;
                    const items = cellIssues(milestoneNumber, status);
                    return (
                      <td
                        key={status || 'no-status'}
                        className="border border-gray-200 align-top p-2 bg-white w-72 min-w-72"
                      >
                        <div className="flex flex-col gap-2 min-h-16">
                          {items.map((issue) => (
                            <IssueCard key={issue.number} issue={issue} hideLabels showStatus />
                          ))}
                          <button
                            onClick={() => setCreateCell({ milestoneNumber, statusLabel: status })}
                            className="mt-auto w-full text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg py-1.5 border border-dashed border-gray-200 hover:border-green-300 transition-colors flex items-center justify-center gap-1"
                          >
                            <span className="text-sm font-medium leading-none">+</span>
                            Add issue
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {createCell && (
        <CreateIssueModal
          defaultMilestoneNumber={createCell.milestoneNumber ?? undefined}
          defaultStatusLabel={createCell.statusLabel}
          onClose={() => setCreateCell(null)}
        />
      )}
    </>
  );
}
