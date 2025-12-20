import { ObligationDocument, ObligationSection, ObligationArticle } from '@/types/obligations';
import { extractPlainTextFromHtml } from './text-utils';

export interface SearchOptions {
  searchTerm: string;
  caseSensitive?: boolean;
  wholeWords?: boolean;
  includeContent?: boolean;
  includeMetadata?: boolean;
}

export interface SearchResult {
  document: ObligationDocument;
  matches: SearchMatch[];
  score: number;
}

export interface SearchMatch {
  type: 'title' | 'content' | 'section' | 'article' | 'metadata';
  sectionId?: string;
  articleId?: string;
  text: string;
  context: string;
  position: number;
}

export function searchObligationDocuments(
  documents: ObligationDocument[],
  options: SearchOptions
): SearchResult[] {
  if (!options.searchTerm?.trim()) return [];

  const results: SearchResult[] = [];

  documents.forEach(document => {
    const matches = searchInDocument(document, options);
    if (matches.length > 0) {
      const score = calculateSearchScore(matches, options.searchTerm);
      results.push({ document, matches, score });
    }
  });

  return results.sort((a, b) => b.score - a.score);
}

export function searchInDocument(
  document: ObligationDocument,
  options: SearchOptions
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const searchTerm = options.caseSensitive
    ? options.searchTerm
    : options.searchTerm.toLowerCase();

  if (options.includeMetadata !== false) {
    const titleText = options.caseSensitive
      ? document.title
      : document.title?.toLowerCase() || '';

    if (titleText.includes(searchTerm)) {
      matches.push({
        type: 'title',
        text: document.title,
        context: document.title,
        position: titleText.indexOf(searchTerm)
      });
    }

    const projectText = options.caseSensitive
      ? document.projectName
      : document.projectName?.toLowerCase() || '';

    if (projectText.includes(searchTerm)) {
      matches.push({
        type: 'metadata',
        text: document.projectName,
        context: `Έργο: ${document.projectName}`,
        position: projectText.indexOf(searchTerm)
      });
    }
  }

  if (options.includeContent !== false) {
    document.sections?.forEach(section => {
      const sectionMatches = searchInSection(section, options);
      matches.push(...sectionMatches);
    });
  }

  return matches;
}

export function searchInSection(
  section: ObligationSection,
  options: SearchOptions
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const searchTerm = options.caseSensitive
    ? options.searchTerm
    : options.searchTerm.toLowerCase();

  const titleText = options.caseSensitive
    ? section.title
    : section.title?.toLowerCase() || '';

  if (titleText.includes(searchTerm)) {
    matches.push({
      type: 'section',
      sectionId: section.id,
      text: section.title,
      context: `Ενότητα ${section.number}: ${section.title}`,
      position: titleText.indexOf(searchTerm)
    });
  }

  const contentText = extractPlainTextFromHtml(section.content);
  const processedContent = options.caseSensitive
    ? contentText
    : contentText.toLowerCase();

  if (processedContent.includes(searchTerm)) {
    const position = processedContent.indexOf(searchTerm);
    const context = extractSearchContext(contentText, position, 100);

    matches.push({
      type: 'content',
      sectionId: section.id,
      text: contentText,
      context,
      position
    });
  }

  section.articles?.forEach(article => {
    const articleMatches = searchInArticle(article, options);
    matches.push(...articleMatches);
  });

  return matches;
}

export function searchInArticle(
  article: ObligationArticle,
  options: SearchOptions
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const searchTerm = options.caseSensitive
    ? options.searchTerm
    : options.searchTerm.toLowerCase();

  const titleText = options.caseSensitive
    ? article.title
    : article.title?.toLowerCase() || '';

  if (titleText.includes(searchTerm)) {
    matches.push({
      type: 'article',
      sectionId: article.sectionId,
      articleId: article.id,
      text: article.title,
      context: `Άρθρο ${article.number}: ${article.title}`,
      position: titleText.indexOf(searchTerm)
    });
  }

  const contentText = extractPlainTextFromHtml(article.content);
  const processedContent = options.caseSensitive
    ? contentText
    : contentText.toLowerCase();

  if (processedContent.includes(searchTerm)) {
    const position = processedContent.indexOf(searchTerm);
    const context = extractSearchContext(contentText, position, 100);

    matches.push({
      type: 'content',
      sectionId: article.sectionId,
      articleId: article.id,
      text: contentText,
      context,
      position
    });
  }

  return matches;
}

function extractSearchContext(text: string, position: number, maxLength: number): string {
  const start = Math.max(0, position - maxLength / 2);
  const end = Math.min(text.length, position + maxLength / 2);

  let context = text.substring(start, end);

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.trim();
}

function calculateSearchScore(matches: SearchMatch[], searchTerm: string): number {
  let score = 0;

  matches.forEach(match => {
    switch (match.type) {
      case 'title':
        score += 10;
        break;
      case 'section':
        score += 8;
        break;
      case 'article':
        score += 6;
        break;
      case 'content':
        score += 3;
        break;
      case 'metadata':
        score += 5;
        break;
    }

    if (match.text?.toLowerCase() === searchTerm.toLowerCase()) {
      score += 5;
    }
  });

  return score;
}