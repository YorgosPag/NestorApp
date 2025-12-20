import { DEFAULT_READING_SPEED } from '@/core/configuration/business-rules';

export function truncateText(text: string, maxLength: number = 150): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function highlightSearchTerm(
  text: string,
  searchTerm: string,
  className: string = 'bg-yellow-200'
): string {
  if (!text || !searchTerm?.trim()) return text;

  try {
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, `<mark class="${className}">$1</mark>`);
  } catch (error) {
    console.warn('Error highlighting search term:', error);
    return text;
  }
}

export function extractPlainTextFromHtml(html: string): string {
  if (!html) return '';

  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function formatWordCount(count: number): string {
  if (count === 0) return '0 λέξεις';
  if (count === 1) return '1 λέξη';
  return `${count.toLocaleString('el-GR')} λέξεις`;
}

export function calculateWordCount(text: string): number {
  if (!text?.trim()) return 0;

  const plainText = extractPlainTextFromHtml(text);
  const words = plainText
    .split(/\s+/)
    .filter(word => word.length > 0);

  return words.length;
}

export function calculateCharacterCount(text: string, includeSpaces: boolean = true): number {
  if (!text) return 0;

  const plainText = extractPlainTextFromHtml(text);
  return includeSpaces ? plainText.length : plainText.replace(/\s/g, '').length;
}

export function estimateReadingTime(text: string, wordsPerMinute: number = DEFAULT_READING_SPEED): number {
  const wordCount = calculateWordCount(text);
  return Math.ceil(wordCount / wordsPerMinute);
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return 'Λιγότερο από 1 λεπτό';
  if (minutes === 1) return '1 λεπτό';
  return `${minutes} λεπτά`;
}

export function generateExcerpt(text: string, maxLength: number = 200): string {
  if (!text) return '';

  const plainText = extractPlainTextFromHtml(text);
  if (plainText.length <= maxLength) return plainText;

  const truncated = plainText.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }

  return truncated + '...';
}

export function cleanWhitespace(text: string): string {
  if (!text) return '';

  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '');
}