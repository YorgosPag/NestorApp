/**
 * =============================================================================
 * SMART DIALOG ENGINE - Enterprise Configuration Factory
 * =============================================================================
 *
 * Singleton engine that generates intelligent dialog configurations
 * using centralized systems for complete consistency.
 *
 * @module core/modals/SmartDialogEngine
 * @enterprise ZERO DUPLICATES - All config from centralized systems
 */

import type * as React from 'react';
import { i18n } from '@/i18n';
import type {
  DialogCopyVariant,
  DialogEntityType,
  DialogOperationType,
  SmartDialogConfiguration,
  SmartDialogField,
} from './smart-dialog-types';
import {
  getCommonFieldsForEntity,
  getRequiredFields,
  getLayoutTokens,
  getValidationRules,
  getFieldValidationRule,
  inferFieldType,
  getFieldLabels,
  getFallbackLabel,
  getPlaceholder,
  getFieldOptions,
  getPrimaryActionVariant,
  getActionLabels,
  getDialogCopyOverrides,
  getThemeForEntity,
} from './smart-dialog-config';

// =============================================================================
// RE-EXPORTS for backward compatibility (barrel pattern)
// =============================================================================

export type {
  DialogCopyVariant,
  DialogEntityType,
  DialogOperationType,
  SmartDialogConfiguration,
  SmartDialogField,
  SmartDialogAction,
  ValidationRule,
  SmartDialogEngineState,
} from './smart-dialog-types';

export { createSmartDialog } from './smart-dialog-factory';

// =============================================================================
// ENGINE CLASS - Singleton Pattern
// =============================================================================

/**
 * 🛡️ **Η ΕΤΙΚΕΤΑ ΠΕΔΙΟΥ ΔΕΝ ΒΓΑΙΝΕΙ ΠΟΤΕ ΩΜΟ ΚΛΕΙΔΙ** (ADR-804 §3).
 *
 * 🔑 **Ο ΚΑΤΑΛΟΓΟΣ ΕΤΙΚΕΤΩΝ ΕΧΕΙ ΔΥΟ ΣΥΜΒΟΛΑΙΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ**: άλλες
 * εγγραφές δίνουν **έτοιμο κείμενο** (παλιό, σκληρά ελληνικά) και άλλες **i18n κλειδί**
 * (μεταναστευμένο). Πριν από αυτή τη συνάρτηση η τιμή πήγαινε **κατευθείαν** στην οθόνη,
 * οπότε κάθε μεταναστευμένη εγγραφή ζωγράφιζε το κλειδί της: μετρημένα **25** για τον
 * τύπο `service` και **3** για τον `contact`, ζωντανά, πριν αγγίξει κανείς τίποτα.
 *
 * ⚠️ **ΤΑ NAMESPACES ΕΙΝΑΙ ΠΕΡΙΣΣΟΤΕΡΑ ΑΠΟ ΕΝΑ, ΚΑΙ ΜΕΤΡΗΘΗΚΑΝ**: τα κλειδιά της
 * εταιρείας ζουν στο `forms` (**56/56** λύνονται), του τύπου επαφής στο `common-shared`.
 * Ένα καρφωμένο `ns` θα άφηνε τη μισή οθόνη ωμή.
 *
 * ⚠️ **fail-safe, ΜΕ ΣΕΙΡΑ**: μεταφρασμένο ⇒ κείμενο· αμετάφραστο **που μοιάζει κλειδί**
 * ⇒ ανθρώπινο όνομα πεδίου (**ποτέ** το κλειδί)· αμετάφραστο που **δεν** μοιάζει κλειδί
 * ⇒ είναι ήδη κείμενο, πέρασέ το. Έτσι καμία από τις δύο εποχές δεν σπάει την οθόνη.
 * ⚠️ Το `defaultValue` είναι **κενή συμβολοσειρά** επίτηδες — literal κείμενο εκεί
 * απαγορεύεται από τον κανόνα N.11 (i18n SSoT).
 */
const FIELD_LABEL_NAMESPACES = ['forms', 'common-shared', 'common'] as const;
/** Μοτίβο i18n κλειδιού: `tmima.tmima[.tmima]` χωρίς κενά/τόνους. */
const LOOKS_LIKE_I18N_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/;

function resolveFieldLabel(raw: string | undefined, fieldName: string): string {
  if (!raw) return getFallbackLabel(fieldName);
  const translated = i18n.t(raw, { ns: FIELD_LABEL_NAMESPACES, defaultValue: '' });
  if (translated) return translated;
  return LOOKS_LIKE_I18N_KEY.test(raw) ? getFallbackLabel(fieldName) : raw;
}

export class SmartDialogEngine {
  private static readonly instance = new SmartDialogEngine();
  private constructor() {}

  public static getInstance(): SmartDialogEngine {
    return SmartDialogEngine.instance;
  }

  /**
   * Main factory method - creates dialog configuration from entity + operation
   */
  public createDialogConfiguration(
    entityType: DialogEntityType,
    operationType: DialogOperationType,
    options?: Partial<SmartDialogConfiguration>,
    copyVariant: DialogCopyVariant = 'default'
  ): SmartDialogConfiguration {
    const baseConfig = this.generateBaseConfiguration(entityType, operationType);
    const customizedConfig = this.applyIntelligentCustomizations(baseConfig, operationType);
    const copyAdjustedConfig = this.applyCopyOverrides(
      customizedConfig,
      getDialogCopyOverrides(entityType, operationType, copyVariant)
    );
    return this.mergeConfigurations(copyAdjustedConfig, options || {});
  }

  // ==========================================================================
  // BASE CONFIGURATION GENERATION
  // ==========================================================================

  private generateBaseConfiguration(
    entityType: DialogEntityType,
    operationType: DialogOperationType
  ): SmartDialogConfiguration {
    return {
      entityType,
      operationType,
      header: this.generateHeader(entityType, operationType),
      fields: this.generateFields(entityType, operationType),
      actions: this.generateActions(operationType),
      layout: getLayoutTokens(entityType),
      validation: {
        required: getRequiredFields(entityType, operationType),
        rules: getValidationRules(),
      },
      styling: {
        theme: getThemeForEntity(entityType),
        variant: 'modal',
      },
    };
  }

  // ==========================================================================
  // HEADER GENERATION (i18n)
  // ==========================================================================

  private generateHeader(
    entityType: DialogEntityType,
    operationType: DialogOperationType
  ): SmartDialogConfiguration['header'] {
    const entityLabels = this.getEntityLabels(entityType);
    const operationLabels = this.getOperationLabels(operationType);

    return {
      title: `${operationLabels.title} ${entityLabels.singular}`,
      description: `${operationLabels.description} ${entityLabels.articleWithSingular}.`,
      icon: undefined,
    };
  }

  private getEntityLabels(entityType: DialogEntityType) {
    return {
      singular: i18n.t(`dialogs.entities.${entityType}.singular`, { ns: 'common' }),
      article: i18n.t(`dialogs.entities.${entityType}.article`, { ns: 'common' }),
      plural: i18n.t(`dialogs.entities.${entityType}.plural`, { ns: 'common' }),
      articleWithSingular: i18n.t(`dialogs.entities.${entityType}.articleWithSingular`, { ns: 'common' }),
    };
  }

  private getOperationLabels(operationType: DialogOperationType) {
    return {
      title: i18n.t(`dialogs.operations.${operationType}.title`, { ns: 'common' }),
      description: i18n.t(`dialogs.operations.${operationType}.description`, { ns: 'common' }),
    };
  }

  // ==========================================================================
  // FIELD GENERATION
  // ==========================================================================

  private generateFields(
    entityType: DialogEntityType,
    operationType: DialogOperationType
  ): ReadonlyArray<SmartDialogField> {
    const fieldLabels = getFieldLabels(entityType);
    const commonFields = getCommonFieldsForEntity(entityType);

    return commonFields.map((fieldName) => ({
      name: fieldName,
      type: inferFieldType(fieldName),
      label: resolveFieldLabel(fieldLabels[fieldName], fieldName),
      placeholder: getPlaceholder(fieldName),
      required: getRequiredFields(entityType, operationType).includes(fieldName),
      options: getFieldOptions(fieldName, entityType),
      validation: getFieldValidationRule(fieldName),
    }));
  }

  // ==========================================================================
  // ACTIONS GENERATION (i18n)
  // ==========================================================================

  private generateActions(
    operationType: DialogOperationType
  ): SmartDialogConfiguration['actions'] {
    const actionLabels = getActionLabels(operationType);

    return {
      primary: {
        key: 'submit',
        label: actionLabels.primary,
        variant: getPrimaryActionVariant(operationType),
        icon: undefined as React.ComponentType<{ className?: string }> | undefined,
      },
      secondary: {
        key: 'cancel',
        label: i18n.t('dialogs.actionButtons.cancel', { ns: 'common' }),
        variant: 'outline',
      },
    };
  }

  // ==========================================================================
  // INTELLIGENT CUSTOMIZATIONS
  // ==========================================================================

  private applyIntelligentCustomizations(
    baseConfig: SmartDialogConfiguration,
    operationType: DialogOperationType
  ): SmartDialogConfiguration {
    if (operationType === 'delete') {
      return {
        ...baseConfig,
        fields: [],
        actions: {
          ...baseConfig.actions,
          primary: {
            ...baseConfig.actions.primary,
            variant: 'destructive',
          },
        },
      };
    }

    if (operationType === 'archive') {
      return {
        ...baseConfig,
        fields: [
          ...baseConfig.fields,
          {
            name: 'reason',
            type: 'textarea',
            label: 'Λόγος Αρχειοθέτησης',
            placeholder: 'Εισάγετε τον λόγο αρχειοθέτησης...',
            required: false,
          },
        ],
      };
    }

    return baseConfig;
  }

  private applyCopyOverrides(
    baseConfig: SmartDialogConfiguration,
    overrides: {
      header?: Partial<SmartDialogConfiguration['header']>;
      actions?: Partial<SmartDialogConfiguration['actions']>;
      body?: string;
    }
  ): SmartDialogConfiguration {
    return {
      ...baseConfig,
      body: overrides.body ?? baseConfig.body,
      header: {
        ...baseConfig.header,
        ...overrides.header,
      },
      actions: {
        ...baseConfig.actions,
        ...overrides.actions,
        primary: {
          ...baseConfig.actions.primary,
          ...overrides.actions?.primary,
        },
        secondary: {
          ...baseConfig.actions.secondary,
          ...overrides.actions?.secondary,
        },
      },
    };
  }

  // ==========================================================================
  // CONFIGURATION MERGE
  // ==========================================================================

  private mergeConfigurations(
    baseConfig: SmartDialogConfiguration,
    customOptions: Partial<SmartDialogConfiguration>
  ): SmartDialogConfiguration {
    return {
      ...baseConfig,
      ...customOptions,
      header: { ...baseConfig.header, ...customOptions.header },
      actions: { ...baseConfig.actions, ...customOptions.actions },
      layout: { ...baseConfig.layout, ...customOptions.layout },
      validation: { ...baseConfig.validation, ...customOptions.validation },
      styling: { ...baseConfig.styling, ...customOptions.styling },
      fields: customOptions.fields || baseConfig.fields,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const smartDialogEngine = SmartDialogEngine.getInstance();

/**
 * Legacy compatibility function
 */
export function createDialogConfiguration(
  entityType: DialogEntityType,
  operationType: DialogOperationType,
  customizations?: Partial<SmartDialogConfiguration>
): SmartDialogConfiguration {
  return smartDialogEngine.createDialogConfiguration(entityType, operationType, customizations);
}
