import { getFirebaseIdToken } from './auth';

const GEMINI_BASE = '/gemini-api/v1beta/models';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Supported Gemini models available for selection in the UI. */
export const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-live-preview',
] as const;

export interface GeminiSettings {
  model: string;
  exampleIssueNumbers: number[];
  extraInstructions: string;
}

export function loadGeminiSettings(): GeminiSettings {
  return {
    model: localStorage.getItem('gemini_model') ?? DEFAULT_GEMINI_MODEL,
    exampleIssueNumbers: JSON.parse(localStorage.getItem('gemini_example_issue_numbers') ?? '[]'),
    extraInstructions: localStorage.getItem('gemini_extra_instructions') ?? '',
  };
}

export function saveGeminiSettings(settings: GeminiSettings): void {
  localStorage.setItem('gemini_model', settings.model.trim() || DEFAULT_GEMINI_MODEL);
  localStorage.setItem('gemini_example_issue_numbers', JSON.stringify(settings.exampleIssueNumbers));
  localStorage.setItem('gemini_extra_instructions', settings.extraInstructions);
}

async function geminiFetch(path: string, init: RequestInit): Promise<Response> {
  const idToken = await getFirebaseIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`${GEMINI_BASE}${path}`, { ...init, headers });
}

export async function testGeminiConnection(): Promise<void> {
  const { model } = loadGeminiSettings();
  const res = await geminiFetch(`/${model}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Gemini proxy error ${res.status}`);
  }
}

export interface IssueContext {
  userActivityName?: string;
  userActivityDescription?: string;
  waveName?: string;
  waveDescription?: string;
}

export async function generateDescription(
  owner: string,
  repo: string,
  title: string,
  existingBody: string,
  context: IssueContext = {},
  modelOverride?: string,
): Promise<string> {
  const { model: savedModel, exampleIssueNumbers, extraInstructions } = loadGeminiSettings();
  const model = modelOverride ?? savedModel;

  const idToken = await getFirebaseIdToken();
  const ghHeaders = { Authorization: `Bearer ${idToken}` };

  // Fetch README
  let readme = '';
  try {
    const res = await fetch(`/github-api/repos/${owner}/${repo}/readme`, {
      headers: { ...ghHeaders, Accept: 'application/vnd.github.raw+json' },
    });
    if (res.ok) readme = await res.text();
  } catch { /* continue without README */ }

  // Fetch example issue bodies (up to 3)
  const examples: { title: string; body: string }[] = [];
  for (const num of exampleIssueNumbers.slice(0, 3)) {
    try {
      const res = await fetch(`/github-api/repos/${owner}/${repo}/issues/${num}`, {
        headers: { ...ghHeaders, Accept: 'application/vnd.github.v3+json' },
      });
      if (res.ok) {
        const data = await res.json() as { title: string; body: string | null };
        if (data.body?.trim()) examples.push({ title: data.title, body: data.body });
      }
    } catch { /* skip */ }
  }

  // Build prompt
  const sections: string[] = [
    'You are a technical writer helping write GitHub issue descriptions. Use clear, concise Markdown.',
  ];

  if (readme) {
    sections.push(`## Project Context (README)\n${readme.slice(0, 3000)}`);
  }

  if (examples.length > 0) {
    sections.push('## Style Examples\nHere are well-written issues from this project — match their tone and structure:');
    examples.forEach((ex, i) => {
      sections.push(`### Example ${i + 1}: ${ex.title}\n${ex.body}`);
    });
  }

  if (extraInstructions.trim()) {
    sections.push(`## Additional Instructions\n${extraInstructions.trim()}`);
  }

  // User Activity / Wave context
  const issueContext: string[] = [];
  if (context.userActivityName) {
    issueContext.push(`User Activity: ${context.userActivityName}${context.userActivityDescription ? ` — ${context.userActivityDescription}` : ''}`);
  }
  if (context.waveName) {
    issueContext.push(`Wave: ${context.waveName}${context.waveDescription ? ` — ${context.waveDescription}` : ''}`);
  }

  sections.push(
    [
      '## Task',
      'Write a description for the issue below using exactly this three-section structure:',
      '',
      '### Background',
      '(current state, pain point, why this change is needed)',
      '',
      '### Solution',
      '(technical approach, key files/components to change)',
      '',
      '### Acceptance Criteria',
      '(bulleted list of specific, verifiable conditions)',
      '',
      `Issue title: ${title}`,
      issueContext.length > 0 ? `\nIssue context:\n${issueContext.join('\n')}` : '',
      existingBody ? `\nExisting description:\n${existingBody}` : '',
      '',
      'Return only the Markdown. Do not wrap it in a code block.',
    ].join('\n'),
  );

  const res = await geminiFetch(`/${model}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({ contents: [{ parts: [{ text: sections.join('\n\n') }] }] }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Gemini proxy error ${res.status}`);
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}
