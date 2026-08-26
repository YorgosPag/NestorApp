/**
 * =============================================================================
 * SMART DIALOG CONFIG - Entity Mappings & Validation Rules (SSoT)
 * =============================================================================
 *
 * Centralizes all entity-specific configurations:
 * - Field definitions per entity
 * - Required fields per entity
 * - Layout tokens per entity
 * - Validation rules
 * - Field type inference
 * - Placeholder mappings
 *
 * @module core/modals/smart-dialog-config
 */

import { i18n } from '@/i18n';
// 🔑 ΜΙΑ ΑΛΗΘΕΙΑ ΓΙΑ ΤΙΣ ΕΤΙΚΕΤΕΣ (ADR-804 §3): οι getters έρχονται ΑΠΕΥΘΕΙΑΣ από τα
// modules που τις ορίζουν, ΠΟΤΕ από το `modal-select.ts`.
// ⚠️ Το `modal-select.ts` όριζε **δικό του** `getCompanyFieldLabels` που επέστρεφε τις
// ΓΕΝΙΚΕΣ ετικέτες (22 πεδία: unit_code, floor, area…) αντί για τις ΕΤΑΙΡΙΚΕΣ (56 πεδία).
// Μετρημένο ζωντανά: `vat_number` → «Vat number», `legal_form` → «Legal form» — αγγλικά
// fallback σε ελληνική οθόνη, επειδή τα πεδία **δεν υπήρχαν** στον γενικό κατάλογο.
// ⚠️ ΜΗΝ τα ξαναγυρίσεις στο `modal-select.ts`: εκεί ζουν **δεύτερα σώματα** με το ίδιο
// όνομα (μετρημένα 30 αποκλίνοντα) — το σχήμα ADR-749.
import {
  VOCAB_PLACEHOLDERS,
  getCompanyFieldLabels,
  getServiceFieldLabels,
} from '@/config/vocabulary/labels/fields';
import {
  getContactTypeLabels,
  getProjectStatusLabels,
} from '@/config/vocabulary/labels/status';
// ADR-812: το ΛΕΞΙΛΟΓΙΟ (τι επιτρέπεται) και οι ΕΤΙΚΕΤΕΣ (πώς λέγεται) είναι δύο
// ερωτήματα. Το dropdown ρωτά το πρώτο· ο πίνακας ετικετών απαντά μόνο το δεύτερο.
import { ACTIVE_PROJECT_STATUSES } from '@/constants/project-statuses';
import { DROPDOWN_PLACEHOLDERS } from '../../constants/property-statuses-enterprise';
import type {
  DialogCopyVariant,
  DialogEntityType,
  DialogOperationType,
  SmartDialogAction,
  SmartDialogConfiguration,
  SmartDialogField,
  ValidationRule,
} from './smart-dialog-types';

// =============================================================================
// ENTITY FIELD DEFINITIONS
// =============================================================================

const ENTITY_FIELDS: Record<DialogEntityType, string[]> = {
  contact: ['type', 'fullName', 'email', 'phone', 'notes'],
  company: ['company_name', 'vat_number', 'legal_form', 'activity_description'],
  project: ['name', 'description', 'status', 'company', 'budget'],
  building: ['name', 'address', 'floors', 'units', 'project'],
  opportunity: ['title', 'fullName', 'email', 'phone', 'stage', 'estimatedValue'],
  property: ['name', 'type', 'area', 'floor', 'status', 'price'],
  service: ['service_name', 'category', 'legal_status', 'phone', 'email'],
  task: ['title', 'description', 'type', 'priority', 'status'],
};

export function getCommonFieldsForEntity(entityType: DialogEntityType): string[] {
  return ENTITY_FIELDS[entityType] || [];
}

// =============================================================================
// REQUIRED FIELDS
// =============================================================================

const ENTITY_REQUIRED_FIELDS: Record<string, string[]> = {
  contact: ['type', 'fullName', 'email'],
  company: ['company_name', 'vat_number', 'legal_form'],
  project: ['name', 'status'],
  opportunity: ['fullName', 'email', 'stage'],
};

export function getRequiredFields(entityType: DialogEntityType, _operationType: DialogOperationType): string[] {
  return ENTITY_REQUIRED_FIELDS[entityType] || [];
}

// =============================================================================
// LAYOUT TOKENS
// =============================================================================

type LayoutConfig = {
  size: SmartDialogConfiguration['layout']['size'];
  gridColumns: SmartDialogConfiguration['layout']['gridColumns'];
  spacing: SmartDialogConfiguration['layout']['spacing'];
};

const ENTITY_LAYOUT: Record<DialogEntityType, LayoutConfig> = {
  contact: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  company: { size: 'xl', gridColumns: 2, spacing: 'comfortable' },
  project: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  opportunity: { size: 'md', gridColumns: 2, spacing: 'normal' },
  building: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  property: { size: 'md', gridColumns: 2, spacing: 'normal' },
  task: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  service: { size: 'md', gridColumns: 2, spacing: 'normal' },
};

const DEFAULT_LAYOUT: LayoutConfig = { size: 'md', gridColumns: 2, spacing: 'normal' };

export function getLayoutTokens(entityType: DialogEntityType): LayoutConfig {
  return ENTITY_LAYOUT[entityType] || DEFAULT_LAYOUT;
}

// =============================================================================
// VALIDATION RULES
// =============================================================================

/* eslint-disable custom/no-hardcoded-strings -- i18n fallback values for validation messages */
const STANDARD_VALIDATION_RULES: Record<string, ValidationRule> = {
  email: { type: 'email', message: i18n.t('validation.email_invalid', 'Παρακαλώ εισάγετε έγκυρη διεύθυνση email') },
  phone: { type: 'phone', message: i18n.t('validation.phone_invalid', 'Παρακαλώ εισάγετε έγκυρο τηλέφωνο') },
  vat_number: { type: 'pattern', message: i18n.t('validation.vat_invalid', 'Παρακαλώ εισάγετε έγκυρο ΑΦΜ'), options: { pattern: '^[0-9]{9}$' } },
};
/* eslint-enable custom/no-hardcoded-strings */

export function getValidationRules(): Record<string, ValidationRule> {
  return STANDARD_VALIDATION_RULES;
}

export function getFieldValidationRule(fieldName: string): ValidationRule | undefined {
  return STANDARD_VALIDATION_RULES[fieldName];
}

// =============================================================================
// FIELD TYPE INFERENCE
// =============================================================================

const FIELD_TYPE_MAP: Record<string, SmartDialogField['type']> = {
  email: 'input',
  phone: 'input',
  notes: 'textarea',
  description: 'textarea',
  status: 'select',
  type: 'select',
  category: 'select',
  stage: 'select',
  legal_form: 'select',
  company: 'select',
  project: 'select',
  building: 'select',
  floor: 'select',
};

export function inferFieldType(fieldName: string): SmartDialogField['type'] {
  if (fieldName.includes('date') || fieldName.includes('Date')) return 'date';
  if (fieldName.includes('file') || fieldName.includes('File')) return 'file';
  if (fieldName.includes('check') || fieldName.includes('enabled') || fieldName.includes('has_')) return 'checkbox';
  return FIELD_TYPE_MAP[fieldName] || 'input';
}

// =============================================================================
// FIELD LABELS
// =============================================================================

export function getFieldLabels(entityType: DialogEntityType): Record<string, string> {
  switch (entityType) {
    case 'company': return getCompanyFieldLabels();
    case 'service': return getServiceFieldLabels();
    case 'contact': return getContactTypeLabels();
    default: return {};
  }
}

export function getFallbackLabel(fieldName: string): string {
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');
}

// =============================================================================
// PLACEHOLDERS
// =============================================================================

const FIELD_PLACEHOLDER_MAP: Record<string, string> = {
  company: DROPDOWN_PLACEHOLDERS.SELECT_COMPANY,
  project: DROPDOWN_PLACEHOLDERS.SELECT_PROJECT,
  building: DROPDOWN_PLACEHOLDERS.SELECT_BUILDING,
  unit: DROPDOWN_PLACEHOLDERS.SELECT_UNIT,
  client: DROPDOWN_PLACEHOLDERS.SELECT_CLIENT,
  general: DROPDOWN_PLACEHOLDERS.GENERIC_SELECT,
  encoding: DROPDOWN_PLACEHOLDERS.SELECT_ENCODING,
};

export function getPlaceholder(fieldName: string): string | undefined {
  return FIELD_PLACEHOLDER_MAP[fieldName] || VOCAB_PLACEHOLDERS.default;
}

// =============================================================================
// FIELD OPTIONS
// =============================================================================

export function getFieldOptions(
  fieldName: string,
  entityType: DialogEntityType
): ReadonlyArray<{ value: string; label: string }> | undefined {
  if (fieldName === 'status' && entityType === 'project') {
    // 🔴 ADR-812 — Η ΠΗΓΗ ΕΙΝΑΙ ΤΟ ΥΠΟΣΥΝΟΛΟ ΦΟΡΜΑΣ, ΟΧΙ ΤΑ ΚΛΕΙΔΙΑ ΤΩΝ ΕΤΙΚΕΤΩΝ.
    // Μέχρι 2026-08-26 έγραφε `Object.entries(getProjectStatusLabels())`, δηλαδή
    // «ό,τι έχει ετικέτα είναι και επιλέξιμο». Ήταν ήδη λάθος (πρόσφερε
    // `review`/`approved`) και θα γινόταν χειρότερο τη στιγμή που ο πίνακας
    // ετικετών απέκτησε το `deleted`: το dropdown θα πρόσφερε «Στον κάδο» ως
    // επιλογή δημιουργίας. Το soft-delete είναι ΕΝΕΡΓΕΙΑ (ADR-028).
    // Οι ετικέτες απαντούν «πώς λέγεται», ΠΟΤΕ «τι επιτρέπεται».
    const labels = getProjectStatusLabels();
    return ACTIVE_PROJECT_STATUSES.map(value => ({ value, label: labels[value] }));
  }
  return undefined;
}

// =============================================================================
// OPERATION & ACTION MAPPINGS
// =============================================================================

const PRIMARY_ACTION_VARIANTS: Record<DialogOperationType, SmartDialogAction['variant']> = {
  create: 'default',
  edit: 'default',
  update: 'default',
  delete: 'destructive',
  archive: 'secondary',
  select: 'default',
  duplicate: 'outline',
  import: 'default',
  export: 'outline',
  preview: 'ghost',
  approve: 'default',
};

export function getPrimaryActionVariant(operationType: DialogOperationType): SmartDialogAction['variant'] {
  return PRIMARY_ACTION_VARIANTS[operationType] || 'default';
}

const ACTION_BUTTON_KEY_MAP: Record<DialogOperationType, string> = {
  create: 'create',
  edit: 'update',
  update: 'update',
  delete: 'delete',
  archive: 'archive',
  select: 'select',
  duplicate: 'duplicate',
  import: 'import',
  export: 'export',
  preview: 'close',
  approve: 'approve',
};

export function getActionLabels(operationType: DialogOperationType) {
  const buttonKey = ACTION_BUTTON_KEY_MAP[operationType];
  const primary = i18n.t(`dialogs.actionButtons.${buttonKey}`, { ns: 'common' });
  const secondary = operationType === 'approve'
    ? i18n.t('dialogs.actionButtons.reject', { ns: 'common' })
    : i18n.t('dialogs.actionButtons.cancel', { ns: 'common' });
  return { primary, secondary };
}


type DialogCopyOverrides = {
  header?: Partial<SmartDialogConfiguration['header']>;
  actions?: Partial<SmartDialogConfiguration['actions']>;
  body?: string;
};

/**
 * 🏛️ **ΕΝΑΣ ΔΙΑΛΟΓΟΣ ΑΠΟΡΡΙΨΗΣ ΕΠΑΦΗΣ** (N.0.2 · CHECK 3.28).
 *
 * Οι δύο παραλλαγές — «στα σκουπίδια» και «οριστική διαγραφή» — έθεταν **το ίδιο
 * ερώτημα με δύο σώματα**: ταυτόσημη δομή κεφαλίδας/ενεργειών, ταυτόσημο δευτερεύον
 * κουμπί, και **μόνη** διαφορά δύο κλειδιά i18n.
 *
 * ⚠️ **ΤΟ `destructive` ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ ΚΑΝΟΝΑ, ΟΧΙ ΤΗΣ ΠΑΡΑΛΛΑΓΗΣ**: και οι δύο
 * πράξεις χάνουν δεδομένα από τη σκοπιά του ανθρώπου που τις βλέπει. Ένας τρίτος
 * καλών που ξεχνούσε αυτή τη γραμμή θα ζωγράφιζε **ουδέτερο** κουμπί πάνω σε
 * καταστροφική πράξη — ακριβώς η βλάβη που ένα κοινό σώμα κάνει αδύνατη.
 */
function contactDeleteDialogCopy(dialogKey: string, primaryLabelKey: string): DialogCopyOverrides {
  return {
    header: {
      title: i18n.t(`trash.${dialogKey}.title`, { ns: 'contacts' }),
      description: i18n.t(`trash.${dialogKey}.description`, { ns: 'contacts' }),
    },
    actions: {
      primary: {
        key: 'submit',
        label: i18n.t(primaryLabelKey, { ns: 'contacts' }),
        variant: 'destructive',
      },
      secondary: {
        key: 'cancel',
        label: i18n.t('dialog.cancel', { ns: 'contacts' }),
        variant: 'outline',
      },
    },
    body: i18n.t(`trash.${dialogKey}.body`, { ns: 'contacts' }),
  };
}

export function getDialogCopyOverrides(
  entityType: DialogEntityType,
  operationType: DialogOperationType,
  copyVariant: DialogCopyVariant = 'default'
): DialogCopyOverrides {
  if (copyVariant === 'contactSoftDelete' && entityType === 'contact' && operationType === 'delete') {
    return contactDeleteDialogCopy('softDeleteDialog', 'trash.moveToTrash');
  }

  if (copyVariant === 'contactPermanentDelete' && entityType === 'contact' && operationType === 'delete') {
    return contactDeleteDialogCopy('permanentDeleteDialog', 'trash.permanentDelete');
  }

  return {};
}

// =============================================================================
// THEME & STYLING
// =============================================================================

export function getThemeForEntity(entityType: DialogEntityType): SmartDialogConfiguration['styling']['theme'] {
  if (entityType === 'building' || entityType === 'property') return 'dxf_technical';
  return 'default';
}

// =============================================================================
// DIALOG SIZE CLASSES
// =============================================================================

const DIALOG_SIZE_CLASSES: Record<string, string> = {
  sm: 'sm:max-w-[425px]',
  md: 'sm:max-w-[625px]',
  lg: 'sm:max-w-[800px]',
  xl: 'sm:max-w-[1000px]',
  full: 'sm:max-w-[90vw]',
};

export function getDialogSizeClass(size: 'sm' | 'md' | 'lg' | 'xl' | 'full'): string {
  return DIALOG_SIZE_CLASSES[size];
}
