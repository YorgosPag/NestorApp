/**
 * Extracts human-readable text from a DXF buffer.
 *
 * DXF is line-pair ASCII: odd lines = group code, even lines = value.
 * Text content lives in TEXT/MTEXT/ATTRIB/ATTDEF entities under codes 1 and 3.
 * Returns empty string if no text found (caller falls back to raw buffer).
 */
export function extractTextFromDxf(buffer: Buffer): string {
  const content = buffer.toString('utf-8');
  const lines = content.split(/\r?\n/);
  const texts: string[] = [];

  let inTextEntity = false;

  for (let i = 0; i < lines.length - 1; i++) {
    const code = lines[i].trim();
    const value = lines[i + 1].trim();

    // Track entity type
    if (code === '0') {
      inTextEntity = ['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(value.toUpperCase());
      i++;
      continue;
    }

    // Group code 1 = primary text value, code 3 = MTEXT continuation
    if (inTextEntity && (code === '1' || code === '3')) {
      const cleaned = value
        .replace(/\\P/g, ' ')   // MTEXT paragraph break
        .replace(/\\~/g, ' ')   // MTEXT non-breaking space
        .replace(/\{[^}]*\}/g, '') // MTEXT formatting codes like \f, \H, \C
        .trim();
      if (cleaned.length > 1) texts.push(cleaned);
      i++;
      continue;
    }

    i++;
  }

  return texts.join('\n').trim();
}
