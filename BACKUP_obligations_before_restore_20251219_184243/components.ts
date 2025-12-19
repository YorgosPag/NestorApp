// -----------------------------------------------------------------------------
// Obligations Barrel - Components & Props
// -----------------------------------------------------------------------------
import type { ObligationDocument, ObligationSection, TableOfContentsItem } from '@/types/obligations';


// ========== Core Components ==========
export { default as RichTextEditor } from './rich-text-editor';
export { default as SectionEditor } from './section-editor';

// ========== Split View & Live Preview ==========
export {
  default as TableOfContents,
  CompactTableOfContents,
  PrintTableOfContents,
} from './table-of-contents';

export { default as StructureEditor } from './structure-editor';

export {
  default as LivePreview,
  PrintPreview,
  CompactPreview,
} from './live-preview';

// ========== PDF Export Components ==========
export {
  default as PDFExportButton,
  QuickPDFExportButton,
  PrintButton,
} from './pdf-export-button';


// -----------------------------------------------------------------------------
// Public component prop types
// -----------------------------------------------------------------------------

/** Props για Table of Contents components */
export interface TableOfContentsProps {
  items: TableOfContentsItem[];
  onItemClick?: (item: TableOfContentsItem) => void;
  activeItemId?: string;
  showPageNumbers?: boolean;
  compact?: boolean;
  className?: string;
}

/** Props για StructureEditor */
export interface StructureEditorProps {
  sections: ObligationSection[];
  onSectionsChange: (sections: ObligationSection[]) => void;
  onActiveItemChange?: (item: { type: 'section' | 'article' | 'paragraph'; id: string } | null) => void;
  activeItemId?: string;
  readOnly?: boolean;
}

/** Props για LivePreview */
export interface LivePreviewProps {
  document: Partial<ObligationDocument>;
  activeItemId?: string;
  onItemClick?: (item: { type: 'section' | 'article' | 'paragraph'; id: string }) => void;
  viewMode?: 'preview' | 'print';
  zoom?: number;
  className?: string;
}

/** Props για RichTextEditor */
export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  showStats?: boolean;
  disabled?: boolean;
}

/** Props για SectionEditor */
export interface SectionEditorProps {
  section: ObligationSection;
  onSave: (section: ObligationSection) => void;
  onDelete?: (sectionId: string) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

/** Props για PDFExportButton */
export interface PDFExportButtonProps {
  document: ObligationDocument;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showPreview?: boolean;
  className?: string;
}


// -----------------------------------------------------------------------------
// Convenience groups για εύκολη εισαγωγή συνδυασμών components
// -----------------------------------------------------------------------------
// Re-import for object literal usage
import StructureEditor from './structure-editor';
import SectionEditor from './section-editor';
import RichTextEditor from './rich-text-editor';
import LivePreview, { CompactPreview, PrintPreview } from './live-preview';
import TableOfContents, { CompactTableOfContents, PrintTableOfContents } from './table-of-contents';
import PDFExportButton, { QuickPDFExportButton, PrintButton } from './pdf-export-button';

export const ObligationsComponents = {
  SplitEditor: {
    Structure: StructureEditor,
    Preview: LivePreview,
    TableOfContents: TableOfContents,
  },
  Compact: {
    Preview: CompactPreview,
    TableOfContents: CompactTableOfContents,
  },
  Print: {
    Preview: PrintPreview,
    TableOfContents: PrintTableOfContents,
  },
  Editor: {
    Rich: RichTextEditor,
    Section: SectionEditor,
    Structure: StructureEditor,
  },
  Export: {
    PDFButton: PDFExportButton,
    QuickPDF: QuickPDFExportButton,
    Print: PrintButton,
  },
};
