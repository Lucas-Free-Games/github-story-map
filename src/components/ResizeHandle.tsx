import { useRef } from 'react';

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;

interface ResizeHandleProps {
  /** Unique key used to store this column's width in the Zustand store. */
  colKey: string;
  /** The column's current width in pixels. */
  currentWidth: number;
  /** Called continuously while the user drags. */
  onResize: (key: string, width: number) => void;
  /** Accent colour for the handle indicator bar. */
  color?: 'blue' | 'green';
}

/**
 * An absolutely-positioned drag handle that sits on the right edge of a table
 * header cell. The parent <th> must have `position: relative` (add the
 * `relative` Tailwind class).
 *
 * Dragging updates the column width in real-time and enforces MIN/MAX bounds.
 * `e.stopPropagation()` prevents @hello-pangea/dnd column-drag from firing
 * while the user is resizing.
 */
export default function ResizeHandle({
  colKey,
  currentWidth,
  onResize,
  color = 'blue',
}: ResizeHandleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const barHover =
    color === 'green'
      ? 'group-hover/resize:bg-green-500'
      : 'group-hover/resize:bg-blue-500';
  const bgHover =
    color === 'green'
      ? 'hover:bg-green-200/40'
      : 'hover:bg-blue-200/40';

  function handleMouseDown(e: React.MouseEvent) {
    // Prevent @hello-pangea/dnd from starting a column drag
    e.stopPropagation();
    e.preventDefault();

    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;

    function onMouseMove(mv: MouseEvent) {
      const delta = mv.clientX - startXRef.current;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      onResize(colKey, next);
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      title="Drag to resize column"
      className={`absolute top-0 right-0 h-full w-2 cursor-col-resize group/resize flex items-center justify-center z-20 select-none ${bgHover} transition-colors`}
    >
      {/* Visual bar — visible only on hover */}
      <div
        className={`w-0.5 h-5 bg-gray-300 ${barHover} rounded-full opacity-0 group-hover/resize:opacity-100 transition-all duration-150`}
      />
    </div>
  );
}
