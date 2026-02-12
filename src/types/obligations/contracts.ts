import type { ObligationDistributionEntry, ObligationIssueLogEntry } from './transmittals';
export type ObligationStatus =
  | 'draft'
  | 'in-review'
  | 'returned'
  | 'approved'
  | 'issued'
  | 'superseded'
  | 'archived'
  | 'completed';

export interface ObligationWorkflowTransition {
  fromStatus: ObligationStatus;
  toStatus: ObligationStatus;
  changedAt: Date;
  changedBy: string;
  reason?: string;
}

export interface ObligationApprovalEntry {
  role: 'author' | 'reviewer' | 'approver' | 'legal' | 'project-manager';
  name: string;
  approved: boolean;
  approvedAt?: Date;
  notes?: string;
}

export interface ObligationAuditEvent {
  id: string;
  action:
    | 'created'
    | 'updated'
    | 'status-transition'
    | 'approved'
    | 'linked-phase'
    | 'linked-cost'
    | 'issued'
    | 'transmittal-created';
  actor: string;
  occurredAt: Date;
  details: string;
}

export interface ObligationPhaseBinding {
  phaseId: string;
  phaseName: string;
  milestoneId?: string;
  acceptanceCriteria?: string;
}

export interface ObligationCostBinding {
  costCode: string;
  costLineName: string;
  boqItemCode?: string;
  budgetAmount?: number;
}

export interface ObligationDocument {
  id: string;
  title: string;
  projectName: string;
  contractorCompany: string; // 🔄 BACKWARD COMPATIBILITY: Κρατάμε για legacy data
  owners: Owner[];
  createdAt: Date;
  updatedAt: Date;
  status: ObligationStatus;
  sections: ObligationSection[];
  projectDetails: ProjectDetails;
  tableOfContents?: TableOfContentsItem[];

  // 🏢 ENTERPRISE: Νέα πεδία για database integration
  // ✅ Optional για πλήρη backward compatibility
  companyId?: string;        // Σύνδεση με companies collection (Firebase ID)
  projectId?: string | number; // Σύνδεση με projects collection (supports both string & number IDs)
  buildingId?: string;       // Σύνδεση με buildings collection (optional για specific building obligations)

  // 🔗 ENTERPRISE: Rich company information (auto-populated από companyId)
  companyDetails?: {
    name: string;           // Αυτόματα από companies.service
    email?: string;
    phone?: string;
    address?: string;
    registrationNumber?: string;
  };

  // 🔗 ENTERPRISE: Rich project information (auto-populated από projectId)
  projectInfo?: {
    description?: string;   // Αυτόματα από projects.service
    location?: string;
    startDate?: Date;
    endDate?: Date;
    projectType?: string;
    budget?: number;
  };

  // 🏢 ENTERPRISE: Workflow/revision metadata
  docNumber?: string;
  revision?: number;
  revisionNotes?: string;
  dueDate?: Date;
  assigneeId?: string;
  assigneeName?: string;
  workflowTransitions?: ObligationWorkflowTransition[];
  approvals?: ObligationApprovalEntry[];
  auditTrail?: ObligationAuditEvent[];
  distribution?: ObligationDistributionEntry[];
  issueLog?: ObligationIssueLogEntry[];
  phaseBinding?: ObligationPhaseBinding;
  costBinding?: ObligationCostBinding;
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
