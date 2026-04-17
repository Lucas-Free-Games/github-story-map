import { useCallback } from 'react';

const MIN_COLUMN_WIDTH = 120;
const MAX_COLUMN_WIDTH = 600;

interface ResizeHandleProps {
  /** Unique key identifying this column in the columnWidths store. */
  columnKey: string;
  /** The column's current width in pixels. */
  currentWidth: number;
  /** Called continuously while dragging with the new clamped width. */
  onResize: (key: string, width: number) => void;
}

/**
 * Drag handle rendered at the right edge of a column header.
 * The parent element must have `position: relative` (Tailwind: `relative`).
 *
 * Min width: 120 px  |  Max width: 600 px
 */
export default function ResizeHandle({ columnKey, currentWidth, onResize }: ResizeHandleProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Prevent the column drag-and-drop (e.g. @hello-pangea/dnd) from activating.
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = currentWidth;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(
          MAX_COLUMN_WIDTH,
          Math.max(MIN_COLUMN_WIDTH, startWidth + delta),
        );
        onResize(columnKey, newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [columnKey, currentWidth, onResize],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute top-0 right-0 h-full w-2 cursor-col-resize flex items-center justify-center group/resize"
      title="Drag to resize column"
    >
      <div className="w-px h-4 bg-gray-300 group-hover/resize:bg-blue-400 rounded-full transition-colors" />
    </div>
  );
}
