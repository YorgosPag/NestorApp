import type { ObligationSection, ObligationArticle, ObligationParagraph } from "@/types/obligations";

export interface StructureEditorProps {
  sections: ObligationSection[];
  onSectionsChange: (sections: ObligationSection[]) => void;
  onActiveItemChange?: (item: { type: 'section' | 'article' | 'paragraph'; id: string } | null) => void;
  activeItemId?: string;
  readOnly?: boolean;
}
