export type ObligationStatus = 'draft' | 'completed' | 'approved';

export interface ObligationDocument {
  id: string;
  title: string;
  projectName: string;
  contractorCompany: string;
  owners: Owner[];
  createdAt: Date;
  updatedAt: Date;
  status: ObligationStatus;
  sections: ObligationSection[];
  projectDetails: ProjectDetails;
  tableOfContents?: TableOfContentsItem[];
}

export interface Owner {
  id: string;
  name: string;
  share?: number;
}

export interface ProjectDetails {
  location: string;
  address: string;
  plotNumber?: string;
  buildingPermitNumber?: string;
  contractDate?: Date;
  deliveryDate?: Date;
  notaryName?: string;
}

// Updated Section interface with articles instead of subsections
export interface ObligationSection {
  id: string;
  number: string;
  title: string;
  content: string;
  articles?: ObligationArticle[];
  isRequired: boolean;
  category: SectionCategory;
  order: number;
  isExpanded?: boolean;
}

// New Article interface (level 2 - replaces subsections)
export interface ObligationArticle {
  id: string;
  sectionId: string;
  number: string;
  title: string;
  content: string;
  paragraphs?: ObligationParagraph[];
  order: number;
  isExpanded?: boolean;
}

// New Paragraph interface (level 3)
export interface ObligationParagraph {
  id: string;
  articleId: string;
  number: string;
  content: string;
  order: number;
}


export interface Specification {
  id: string;
  description: string;
  materialType?: string;
  dimensions?: string;
  brand?: string;
  quality?: string;
}

// Table of Contents interfaces
export interface TableOfContentsItem {
  id: string;
  type: 'section' | 'article' | 'paragraph';
  title: string;
  number: string;
  level: number; // 1=section, 2=article, 3=paragraph
  page?: number;
  parentId?: string;
  children?: TableOfContentsItem[];
}

// Drag & Drop interfaces
export interface DragItem {
  id: string;
  type: 'section' | 'article' | 'paragraph';
  parentId?: string;
  originalIndex: number;
  sectionId?: string;
  articleId?: string;
}

export interface DropResult {
  dragIndex: number;
  hoverIndex: number;
  dragItem: DragItem;
  targetParentId?: string;
}

// Preview state management
export interface PreviewState {
  document: ObligationDocument;
  selectedItem?: {
    type: 'section' | 'article' | 'paragraph';
    id: string;
  };
  showTableOfContents: boolean;
  viewMode: 'edit' | 'preview' | 'print';
}

// Editor state
export interface EditorState {
  activeSection?: string;
  activeArticle?: string;
  activeParagraph?: string;
  expandedItems: string[];
  dragMode: boolean;
  hasUnsavedChanges: boolean;
}

export type SectionCategory = 
  | 'general'
  | 'construction'
  | 'materials'
  | 'systems'
  | 'finishes'
  | 'installations'
  | 'safety'
  | 'environment';

export interface ObligationTemplate {
  id: string;
  name: string;
  description: string;
  sections: ObligationSection[];
  isDefault: boolean;
}
