import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { GitHubIssue, GitHubMilestone } from '../types';
import IssueReadModal from './IssueReadModal';

type Granularity = 'day' | 'week' | 'quarter' | 'year';

const TICK_WIDTH: Record<Granularity, number> = { day: 44, week: 160, quarter: 440, year: 90 };
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
  if (statusSortKey(status) === 2) return CLOSED_COLOR;
  return githubColorToHex(kanbanStatusColors[status] ?? '');
}

function issueStatusLabel(issue: GitHubIssue, kanbanStatuses: Record<number, string>): string {
  if (issue.state === 'closed') return 'Closed';
  return kanbanStatuses[issue.number] ?? issue.labels.find((l) => l.name.startsWith('s_'))?.name.slice(2) ?? 'No status';
}

function IssueDot({ issue, x, y, color, label, onClick }: { issue: GitHubIssue; x: number; y: number; color: string; label: string; onClick: () => void }) {
  return (
    <div className="absolute group" style={{ left: x, top: y }}>
      <div className="w-2.5 h-2.5 rounded-full -translate-x-[5px] cursor-pointer" style={{ background: color }} onClick={onClick} />
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-gray-400 font-mono">#{issue.number}</span>
          <span className="max-w-[220px] truncate">{issue.title}</span>
          <span className="text-gray-400 pl-2">{label}</span>
        </span>
      </div>
    </div>
  );
}

export default function TimelineView() {
  const { milestones, issues, layout, setWaveDate, timelineGranularity, setTimelineGranularity, timelineShowIssues, toggleTimelineShowIssues, kanbanIssueStatuses, kanbanStatusColumns, kanbanStatusColors } = useAppStore();

  const g = timelineGranularity;
  const tw = TICK_WIDTH[g];

  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [localDates, setLocalDates] = useState<Record<number, { start: string; end: string }>>({});
  const localDatesRef = useRef<Record<number, { start: string; end: string }>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isFirstScroll = useRef(true);
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
    const sixMonths = 6 * 30 * 86400_000;
    const rangeStart = floorToGranularity(new Date(minMs - sixMonths), g);
    const padEnd = addTick(floorToGranularity(new Date(maxMs + sixMonths), g), g);
    const t = generateTicks(rangeStart, padEnd, g);
    return { ticks: t, totalWidth: t.length * tw };
  }, [ordered, effectiveDates, issues, g, tw]);

  const dToX = (d: Date) => dateToX(d, ticks, tw);
  const xToD = (x: number) => xToDate(x, ticks, tw);

  useEffect(() => {
    if (dragRef.current) return;
    const container = scrollContainerRef.current;
    if (!container || !ticks.length) return;
    const todayXValue = dateToX(new Date(), ticks, tw);
    const containerWidth = container.clientWidth;
    const targetLeft = Math.max(0, LABEL_WIDTH + todayXValue - containerWidth / 2);
    container.scrollTo({ left: targetLeft, behavior: isFirstScroll.current ? 'instant' : 'smooth' });
    isFirstScroll.current = false;
  }, [ticks, tw]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <>
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
        <button
          onClick={toggleTimelineShowIssues}
          className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs transition-colors ${
            timelineShowIssues
              ? 'bg-gray-100 border-gray-300 text-gray-700 font-medium'
              : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
          }`}
        >
          {timelineShowIssues ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
            </svg>
          )}
          Issues
        </button>

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
          {!kanbanStatusColumns.some((s) => statusSortKey(s) === 2) && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: CLOSED_COLOR }} />
              Closed
            </span>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto" style={{ minWidth: 0 }}>
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
                {timelineShowIssues && closedIssues.map((issue) => (
                  <IssueDot
                    key={issue.number}
                    issue={issue}
                    x={dToX(new Date(issue.closed_at!))}
                    y={ROW_HEIGHT - 22}
                    color={CLOSED_COLOR}
                    label="Closed"
                    onClick={() => setSelectedIssue(issue)}
                  />
                ))}
                {timelineShowIssues && openIssues.map((issue, idx) => (
                  <IssueDot
                    key={issue.number}
                    issue={issue}
                    x={openDotX + idx * 2}
                    y={ROW_HEIGHT - 22}
                    color={issueStatusColor(issue, kanbanIssueStatuses, kanbanStatusColors)}
                    label={issueStatusLabel(issue, kanbanIssueStatuses)}
                    onClick={() => setSelectedIssue(issue)}
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
              {timelineShowIssues && noWaveIssues.map((issue) => (
                <IssueDot
                  key={issue.number}
                  issue={issue}
                  x={dToX(new Date(issue.closed_at!))}
                  y={ROW_HEIGHT - 22}
                  color={CLOSED_COLOR}
                  label="Closed"
                  onClick={() => setSelectedIssue(issue)}
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
    {selectedIssue && <IssueReadModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />}
    </>
  );
}
