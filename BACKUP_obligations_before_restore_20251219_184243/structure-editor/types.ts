import type { ObligationSection, ObligationArticle, ObligationParagraph } from "@/types/obligations";

export interface StructureEditorProps {
  sections: ObligationSection[];
  onSectionsChange: (sections: ObligationSection[]) => void;
  onActiveItemChange?: (item: { type: 'section' | 'article' | 'paragraph'; id: string } | null) => void;
  activeItemId?: string;
  readOnly?: boolean;
}

export type UpdateSection = (sectionId: string, updates: Partial<ObligationSection>) => void;
export type UpdateArticle = (sectionId: string, articleId: string, updates: Partial<ObligationArticle>) => void;
export type UpdateParagraph = (sectionId: string, articleId: string, paragraphId: string, updates: Partial<ObligationParagraph>) => void;
