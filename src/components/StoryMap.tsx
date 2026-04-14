import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue } from '../types';
import EpicColumn from './EpicColumn';

export default function StoryMap() {
  const { issues, layout, moveStory, reorderEpics } = useAppStore();

  const issueMap = new Map<number, GitHubIssue>(issues.map((i) => [i.number, i]));

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    if (type === 'epic') {
      reorderEpics(source.index, destination.index);
      return;
    }

    const storyNumber = parseInt(draggableId, 10);
    moveStory(storyNumber, source.droppableId, destination.droppableId, destination.index);
  }

  const epicColumns = layout.epicOrder.map((epicNum) => {
    const epicIssue = issueMap.get(epicNum) ?? null;
    const stories = (layout.storyOrder[String(epicNum)] ?? [])
      .map((n) => issueMap.get(n))
      .filter((i): i is GitHubIssue => i !== undefined);
    return { epicNum, epicIssue, stories };
  });

  const backlogStories = (layout.storyOrder['backlog'] ?? [])
    .map((n) => issueMap.get(n))
    .filter((i): i is GitHubIssue => i !== undefined);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full overflow-hidden">
        {/* Epics area — horizontally scrollable */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          <Droppable droppableId="epics-row" direction="horizontal" type="epic">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex gap-4 items-start min-w-max pb-4"
              >
                {epicColumns.map(({ epicNum, epicIssue, stories }, index) => (
                  <EpicColumn
                    key={epicNum}
                    epicIssue={epicIssue}
                    columnKey={String(epicNum)}
                    stories={stories}
                    index={index}
                  />
                ))}
                {provided.placeholder}

                {epicColumns.length === 0 && (
                  <div className="flex items-center justify-center w-72 h-48 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 text-sm">
                    No epics found. Label issues with <span className="font-mono mx-1">epic</span> to create columns.
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </div>

        {/* Backlog sidebar */}
        <div className="w-72 border-l border-gray-200 overflow-y-auto p-4 shrink-0 bg-gray-50">
          <EpicColumn
            epicIssue={null}
            columnKey="backlog"
            stories={backlogStories}
            index={0}
            isBacklog
          />
        </div>
      </div>
    </DragDropContext>
  );
}
