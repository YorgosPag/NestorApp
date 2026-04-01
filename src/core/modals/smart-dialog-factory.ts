/**
 * =============================================================================
 * SMART DIALOG FACTORY - React Component Generator
 * =============================================================================
 *
 * Creates React dialog components using SmartDialogEngine configurations.
 *
 * @module core/modals/smart-dialog-factory
 */

import * as React from 'react';
import { i18n } from '@/i18n';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  DialogEntityType,
  DialogOperationType,
  DialogEntityProps,
  SmartDialogProps,
} from './smart-dialog-types';
import { smartDialogEngine } from './SmartDialogEngine';
import { getDialogSizeClass } from './smart-dialog-config';

const logger = createModuleLogger('SmartDialogFactory');

// =============================================================================
// SMART DIALOG COMPONENT FACTORY
// =============================================================================

export function createSmartDialog(config: {
  entityType: DialogEntityType;
  operationType: DialogOperationType;
  props?: SmartDialogProps;
}): React.ReactElement {
  const { entityType, operationType, props = {} } = config;
  const dialogConfig = smartDialogEngine.createDialogConfiguration(entityType, operationType);

  return React.createElement(
    Dialog,
    { open: props.open, onOpenChange: props.onOpenChange },
    React.createElement(
      DialogContent,
      { className: getDialogSizeClass(dialogConfig.layout.size) },
      [
        // Header
        React.createElement(
          DialogHeader,
          { key: 'header' },
          [
            React.createElement(DialogTitle, { key: 'title' }, dialogConfig.header.title),
            React.createElement(DialogDescription, { key: 'description' }, dialogConfig.header.description),
          ]
        ),

        // Content
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-4' },
          getContentForEntity(entityType, operationType, props)
        ),

        // Footer
        React.createElement(
          DialogFooter,
          { key: 'footer' },
          [
            React.createElement(
              Button,
              { key: 'cancel', variant: 'ghost', onClick: () => props.onOpenChange?.(false) },
              dialogConfig.actions.secondary.label
            ),
            React.createElement(
              Button,
              {
                key: 'primary',
                variant: dialogConfig.actions.primary.variant,
                onClick: () => handlePrimaryAction(entityType, operationType, props),
              },
              dialogConfig.actions.primary.label
            ),
          ]
        ),
      ]
    )
  );
}

// =============================================================================
// CONTENT GENERATION
// =============================================================================

function getContentForEntity(
  entityType: DialogEntityType,
  operationType: DialogOperationType,
  props: DialogEntityProps
): React.ReactElement {
  if (operationType === 'delete' || operationType === 'archive') {
    const operationTitle = i18n.t(`dialogs.operations.${operationType}.title`, { ns: 'common' });
    const entitySingular = i18n.t(`dialogs.entities.${entityType}.singular`, { ns: 'common' });
    const entityDisplayName = getEntityDisplayName(props);

    return React.createElement(
      'div',
      { className: 'text-center py-4' },
      `${operationTitle} ${entitySingular.toLowerCase()} - ${entityDisplayName}`
    );
  }

  return React.createElement(
    'div',
    { className: 'space-y-4' },
    React.createElement(
      'p',
      { className: 'text-muted-foreground' },
      // eslint-disable-next-line custom/no-hardcoded-strings
      `Smart Factory form για ${entityType} ${operationType} - Configuration από Smart Dialog Engine`
    )
  );
}

// =============================================================================
// ACTION HANDLING
// =============================================================================

function handlePrimaryAction(
  entityType: DialogEntityType,
  operationType: DialogOperationType,
  props: DialogEntityProps
): void {
  logger.info(`Smart Factory: ${operationType} ${entityType}`);

  if (props.onSubmit) {
    props.onSubmit({});
  } else if (props.onContactAdded) {
    props.onContactAdded();
  } else if (props.onContactsDeleted) {
    props.onContactsDeleted();
  } else if (props.onContactsArchived) {
    props.onContactsArchived();
  } else if (props.onPropertyAdded) {
    props.onPropertyAdded();
  } else if (props.onTaskCreated) {
    props.onTaskCreated();
  } else if (props.onCompanySelected && props.contact) {
    props.onCompanySelected(props.contact);
  }

  props.onOpenChange?.(false);
}

// =============================================================================
// HELPERS
// =============================================================================

function getEntityDisplayName(props: DialogEntityProps): string {
  if (props.contact?.name) return props.contact.name;
  if (props.contact?.firstName && props.contact.lastName) {
    return `${props.contact.firstName} ${props.contact.lastName}`;
  }
  if (props.contact?.companyName) return props.contact.companyName;
  return 'Entity';
}
