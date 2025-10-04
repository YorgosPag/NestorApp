import type { ObligationSection, ObligationArticle, ObligationParagraph } from './contracts';
import { renumberSections, renumberArticles, renumberParagraphs } from './numbering';

// Move operations for drag & drop
export const moveSection = (
  sections: ObligationSection[],
  dragIndex: number,
  hoverIndex: number
): ObligationSection[] => {
  const dragSection = sections[dragIndex];
  const newSections = [...sections];
  newSections.splice(dragIndex, 1);
  newSections.splice(hoverIndex, 0, dragSection);
  
  return renumberSections(newSections);
};

export const moveArticle = (
  section: ObligationSection,
  dragIndex: number,
  hoverIndex: number
): ObligationSection => {
  if (!section.articles) return section;
  
  const dragArticle = section.articles[dragIndex];
  const newArticles = [...section.articles];
  newArticles.splice(dragIndex, 1);
  newArticles.splice(hoverIndex, 0, dragArticle);
  
  return {
    ...section,
    articles: renumberArticles(newArticles)
  };
};

export const moveParagraph = (
  article: ObligationArticle,
  dragIndex: number,
  hoverIndex: number
): ObligationArticle => {
  if (!article.paragraphs) return article;
  
  const dragParagraph = article.paragraphs[dragIndex];
  const newParagraphs = [...article.paragraphs];
  newParagraphs.splice(dragIndex, 1);
  newParagraphs.splice(hoverIndex, 0, dragParagraph);
  
  return {
    ...article,
    paragraphs: renumberParagraphs(newParagraphs)
  };
};
