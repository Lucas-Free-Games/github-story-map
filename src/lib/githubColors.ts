import type { CSSProperties } from 'react';

export const GH_COLOR_STYLE: Record<string, [string, string, string]> = {
  GRAY:   ['#f9fafb', '#6b7280', '#e5e7eb'],
  BLUE:   ['#eff6ff', '#2563eb', '#bfdbfe'],
  GREEN:  ['#f0fdf4', '#16a34a', '#bbf7d0'],
  YELLOW: ['#fefce8', '#854d0e', '#fde047'],
  ORANGE: ['#fff7ed', '#c2410c', '#fed7aa'],
  RED:    ['#fef2f2', '#dc2626', '#fecaca'],
  PINK:   ['#fdf2f8', '#be185d', '#fbcfe8'],
  PURPLE: ['#faf5ff', '#7e22ce', '#e9d5ff'],
};

export function ghStyle(color: string): CSSProperties {
  const [bg, text, border] = GH_COLOR_STYLE[color] ?? GH_COLOR_STYLE.GRAY;
  return { backgroundColor: bg, color: text, border: `1px solid ${border}` };
}

export const GITHUB_COLOR_HEX: Record<string, string> = {
  GREEN:  '#4ade80',
  YELLOW: '#facc15',
  ORANGE: '#fb923c',
  RED:    '#f87171',
  BLUE:   '#60a5fa',
  PURPLE: '#c084fc',
  PINK:   '#f472b6',
  GRAY:   '#9ca3af',
};

export const CLOSED_COLOR = '#c084fc';
export const NO_STATUS_COLOR = '#e5e7eb';

export function githubColorToHex(name: string): string {
  return GITHUB_COLOR_HEX[name.toUpperCase()] ?? NO_STATUS_COLOR;
}
