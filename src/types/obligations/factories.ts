import type { ObligationSection, ObligationArticle, ObligationParagraph } from './contracts';
import { generateSectionId, generateArticleId, generateParagraphId } from '@/services/enterprise-id-convenience';

// Enhanced helper functions
// 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
export const createNewSection = (order: number = 0): ObligationSection => ({
  id: generateSectionId(),
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
  id: generateArticleId(),
  sectionId,
  number: (order + 1).toString(),
  title: 'Νέο Άρθρο',
  content: '',
  paragraphs: [],
  order,
  isExpanded: true
});

export const createNewParagraph = (articleId: string, order: number = 0): ObligationParagraph => ({
  id: generateParagraphId(),
  articleId,
  number: `${order + 1}`,
  content: '',
  order
});
