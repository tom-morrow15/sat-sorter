/**
 * Clean up markdown artifacts that render badly inside narrow mobile UI
 * (chat bubbles, insight cards). Maple is instructed to avoid markdown, but in
 * case it slips up we strip tables, bold markers, and headers so the text
 * stays readable.
 */
export function cleanMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const cleaned: string[] = [];

  for (let line of lines) {
    // Drop markdown table separator rows like |----|----| or ---|---
    const stripped = line.replace(/[\s|:-]/g, '');
    if (/[-|]/.test(line) && stripped === '' && line.trim().length > 0) {
      continue;
    }

    // Convert table rows ("| a | b |") into readable "a — b"
    if (line.trim().startsWith('|') && line.includes('|')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      line = cells.join(' — ');
    }

    // Remove bold/italic asterisks and leading markdown headers
    line = line
      .replace(/\*\*/g, '')
      .replace(/(^|\s)\*(\S)/g, '$1$2')
      .replace(/^#{1,6}\s*/, '');

    cleaned.push(line);
  }

  // Collapse 3+ blank lines into a single blank line
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
