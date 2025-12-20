import type { ObligationDocument, TableOfContentsItem } from './contracts';

// Table of Contents generator
export const generateTableOfContents = (document: ObligationDocument): TableOfContentsItem[] => {
  const toc: TableOfContentsItem[] = [];

  // Guard against undefined sections
  if (!document.sections) {
    return toc;
  }

  document.sections
    .sort((a, b) => a.order - b.order)
    .forEach((section) => {
      const sectionToc: TableOfContentsItem = {
        id: section.id,
        type: 'section',
        title: section.title,
        number: section.number,
        level: 1,
        children: []
      };

      if (section.articles) {
        section.articles
          ?.sort((a, b) => a.order - b.order)
          .forEach((article) => {
            const articleToc: TableOfContentsItem = {
              id: article.id,
              type: 'article',
              title: article.title,
              number: article.number,
              level: 2,
              parentId: section.id,
              children: []
            };

            if (article.paragraphs) {
              article.paragraphs
                ?.sort((a, b) => a.order - b.order)
                .forEach((paragraph) => {
                  const paragraphToc: TableOfContentsItem = {
                    id: paragraph.id,
                    type: 'paragraph',
                    title: paragraph.content.slice(0, 50) + '...', // First 50 chars as title
                    number: paragraph.number,
                    level: 3,
                    parentId: article.id
                  };

                  articleToc.children!.push(paragraphToc);
                });
            }

            sectionToc.children!.push(articleToc);
          });
      }

      toc.push(sectionToc);
    });

  return toc;
};
