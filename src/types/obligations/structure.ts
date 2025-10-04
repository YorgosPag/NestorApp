import type { ObligationDocument, ObligationSection, ObligationArticle, ObligationParagraph } from './contracts';

// Document structure utilities
export const flattenDocument = (document: ObligationDocument) => {
  const items: Array<ObligationSection | ObligationArticle | ObligationParagraph> = [];

  document.sections
    .sort((a, b) => a.order - b.order)
    .forEach((section) => {
      items.push(section);

      if (section.articles) {
        section.articles
          .sort((a, b) => a.order - b.order)
          .forEach((article) => {
            items.push(article);

            if (article.paragraphs) {
              article.paragraphs
                .sort((a, b) => a.order - b.order)
                .forEach((paragraph) => {
                  items.push(paragraph);
                });
            }
          });
      }
    });

  return items;
};
