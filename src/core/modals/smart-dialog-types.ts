/**
 * =============================================================================
 * SMART DIALOG TYPES - Enterprise Type Definitions
 * =============================================================================
 *
 * SSoT for all Smart Dialog Engine type definitions.
 *
 * @module core/modals/smart-dialog-types
 */

import type * as React from 'react';

/**
 * Dialog Entity Types - Enterprise Classification
 */
export type DialogEntityType =
  | 'contact'
  | 'company'
  | 'project'
  | 'building'
  | 'opportunity'
  | 'property'
  | 'service'
  | 'task';

/**
 * Dialog Operation Types - CRUD + Enterprise Operations
 */
export type DialogOperationType =
  | 'create'
  | 'edit'
  | 'update'
  | 'delete'
  | 'archive'
  | 'select'
  | 'duplicate'
  | 'import'
  | 'export'
  | 'preview'
  | 'approve';

export type DialogCopyVariant =
  | 'default'
  | 'contactSoftDelete'
  | 'contactPermanentDelete';

/**
 * Smart Dialog Configuration - Enterprise Architecture
 */
export interface SmartDialogConfiguration {
  readonly entityType: DialogEntityType;
  readonly operationType: DialogOperationType;
  readonly body?: string;

  readonly header: {
    readonly title: string;
    readonly description: string;
    readonly icon?: React.ComponentType<{ className?: string }>;
  };

  readonly fields: ReadonlyArray<SmartDialogField>;

  readonly actions: {
    readonly primary: SmartDialogAction;
    readonly secondary: SmartDialogAction;
    readonly additional?: ReadonlyArray<SmartDialogAction>;
  };

  readonly layout: {
    readonly size: 'sm' | 'md' | 'lg' | 'xl';
    readonly gridColumns: 1 | 2 | 3 | 4;
    readonly spacing: 'compact' | 'normal' | 'comfortable';
  };

  readonly validation: {
    readonly required: ReadonlyArray<string>;
    readonly rules: Record<string, ValidationRule>;
  };

  readonly styling: {
    readonly theme: 'default' | 'enterprise' | 'dxf_technical';
    readonly variant: 'standard' | 'modal' | 'drawer';
  };
}

/**
 * Smart Dialog Field Configuration
 */
export interface SmartDialogField {
  readonly name: string;
  readonly type: 'input' | 'select' | 'textarea' | 'checkbox' | 'date' | 'file';
  readonly label: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly options?: ReadonlyArray<{ value: string; label: string }>;
  readonly validation?: ValidationRule;
  readonly dependencies?: ReadonlyArray<string>;
}

/**
 * Smart Dialog Action Configuration
 */
export interface SmartDialogAction {
  readonly key: string;
  readonly label: string;
  readonly variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  readonly icon?: React.ComponentType<{ className?: string }>;
  readonly disabled?: boolean;
  readonly loading?: boolean;
}

/**
 * Validation Rule Configuration
 */
export interface ValidationRule {
  readonly type: 'required' | 'email' | 'phone' | 'url' | 'pattern' | 'length' | 'number';
  readonly message: string;
  readonly options?: Record<string, unknown>;
}

/**
 * Smart Dialog Engine State
 */
export interface SmartDialogEngineState {
  readonly configuration: SmartDialogConfiguration;
  readonly formData: Record<string, unknown>;
  readonly loading: boolean;
  readonly errors: Record<string, string>;
  readonly touched: Record<string, boolean>;
}

/**
 * Props for SmartDialog React component factory
 */
export interface SmartDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (data?: Record<string, unknown>) => Promise<void> | void;
  [key: string]: unknown;
}

/**
 * Entity-specific dialog props with common callback patterns
 */
export interface DialogEntityProps extends SmartDialogProps {
  contact?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    [key: string]: unknown;
  };
  onContactAdded?: () => void;
  onContactsDeleted?: () => void;
  onContactsArchived?: () => void;
  onPropertyAdded?: () => void;
  onTaskCreated?: () => void;
  onCompanySelected?: (contact: Record<string, unknown>) => void;
}
