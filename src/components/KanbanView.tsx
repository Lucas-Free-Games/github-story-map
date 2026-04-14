import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';

function getWaveLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('w_'));
  return label ? label.name.slice(2) : null;
}

function getStatusLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('s_'));
  return label ? label.name.slice(2) : null;
}

interface CellKey {
  waveLabel: string;
  statusLabel: string;
}

export default function KanbanView() {
  const { issues, waveLabels, statusLabels } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);

  const stories = issues;

  // '' sentinel = "No Status" / "No Wave"
  const cols = [...statusLabels, ''];
  const groups = [...waveLabels, ''];

  function cellIssues(wave: string, status: string): GitHubIssue[] {
    return stories.filter((issue) => {
      const iw = getWaveLabel(issue);
      const is = getStatusLabel(issue);
      const waveMatch = wave === '' ? iw === null : iw === wave;
      const statusMatch = status === '' ? is === null : is === status;
      return waveMatch && statusMatch;
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
            {groups.map((wave) => (
              <>
                {/* Swimlane header */}
                <tr key={`${wave || 'no-wave'}-header`}>
                  <td
                    colSpan={cols.length}
                    className="sticky left-0 bg-purple-50 border border-gray-200 px-4 py-2 text-xs font-semibold text-purple-900 uppercase tracking-wide"
                  >
                    {wave || <span className="text-purple-400 font-normal italic normal-case tracking-normal">No Wave</span>}
                  </td>
                </tr>

                {/* Cards row */}
                <tr key={`${wave || 'no-wave'}-cards`}>
                  {cols.map((status) => {
                    const items = cellIssues(wave, status);
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
                            onClick={() => setCreateCell({ waveLabel: wave, statusLabel: status })}
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
          defaultWaveLabel={createCell.waveLabel}
          defaultStatusLabel={createCell.statusLabel}
          onClose={() => setCreateCell(null)}
        />
      )}
    </>
  );
}
