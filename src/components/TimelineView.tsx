import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubMilestone } from '../types';

type Granularity = 'day' | 'week' | 'quarter' | 'year';

const TICK_WIDTH: Record<Granularity, number> = { day: 44, week: 80, quarter: 110, year: 90 };
const LABEL_WIDTH = 160;
const ROW_HEIGHT = 72;
const HEADER_HEIGHT = 40;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function floorToGranularity(d: Date, g: Granularity): Date {
  switch (g) {
    case 'day':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    case 'week': {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dow = day.getDay();
      day.setDate(day.getDate() - (dow === 0 ? 6 : dow - 1));
      return day;
    }
    case 'quarter':
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    case 'year':
      return new Date(d.getFullYear(), 0, 1);
  }
}

function addTick(d: Date, g: Granularity): Date {
  const r = new Date(d);
  if (g === 'day') r.setDate(r.getDate() + 1);
  else if (g === 'week') r.setDate(r.getDate() + 7);
  else if (g === 'quarter') r.setMonth(r.getMonth() + 3);
  else r.setFullYear(r.getFullYear() + 1);
  return r;
}

function tickLabel(d: Date, g: Granularity): string {
  if (g === 'day') return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (g === 'week') return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (g === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(-2)}`;
  return String(d.getFullYear());
}

function generateTicks(start: Date, end: Date, g: Granularity): Date[] {
  const ticks: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    ticks.push(new Date(cur));
    cur = addTick(cur, g);
  }
  return ticks;
}

function dateToX(date: Date, ticks: Date[], tw: number): number {
  if (ticks.length === 0) return 0;
  const ms = date.getTime();
  for (let i = 0; i < ticks.length - 1; i++) {
    const t0 = ticks[i].getTime();
    const t1 = ticks[i + 1].getTime();
    if (ms >= t0 && ms < t1) return (i + (ms - t0) / (t1 - t0)) * tw;
  }
  if (ms < ticks[0].getTime()) return 0;
  return ticks.length * tw;
}

function xToDate(x: number, ticks: Date[], tw: number): Date {
  if (ticks.length === 0) return new Date();
  const idx = x / tw;
  const i = Math.floor(idx);
  const frac = idx - i;
  if (i < 0) return ticks[0];
  if (i >= ticks.length - 1) return ticks[ticks.length - 1];
  return new Date(ticks[i].getTime() + frac * (ticks[i + 1].getTime() - ticks[i].getTime()));
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fallbackDates(m: GitHubMilestone, issues: GitHubIssue[]): { start: string; end: string } {
  const closed = issues.filter(
    (i) => i.milestone?.number === m.number && i.state === 'closed' && i.closed_at,
  );
  if (closed.length > 0) {
    const ms = closed.map((i) => new Date(i.closed_at!).getTime());
    const s = new Date(Math.min(...ms));
    const e = new Date(Math.max(...ms) + 7 * 86400_000);
    return { start: toISODate(s), end: toISODate(e) };
  }
  if (m.due_on) {
    const due = new Date(m.due_on);
    return { start: toISODate(new Date(due.getTime() - 30 * 86400_000)), end: toISODate(due) };
  }
  const now = new Date();
  return { start: toISODate(now), end: toISODate(new Date(now.getTime() + 30 * 86400_000)) };
}

function sortedMilestones(milestones: GitHubMilestone[], order: number[]): GitHubMilestone[] {
  return [...milestones].sort((a, b) => {
    const ai = order.indexOf(a.number), bi = order.indexOf(b.number);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const GITHUB_COLOR_HEX: Record<string, string> = {
  GREEN: '#4ade80', YELLOW: '#facc15', ORANGE: '#fb923c', RED: '#f87171',
  BLUE: '#60a5fa', PURPLE: '#c084fc', PINK: '#f472b6', GRAY: '#9ca3af',
};
const CLOSED_COLOR = '#c084fc';
const NO_STATUS_COLOR = '#e5e7eb';

function githubColorToHex(name: string): string {
  return GITHUB_COLOR_HEX[name.toUpperCase()] ?? NO_STATUS_COLOR;
}

function statusSortKey(name: string): number {
  const n = name.toLowerCase().trim();
  if (n === 'to do' || n === 'todo') return 0;
  if (n.includes('progress')) return 1;
  if (n === 'done') return 2;
  return 3;
}

function issueStatusColor(issue: GitHubIssue, kanbanStatuses: Record<number, string>, kanbanStatusColors: Record<string, string>): string {
  if (issue.state === 'closed') return CLOSED_COLOR;
  const status = kanbanStatuses[issue.number] ?? issue.labels.find((l) => l.name.startsWith('s_'))?.name.slice(2);
  if (!status) return NO_STATUS_COLOR;
  return githubColorToHex(kanbanStatusColors[status] ?? '');
}

export default function TimelineView() {
  const { milestones, issues, layout, setWaveDate, timelineGranularity, setTimelineGranularity, kanbanIssueStatuses, kanbanStatusColumns, kanbanStatusColors } = useAppStore();

  const g = timelineGranularity;
  const tw = TICK_WIDTH[g];

  const [localDates, setLocalDates] = useState<Record<number, { start: string; end: string }>>({});
  const localDatesRef = useRef<Record<number, { start: string; end: string }>>({});
  const dragRef = useRef<{
    milestoneNumber: number;
    edge: 'start' | 'end';
    startMouseX: number;
    origX: number;
  } | null>(null);

  const ordered = useMemo(
    () => sortedMilestones(milestones, layout.milestoneOrder ?? []),
    [milestones, layout.milestoneOrder],
  );

  const effectiveDates = useMemo(() => {
    const map: Record<number, { start: string; end: string }> = {};
    for (const m of ordered) {
      map[m.number] =
        localDates[m.number] ??
        layout.waveDates?.[m.number] ??
        fallbackDates(m, issues);
    }
    return map;
  }, [ordered, localDates, layout.waveDates, issues]);

  const { ticks, totalWidth } = useMemo(() => {
    const allMs: number[] = [];
    for (const m of ordered) {
      const d = effectiveDates[m.number];
      if (d) { allMs.push(new Date(d.start).getTime(), new Date(d.end).getTime()); }
    }
    issues.filter((i) => i.state === 'closed' && i.closed_at).forEach((i) =>
      allMs.push(new Date(i.closed_at!).getTime()),
    );
    const now = Date.now();
    const minMs = allMs.length ? Math.min(...allMs) : now - 30 * 86400_000;
    const maxMs = allMs.length ? Math.max(...allMs) : now + 30 * 86400_000;
    const rangeStart = floorToGranularity(new Date(minMs), g);
    const padEnd = addTick(floorToGranularity(new Date(maxMs), g), g);
    const t = generateTicks(rangeStart, padEnd, g);
    return { ticks: t, totalWidth: t.length * tw };
  }, [ordered, effectiveDates, issues, g, tw]);

  const dToX = (d: Date) => dateToX(d, ticks, tw);
  const xToD = (x: number) => xToDate(x, ticks, tw);

  function startEdgeDrag(e: React.MouseEvent, m: GitHubMilestone, edge: 'start' | 'end') {
    e.preventDefault();
    const dates = effectiveDates[m.number];
    const origDate = edge === 'start' ? new Date(dates.start) : new Date(dates.end);
    dragRef.current = { milestoneNumber: m.number, edge, startMouseX: e.clientX, origX: dToX(origDate) };

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const newX = Math.max(0, drag.origX + (ev.clientX - drag.startMouseX));
      const dateStr = toISODate(xToD(newX));
      const curr = localDatesRef.current[drag.milestoneNumber] ?? effectiveDates[drag.milestoneNumber];
      const next = drag.edge === 'start'
        ? { start: dateStr, end: curr.end }
        : { start: curr.start, end: dateStr };
      localDatesRef.current = { ...localDatesRef.current, [drag.milestoneNumber]: next };
      setLocalDates({ ...localDatesRef.current });
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (drag) {
        const entry = localDatesRef.current[drag.milestoneNumber];
        if (entry) {
          setWaveDate(drag.milestoneNumber, entry.start, entry.end);
          const rest = { ...localDatesRef.current };
          delete rest[drag.milestoneNumber];
          localDatesRef.current = rest;
          setLocalDates(rest);
        }
      }
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const noWaveIssues = issues.filter((i) => !i.milestone && i.state === 'closed' && i.closed_at);
  const todayX = ticks.length ? dToX(new Date()) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full" style={{ minWidth: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 shrink-0 flex-wrap">
        <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
          {(['day', 'week', 'quarter', 'year'] as const).map((opt, i) => (
            <button
              key={opt}
              onClick={() => setTimelineGranularity(opt)}
              className={`px-3 py-1 capitalize transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${
                timelineGranularity === opt ? 'bg-gray-100 font-medium text-gray-800' : 'bg-white text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          {[...kanbanStatusColumns]
            .sort((a, b) => statusSortKey(a) - statusSortKey(b))
            .map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: githubColorToHex(kanbanStatusColors[status] ?? '') }}
                />
                {status}
              </span>
            ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: CLOSED_COLOR }} />
            Closed
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto" style={{ minWidth: 0 }}>
      <div style={{ minWidth: LABEL_WIDTH + totalWidth }}>

        {/* Time axis header */}
        <div
          className="sticky top-0 z-20 bg-white border-b border-gray-200 flex"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="sticky left-0 z-30 bg-white border-r border-gray-200 shrink-0"
            style={{ width: LABEL_WIDTH }}
          />
          <div className="relative shrink-0" style={{ width: totalWidth }}>
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-r border-gray-100 flex items-center justify-center text-xs text-gray-400 select-none"
                style={{ left: i * tw, width: tw }}
              >
                {tickLabel(tick, g)}
              </div>
            ))}
            {todayX !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-300 pointer-events-none"
                style={{ left: todayX }}
              />
            )}
          </div>
        </div>

        {/* Wave rows */}
        {ordered.map((m) => {
          const dates = effectiveDates[m.number];
          const startX = dToX(new Date(dates.start));
          const endX = dToX(new Date(dates.end));
          const barWidth = Math.max(0, endX - startX);
          const waveIssues = issues.filter((i) => i.milestone?.number === m.number);
          const closedIssues = waveIssues.filter((i) => i.state === 'closed' && i.closed_at);
          const openIssues = waveIssues.filter((i) => i.state === 'open');
          const todayMs = Date.now();
          const waveStartMs = new Date(dates.start).getTime();
          const waveEndMs = new Date(dates.end).getTime();
          const openDotX = dToX(new Date(Math.min(Math.max(todayMs, waveStartMs), waveEndMs)));
          return (
            <div key={m.number} className="flex border-b border-gray-100" style={{ height: ROW_HEIGHT }}>
              <div
                className="sticky left-0 z-10 bg-white border-r border-gray-200 shrink-0 flex items-start pt-2 px-3 text-sm font-medium text-purple-900"
                style={{ width: LABEL_WIDTH }}
              >
                <span className="truncate">{m.title}</span>
              </div>
              <div className="relative shrink-0" style={{ width: totalWidth }}>
                {/* Grid lines */}
                {ticks.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-r border-gray-50"
                    style={{ left: i * tw }}
                  />
                ))}
                {/* Today line */}
                {todayX !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-200 pointer-events-none"
                    style={{ left: todayX }}
                  />
                )}
                {/* Wave bar */}
                {barWidth > 0 && (
                  <div
                    className="absolute rounded-md bg-purple-200 select-none"
                    style={{ left: startX, width: barWidth, top: 6, height: 24 }}
                  >
                    {/* Left resize handle */}
                    <div
                      className="absolute left-0 top-0 w-3 h-full cursor-w-resize rounded-l-md hover:bg-purple-400/30 z-10"
                      onMouseDown={(e) => startEdgeDrag(e, m, 'start')}
                    />
                    {/* Label */}
                    <div className="absolute inset-0 flex items-center justify-start text-xs text-purple-700 font-medium pointer-events-none overflow-hidden px-3">
                      {m.title}
                    </div>
                    {/* Right resize handle */}
                    <div
                      className="absolute right-0 top-0 w-3 h-full cursor-e-resize rounded-r-md hover:bg-purple-400/30 z-10"
                      onMouseDown={(e) => startEdgeDrag(e, m, 'end')}
                    />
                  </div>
                )}
                {/* Issue dots */}
                {closedIssues.map((issue) => (
                  <div
                    key={issue.number}
                    className="absolute w-2.5 h-2.5 rounded-full -translate-x-[5px] cursor-pointer"
                    style={{ left: dToX(new Date(issue.closed_at!)), top: ROW_HEIGHT - 22, background: CLOSED_COLOR }}
                    title={`#${issue.number}: ${issue.title}`}
                  />
                ))}
                {openIssues.map((issue, idx) => (
                  <div
                    key={issue.number}
                    className="absolute w-2.5 h-2.5 rounded-full -translate-x-[5px] cursor-pointer"
                    style={{ left: openDotX + idx * 2, top: ROW_HEIGHT - 22, background: issueStatusColor(issue, kanbanIssueStatuses, kanbanStatusColors) }}
                    title={`#${issue.number}: ${issue.title}`}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* No Wave row */}
        {noWaveIssues.length > 0 && (
          <div className="flex border-b border-gray-100" style={{ height: ROW_HEIGHT }}>
            <div
              className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 shrink-0 flex items-center px-3 text-sm italic text-gray-400"
              style={{ width: LABEL_WIDTH }}
            >
              No Wave
            </div>
            <div className="relative shrink-0" style={{ width: totalWidth }}>
              {ticks.map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-r border-gray-50" style={{ left: i * tw }} />
              ))}
              {todayX !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-red-200 pointer-events-none" style={{ left: todayX }} />
              )}
              {noWaveIssues.map((issue) => (
                <div
                  key={issue.number}
                  className="absolute w-2.5 h-2.5 rounded-full bg-gray-400 -translate-x-[5px] cursor-pointer hover:bg-gray-600 transition-colors"
                  style={{ left: dToX(new Date(issue.closed_at!)), top: ROW_HEIGHT - 22 }}
                  title={`#${issue.number}: ${issue.title}`}
                />
              ))}
            </div>
          </div>
        )}

        {ordered.length === 0 && noWaveIssues.length === 0 && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            No waves or closed issues to display.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
