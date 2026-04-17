import { useRef, useCallback, forwardRef } from 'react';

export const GRID_DEFAULT_WIDTH = 200;
export const KANBAN_DEFAULT_WIDTH = 280;
export const MIN_COL_WIDTH = 100;
export const MAX_COL_WIDTH = 600;

interface ResizableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Unique key used to look up / persist the width for this column. */
  columnKey: string;
  /** Current column width in pixels. */
  width: number;
  /** Called on every mouse-move during a resize drag with (columnKey, newWidth). */
  onResize: (key: string, width: number) => void;
  /** Colour theme of the visual handle indicator. */
  handleVariant?: 'blue' | 'green';
}

/**
 * A `<th>` wrapper that renders a draggable resize handle on its right edge.
 *
 * Supports React `forwardRef` so it works seamlessly inside
 * `@hello-pangea/dnd` Draggable render props that require `provided.innerRef`.
 *
 * The resize handle calls `e.stopPropagation()` on `mousedown` so that it
 * does NOT accidentally trigger a DnD column-reorder drag.
 */
const ResizableHeader = forwardRef<HTMLTableCellElement, ResizableHeaderProps>(
  function ResizableHeader(
    { columnKey, width, onResize, handleVariant = 'blue', style, className, children, ...rest },
    ref,
  ) {
    const startXRef = useRef<number>(0);
    const startWidthRef = useRef<number>(width);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent the parent DnD drag-handle from starting a column-reorder drag.
        e.preventDefault();
        e.stopPropagation();

        startXRef.current = e.clientX;
        startWidthRef.current = width;

        const onMouseMove = (ev: MouseEvent) => {
          const delta = ev.clientX - startXRef.current;
          const newWidth = Math.min(
            MAX_COL_WIDTH,
            Math.max(MIN_COL_WIDTH, startWidthRef.current + delta),
          );
          onResize(columnKey, newWidth);
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };

        // Override cursor and text-selection for the whole page while dragging.
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [columnKey, width, onResize],
    );

    const indicatorCls =
      handleVariant === 'green'
        ? 'group-hover/colresize:bg-green-400'
        : 'group-hover/colresize:bg-blue-400';

    return (
      <th
        ref={ref}
        {...rest}
        // Width is set via inline style so it overrides class-based constraints.
        // The DnD style prop (transform, etc.) is merged last so it is not lost.
        style={{ width, minWidth: width, maxWidth: width, ...style }}
        className={`relative group/colresize ${className ?? ''}`}
      >
        {children}

        {/* Drag-to-resize handle — pinned to the right edge of the header */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-10 flex items-center justify-center select-none"
          aria-hidden="true"
        >
          {/* Visual indicator bar — fades in when the header is hovered */}
          <div
            className={`w-px h-5 rounded transition-colors duration-150 bg-transparent ${indicatorCls}`}
          />
        </div>
      </th>
    );
  },
);

export default ResizableHeader;
