"use client";

import { useMemo } from 'react';
import type { ObligationDocument, TableOfContentsItem } from '@/types/obligations';
import { generateTableOfContents } from '@/types/obligations';

export function useToc(doc: Partial<ObligationDocument>): TableOfContentsItem[] {
  const tableOfContents = useMemo<TableOfContentsItem[]>(() => {
    if (!doc?.sections) return [];
    
    // Create a complete document object for generation, with fallbacks
    const fullDoc: ObligationDocument = {
      id: doc.id || "preview",
      title: doc.title || "",
      projectName: doc.projectName || "",
      contractorCompany: doc.contractorCompany || "",
      owners: doc.owners || [],
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
      status: doc.status || "draft",
      sections: doc.sections,
      projectDetails: doc.projectDetails || { location: "", address: "" },
    };
    return generateTableOfContents(fullDoc);
  }, [doc]);

  return tableOfContents;
}
