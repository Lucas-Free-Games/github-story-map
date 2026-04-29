const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-pro-preview';

export interface GeminiSettings {
  apiKey: string;
  model: string;
  exampleIssueNumbers: number[];
  extraInstructions: string;
}

export function loadGeminiSettings(): GeminiSettings {
  return {
    apiKey: localStorage.getItem('gemini_api_key') ?? '',
    model: localStorage.getItem('gemini_model') ?? DEFAULT_GEMINI_MODEL,
    exampleIssueNumbers: JSON.parse(localStorage.getItem('gemini_example_issue_numbers') ?? '[]'),
    extraInstructions: localStorage.getItem('gemini_extra_instructions') ?? '',
  };
}

export function saveGeminiSettings(settings: GeminiSettings): void {
  localStorage.setItem('gemini_api_key', settings.apiKey.trim());
  localStorage.setItem('gemini_model', settings.model.trim() || DEFAULT_GEMINI_MODEL);
  localStorage.setItem('gemini_example_issue_numbers', JSON.stringify(settings.exampleIssueNumbers));
  localStorage.setItem('gemini_extra_instructions', settings.extraInstructions);
}

function geminiUrl(model: string, apiKey: string): string {
  return `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
}

export async function testGeminiConnection(): Promise<void> {
  const { apiKey, model } = loadGeminiSettings();
  if (!apiKey) throw new Error('No API key configured.');
  const res = await fetch(geminiUrl(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Gemini API error ${res.status}`);
  }
}

export interface IssueContext {
  userActivityName?: string;
  userActivityDescription?: string;
  waveName?: string;
  waveDescription?: string;
}

export async function generateDescription(
  token: string,
  owner: string,
  repo: string,
  title: string,
  existingBody: string,
  context: IssueContext = {},
): Promise<string> {
  const { apiKey, model, exampleIssueNumbers, extraInstructions } = loadGeminiSettings();
  if (!apiKey) throw new Error('No Gemini API key configured. Add one in Settings.');

  // Fetch README
  let readme = '';
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw+json' },
    });
    if (res.ok) readme = await res.text();
  } catch { /* continue without README */ }

  // Fetch example issue bodies (up to 3)
  const examples: { title: string; body: string }[] = [];
  for (const num of exampleIssueNumbers.slice(0, 3)) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${num}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
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

  const res = await fetch(geminiUrl(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: sections.join('\n\n') }] }] }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Gemini API error ${res.status}`);
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}
