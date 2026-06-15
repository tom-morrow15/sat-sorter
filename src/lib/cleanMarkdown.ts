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

    // Repair a couple of malformed-number artifacts seen from faster models.
    // "$3,.66" -> "$3.66" (stray comma immediately before the decimal point)
    line = line.replace(/(\$\d+),\.(\d)/g, '$1.$2');
    // "has296.71 left" / "are1.31 under" -> "has 296.71 left": a common English
    // word fused directly to a dollar/number. Only split when the digits look
    // like money (followed by a decimal or attached to a $) to avoid touching
    // legitimate tokens like "covid19" or "Llama3".
    line = line.replace(
      /\b(has|have|are|is|left|over|under|of|at|spent|by|need|about)(\$?\d)/gi,
      '$1 $2'
    );
    // Collapse any doubled spaces created above.
    line = line.replace(/ {2,}/g, ' ');

    cleaned.push(line);
  }

  // Collapse 3+ blank lines into a single blank line
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
