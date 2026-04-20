import mammoth from 'mammoth';

/**
 * Extracts plain text from a DOCX buffer using mammoth.
 * Returns empty string on failure (classification falls back to filename-only).
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}
