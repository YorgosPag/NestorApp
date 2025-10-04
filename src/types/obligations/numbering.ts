import type { ObligationSection, ObligationArticle, ObligationParagraph } from './contracts';

// Numbering utilities
export const renumberSections = (sections: ObligationSection[]): ObligationSection[] => {
  return sections
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      ...section,
      number: (index + 1).toString(),
      order: index,
      articles: section.articles ? renumberArticles(section.articles) : []
    }));
};

export const renumberArticles = (articles: ObligationArticle[]): ObligationArticle[] => {
  return articles
    .sort((a, b) => a.order - b.order)
    .map((article, index) => ({
      ...article,
      number: (index + 1).toString(),
      order: index,
      paragraphs: article.paragraphs ? renumberParagraphs(article.paragraphs) : []
    }));
};

export const renumberParagraphs = (paragraphs: ObligationParagraph[]): ObligationParagraph[] => {
  return paragraphs
    .sort((a, b) => a.order - b.order)
    .map((paragraph, index) => ({
      ...paragraph,
      number: `${index + 1}`,
      order: index
    }));
};
