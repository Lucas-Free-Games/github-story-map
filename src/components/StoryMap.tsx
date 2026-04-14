import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue } from '../types';
import IssueCard from './IssueCard';
import CreateIssueModal from './CreateIssueModal';

function getWaveLabel(issue: GitHubIssue): string | null {
  const label = issue.labels.find((l) => l.name.startsWith('w_'));
  return label ? label.name.slice(2) : null;
}

interface CellKey {
  projectId: string;
  waveLabel: string;
}

export default function StoryMap() {
  const { issues, projects, projectIssues, waveLabels } = useAppStore();
  const [createCell, setCreateCell] = useState<CellKey | null>(null);

  const cols = projects.filter((p) => !p.closed);
  const rows = [...waveLabels, ''];

  function cellIssues(projectId: string, wave: string): GitHubIssue[] {
    const inProject = new Set(projectIssues[projectId] ?? []);
    return issues.filter((issue) => {
      const iw = getWaveLabel(issue);
      const waveMatch = wave === '' ? iw === null : iw === wave;
      return inProject.has(issue.number) && waveMatch;
    });
  }

  if (cols.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No projects found. Use{' '}
        <span className="font-mono mx-1 bg-gray-100 px-1 rounded">Projects</span>
        {' '}to create one.
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
              {cols.map((project) => (
                <th
                  key={project.id}
                  className="sticky top-0 z-20 bg-blue-50 border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-900 text-center w-72 min-w-72 whitespace-nowrap"
                >
                  {project.title}
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
                {cols.map((project) => {
                  const items = cellIssues(project.id, wave);
                  return (
                    <td
                      key={project.id}
                      className="border border-gray-200 align-top p-2 bg-white w-72 min-w-72"
                    >
                      <div className="flex flex-col gap-2 min-h-16">
                        {items.map((issue) => (
                          <IssueCard key={issue.number} issue={issue} hideLabels showStatus />
                        ))}
                        <button
                          onClick={() => setCreateCell({ projectId: project.id, waveLabel: wave })}
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
          defaultProjectId={createCell.projectId}
          defaultWaveLabel={createCell.waveLabel}
          onClose={() => setCreateCell(null)}
        />
      )}
    </>
  );
}
