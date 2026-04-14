import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';

function isEpic(issue: GitHubIssue): boolean {
  return issue.labels.some((l) => l.name.toLowerCase() === 'epic');
}

function getEpicLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('e_'));
  return label ? label.name.slice(2) : null;
}

function getWaveLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('w_'));
  return label ? label.name.slice(2) : null;
}

interface CellKey {
  epicLabel: string;
  waveLabel: string;
}

export default function StoryMap() {
  const { issues, epicLabels, waveLabels } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);

  const stories = issues.filter((i) => !isEpic(i));

  function cellIssues(epic: string, wave: string): GitHubIssue[] {
    return stories.filter((issue) => {
      const ie = getEpicLabel(issue);
      const iw = getWaveLabel(issue);
      const epicMatch = epic === '' ? ie === null : ie === epic;
      const waveMatch = wave === '' ? iw === null : iw === wave;
      return epicMatch && waveMatch;
    });
  }

  // '' sentinel = "No Wave" row / "No Epic" column
  const cols = epicLabels;
  const rows = [...waveLabels, ''];

  if (cols.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No epic labels defined. Use{' '}
        <span className="font-mono mx-1 bg-gray-100 px-1 rounded">Epics &amp; Waves</span>
        {' '}to add labels.
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto h-full">
        <table className="border-collapse">
          <thead>
            <tr>
              {/* Corner */}
              <th className="sticky left-0 top-0 z-30 bg-white border border-gray-200 w-36 min-w-36" />
              {cols.map((epic) => (
                <th
                  key={epic}
                  className="sticky top-0 z-20 bg-blue-50 border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-900 text-center w-72 min-w-72 whitespace-nowrap"
                >
                  {epic}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((wave) => (
              <tr key={wave || 'no-wave'}>
                {/* Wave row header */}
                <th className="sticky left-0 z-10 bg-purple-50 border border-gray-200 px-3 py-2 text-xs font-semibold text-purple-900 text-right whitespace-nowrap align-top pt-3">
                  {wave || <span className="text-purple-400 font-normal italic">No Wave</span>}
                </th>
                {cols.map((epic) => {
                  const items = cellIssues(epic, wave);
                  return (
                    <td
                      key={epic}
                      className="border border-gray-200 align-top p-2 bg-white w-72 min-w-72"
                    >
                      <div className="flex flex-col gap-2 min-h-16">
                        {items.map((issue) => (
                          <IssueCard key={issue.number} issue={issue} />
                        ))}
                        <button
                          onClick={() => setCreateCell({ epicLabel: epic, waveLabel: wave })}
                          className="mt-auto w-full text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg py-1.5 border border-dashed border-gray-200 hover:border-blue-300 transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="text-sm font-medium leading-none">+</span>
                          Add issue
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createCell && (
        <CreateIssueModal
          defaultEpicLabel={createCell.epicLabel}
          defaultWaveLabel={createCell.waveLabel}
          onClose={() => setCreateCell(null)}
        />
      )}
    </>
  );
}
