/**
 * Very small Markdown → HTML converter for GitHub issue bodies.
 * Supports: headings, fenced code blocks, inline code, bold/italic/strikethrough,
 * task lists, unordered & ordered lists, blockquotes, thematic breaks, and links.
 */

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineElements(text: string): string {
  let r = escapeHTML(text);

  // Inline code – must run before bold/italic to avoid double-processing
  r = r.replace(/`([^`\n]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-gray-800">$1</code>');

  // Bold + italic combined
  r = r.replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>');

  // Bold
  r = r.replace(/\*\*(.+?)\*\*/gs, '<strong class="font-semibold text-gray-900">$1</strong>');
  r = r.replace(/__(.+?)__/gs, '<strong class="font-semibold text-gray-900">$1</strong>');

  // Italic
  r = r.replace(/\*([^*\n]+)\*/g, '<em class="italic">$1</em>');
  r = r.replace(/_([^_\n]+)_/g, '<em class="italic">$1</em>');

  // Strikethrough
  r = r.replace(/~~(.+?)~~/gs, '<del class="line-through text-gray-400">$1</del>');

  // Markdown links [text](url)
  r = r.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>',
  );

  return r;
}

function processLines(lines: string[]): string {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      html += `<h3 class="text-base font-semibold text-gray-900 mt-4 mb-1.5">${inlineElements(h3[1])}</h3>`;
      i++;
      continue;
    }
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      html += `<h2 class="text-lg font-semibold text-gray-900 mt-5 mb-2">${inlineElements(h2[1])}</h2>`;
      i++;
      continue;
    }
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      html += `<h1 class="text-xl font-bold text-gray-900 mt-5 mb-2">${inlineElements(h1[1])}</h1>`;
      i++;
      continue;
    }

    // Thematic break
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += '<hr class="border-gray-200 my-4" />';
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        qLines.push(inlineElements(lines[i].slice(2)));
        i++;
      }
      html += `<blockquote class="border-l-4 border-gray-300 pl-4 my-3 text-gray-600 italic text-sm">${qLines.join('<br>')}</blockquote>`;
      continue;
    }

    // Unordered list (incl. task list items)
    if (/^[-*+] /.test(line)) {
      let items = '';
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        const taskMatch = lines[i].match(/^[-*+] \[([ x])\] (.*)/i);
        if (taskMatch) {
          const checked = taskMatch[1].toLowerCase() === 'x';
          items += `<li class="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" ${checked ? 'checked' : ''} disabled class="mt-0.5 shrink-0 accent-blue-500" /><span>${inlineElements(taskMatch[2])}</span></li>`;
        } else {
          items += `<li class="text-sm text-gray-700">${inlineElements(lines[i].slice(2))}</li>`;
        }
        i++;
      }
      html += `<ul class="list-disc list-outside pl-5 space-y-1 my-3">${items}</ul>`;
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      let items = '';
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, '');
        items += `<li class="text-sm text-gray-700">${inlineElements(text)}</li>`;
        i++;
      }
      html += `<ol class="list-decimal list-outside pl-5 space-y-1 my-3">${items}</ol>`;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph – collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6} /.test(lines[i]) &&
      !/^[-*+] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !lines[i].startsWith('> ') &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      paraLines.push(inlineElements(lines[i]));
      i++;
    }
    if (paraLines.length) {
      html += `<p class="text-sm text-gray-700 leading-relaxed my-2">${paraLines.join('<br>')}</p>`;
    }
  }

  return html;
}

/**
 * Convert a Markdown string to a safe HTML string suitable for
 * use with `dangerouslySetInnerHTML`. Only GitHub-flavoured
 * Markdown constructs that appear in issue bodies are supported.
 */
export function parseMarkdownToHTML(markdown: string): string {
  if (!markdown.trim()) return '';

  // Split on fenced code blocks first so we never mangle code content.
  const parts = markdown.split(/(```[\w]*\n[\s\S]*?```)/g);
  let html = '';

  for (const part of parts) {
    const codeMatch = part.match(/^```([\w]*)\n([\s\S]*)```$/);
    if (codeMatch) {
      const lang = codeMatch[1];
      const code = escapeHTML(codeMatch[2].trimEnd());
      html += `<pre class="bg-gray-950 text-gray-100 rounded-lg p-3 overflow-x-auto my-3 text-xs font-mono leading-relaxed"${
        lang ? ` data-lang="${escapeHTML(lang)}"` : ''
      }>${code}</pre>`;
    } else {
      html += processLines(part.split('\n'));
    }
  }

  return html;
}
