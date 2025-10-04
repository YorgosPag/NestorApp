import type { ObligationSection, ObligationArticle, ObligationParagraph } from './contracts';

// Enhanced helper functions
export const createNewSection = (order: number = 0): ObligationSection => ({
  id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  number: (order + 1).toString(),
  title: 'Νέα Ενότητα',
  content: '',
  articles: [],
  isRequired: false,
  category: 'general',
  order,
  isExpanded: true
});

export const createNewArticle = (sectionId: string, order: number = 0): ObligationArticle => ({
  id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  sectionId,
  number: (order + 1).toString(),
  title: 'Νέο Άρθρο',
  content: '',
  paragraphs: [],
  order,
  isExpanded: true
});

export const createNewParagraph = (articleId: string, order: number = 0): ObligationParagraph => ({
  id: `paragraph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  articleId,
  number: `${order + 1}`,
  content: '',
  order
});
