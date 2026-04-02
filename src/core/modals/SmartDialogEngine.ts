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
      label: fieldLabels[fieldName] || getFallbackLabel(fieldName),
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
