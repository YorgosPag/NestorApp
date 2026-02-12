import { ObligationDocument, ObligationSection, ObligationArticle } from '@/types/obligations';
import { calculateWordCount } from './text-utils';

export type SortField = 'title' | 'createdAt' | 'updatedAt' | 'status' | 'projectName' | 'wordCount' | 'completionPercentage';
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: SortField;
  order: SortOrder;
}

export function sortObligationDocuments(
  documents: ObligationDocument[],
  options: SortOptions
): ObligationDocument[] {
  return [...documents].sort((a, b) => {
    const result = compareDocuments(a, b, options.field);
    return options.order === 'desc' ? -result : result;
  });
}

function compareDocuments(a: ObligationDocument, b: ObligationDocument, field: SortField): number {
  switch (field) {
    case 'title':
      return a.title.localeCompare(b.title, 'el-GR');

    case 'projectName':
      return a.projectName.localeCompare(b.projectName, 'el-GR');

    case 'status':
      const statusOrder: Record<ObligationDocument['status'], number> = {
        draft: 0,
        'in-review': 1,
        returned: 2,
        approved: 3,
        issued: 4,
        superseded: 5,
        archived: 6,
        completed: 7,
      };
      return statusOrder[a.status] - statusOrder[b.status];

    case 'createdAt':
      return a.createdAt.getTime() - b.createdAt.getTime();

    case 'updatedAt':
      return a.updatedAt.getTime() - b.updatedAt.getTime();

    case 'wordCount':
      const wordCountA = calculateDocumentWordCount(a);
      const wordCountB = calculateDocumentWordCount(b);
      return wordCountA - wordCountB;

    case 'completionPercentage':
      const completionA = calculateCompletionPercentage(a);
      const completionB = calculateCompletionPercentage(b);
      return completionA - completionB;

    default:
      return 0;
  }
}

export function sortSections(
  sections: ObligationSection[],
  field: 'order' | 'title' | 'category' | 'wordCount' = 'order',
  order: SortOrder = 'asc'
): ObligationSection[] {
  return [...sections].sort((a, b) => {
    let result = 0;

    switch (field) {
      case 'order':
        result = a.order - b.order;
        break;
      case 'title':
        result = a.title.localeCompare(b.title, 'el-GR');
        break;
      case 'category':
        result = a.category.localeCompare(b.category, 'el-GR');
        break;
      case 'wordCount':
        const wordCountA = calculateWordCount(a.content);
        const wordCountB = calculateWordCount(b.content);
        result = wordCountA - wordCountB;
        break;
    }

    return order === 'desc' ? -result : result;
  });
}

export function sortArticles(
  articles: ObligationArticle[],
  field: 'order' | 'title' | 'wordCount' = 'order',
  order: SortOrder = 'asc'
): ObligationArticle[] {
  return [...articles].sort((a, b) => {
    let result = 0;

    switch (field) {
      case 'order':
        result = a.order - b.order;
        break;
      case 'title':
        result = a.title.localeCompare(b.title, 'el-GR');
        break;
      case 'wordCount':
        const wordCountA = calculateWordCount(a.content);
        const wordCountB = calculateWordCount(b.content);
        result = wordCountA - wordCountB;
        break;
    }

    return order === 'desc' ? -result : result;
  });
}

function calculateDocumentWordCount(document: ObligationDocument): number {
  let totalWords = 0;

  document.sections?.forEach(section => {
    totalWords += calculateWordCount(section.content);

    section.articles?.forEach(article => {
      totalWords += calculateWordCount(article.content);

      article.paragraphs?.forEach(paragraph => {
        totalWords += calculateWordCount(paragraph.content);
      });
    });
  });

  return totalWords;
}

function calculateCompletionPercentage(document: ObligationDocument): number {
  if (!document.sections || document.sections.length === 0) return 0;

  const requiredSections = document.sections.filter(s => s.isRequired);
  if (requiredSections.length === 0) return 100;

  const completedSections = requiredSections.filter(section => {
    const hasContent = section.content && section.content.trim().length > 0;
    const hasTitle = section.title && section.title.trim().length > 0;
    return hasContent && hasTitle;
  });

  return Math.round((completedSections.length / requiredSections.length) * 100);
}

export function groupDocumentsByStatus(documents: ObligationDocument[]): Record<string, ObligationDocument[]> {
  return documents.reduce((groups, doc) => {
    const status = doc.status;
    if (!groups[status]) {
      groups[status] = [];
    }
    groups[status].push(doc);
    return groups;
  }, {} as Record<string, ObligationDocument[]>);
}

export function groupDocumentsByProject(documents: ObligationDocument[]): Record<string, ObligationDocument[]> {
  return documents.reduce((groups, doc) => {
    const project = doc.projectName;
    if (!groups[project]) {
      groups[project] = [];
    }
    groups[project].push(doc);
    return groups;
  }, {} as Record<string, ObligationDocument[]>);
}
