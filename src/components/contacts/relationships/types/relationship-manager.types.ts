// ============================================================================
// RELATIONSHIP MANAGER TYPES
// ============================================================================
//
// 🏗️ TypeScript interfaces and types for relationship management components
// Extracted from ContactRelationshipManager for better type organization
//
// ============================================================================

import type {
  ContactRelationship,
  ProfessionalContactInfo
} from '@/types/contacts/relationships';
import type { ContactType, PhoneInfo, EmailInfo } from '@/types/contacts';

/**
 * 🏢 Main Component Props Interface
 * Props for the ContactRelationshipManager component
 */
export interface ContactRelationshipManagerProps {
  /** Κύρια επαφή για την οποία διαχειριζόμαστε τις σχέσεις */
  contactId: string;

  /** Τύπος επαφής (company, service, individual) */
  contactType: ContactType;

  /** Read-only mode για προβολή χωρίς επεξεργασία */
  readonly?: boolean;

  /** CSS κλάσεις για styling */
  className?: string;

  /** Callback όταν αλλάζουν οι σχέσεις */
  onRelationshipsChange?: (relationships: ContactRelationship[]) => void;
}

/**
 * 📝 Form Data Interface
 * Data structure for relationship form inputs
 */
export interface RelationshipFormData {
  targetContactId: string;
  relationshipType: string;
  /** Custom label when user adds a new relationship type not in predefined list */
  customRelationshipLabel?: string;
  position?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  contactInfo?: Partial<ProfessionalContactInfo>;
  /** Centralized phone entries (replaces plain-text businessPhone) */
  phones?: PhoneInfo[];
  /** Centralized email entries (replaces plain-text businessEmail) */
  emails?: EmailInfo[];
}

/**
 * 📋 Form Props Interface
 * Props for RelationshipForm component
 */
export interface RelationshipFormProps {
  /** Current form data */
  formData: RelationshipFormData;

  /** Form data setter */
  setFormData: React.Dispatch<React.SetStateAction<RelationshipFormData>>;

  /** Contact type for filtering relationship types */
  contactType: ContactType;

  /** Current contact ID (to exclude from dropdown) */
  currentContactId: string;

  /** Loading state */
  loading: boolean;

  /** Error message */
  error: string | null;

  /** Whether we're editing an existing relationship */
  editingId: string | null;

  /** Relationship types already used for the selected target contact — excluded from dropdown */
  usedRelationshipTypes?: string[];

  /** Form submit handler */
  onSubmit: (e?: React.FormEvent | React.MouseEvent) => Promise<void>;

  /** Cancel handler */
  onCancel: () => void;
}

/**
 * 📊 List Props Interface
 * Props for RelationshipList component
 */
export interface RelationshipListProps {
  /** List of relationships to display */
  relationships: ContactRelationship[];

  /** Contact type for context */
  contactType: ContactType;

  /** Loading state */
  loading: boolean;

  /** Contact ID for context */
  contactId: string;

  /** Read-only mode */
  readonly?: boolean;

  /** Expanded relationships set */
  expandedRelationships: Set<string>;

  /** Toggle expanded state */
  onToggleExpanded: (id: string) => void;

  /** Edit relationship handler */
  onEdit?: (relationship: ContactRelationship) => void;

  /** Delete relationship handler */
  onDelete?: (id: string) => void;
}

/**
 * 🃏 Card Props Interface
 * Props for individual RelationshipCard component
 */
export interface RelationshipCardProps {
  /** Relationship to display */
  relationship: ContactRelationship;

  /** Current contact ID to determine which contact to show */
  currentContactId: string;

  /** Whether card is expanded */
  isExpanded: boolean;

  /** Toggle expansion */
  onToggleExpanded: () => void;

  /** Read-only mode */
  readonly?: boolean;

  /** Edit handler */
  onEdit?: () => void;

  /** Delete handler */
  onDelete?: () => void;
}

/**
 * 🌳 Organization Tree Props
 * Props for OrganizationTree component
 */
export interface OrganizationTreeProps {
  /** Contact ID for the organization */
  contactId: string;

  /** Contact type */
  contactType: ContactType;

  /** CSS classes */
  className?: string;
}

/**
 * 🎯 Hook Return Types
 * Return types for custom hooks
 */

/**
 * useRelationshipForm hook return type
 */
export interface UseRelationshipFormReturn {
  formData: RelationshipFormData;
  setFormData: React.Dispatch<React.SetStateAction<RelationshipFormData>>;
  loading: boolean;
  error: string | null;
  editingId: string | null;
  successMessage: string | null;
  handleSubmit: (e?: React.FormEvent | React.MouseEvent) => Promise<void>;
  handleEdit: (relationship: ContactRelationship) => void;
  handleCancel: () => void;
  resetForm: () => void;
}

/**
 * useRelationshipList hook return type
 */
export interface UseRelationshipListReturn {
  relationships: ContactRelationship[];
  loading: boolean;
  error: string | null;
  expandedRelationships: Set<string>;
  refreshRelationships: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleToggleExpanded: (id: string) => void;
}

/**
 * useOrganizationTree hook return type
 */
// 🏢 ENTERPRISE: Import OrganizationTree from centralized types
import type { OrganizationTree } from '@/types/contacts/relationships';

export interface UseOrganizationTreeReturn {
  organizationTree: OrganizationTree | null;
  loading: boolean;
  error: string | null;
  refreshTree: () => Promise<void>;
  shouldShowTree: boolean; // Computed value for conditional display
}