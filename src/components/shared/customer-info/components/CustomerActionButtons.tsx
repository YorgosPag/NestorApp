'use client';

/**
 * 🔘 CUSTOMER ACTION BUTTONS COMPONENT
 *
 * Κεντρικοποιημένα action buttons για customer interactions
 * Enterprise-class component με context-aware actions
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import Link from 'next/link';
import {
  Eye,
  Phone,
  Mail,
  MessageSquare,
  Edit,
  RefreshCw,
  History,
  FileText,
  StickyNote,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type {
  CustomerActionButtonsProps,
  CustomerAction,
  CustomerActionType,
  CustomerInfoContext
} from '../types/CustomerInfoTypes';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('CustomerActionButtons');

// ============================================================================
// ACTION DEFINITIONS (moved inside component for i18n access)
// ============================================================================

// 🏢 ENTERPRISE: Action definitions factory - accepts t() for i18n support

/**
 * Default actions για κάθε context
 * Χρησιμοποιεί την κεντρικοποιημένη configuration
 */
const getDefaultContextActions = (context: CustomerInfoContext): CustomerActionType[] => {
  const defaultActions: Record<CustomerInfoContext, CustomerActionType[]> = {
    unit: ['view', 'call', 'email', 'reassign'],
    building: ['view', 'call', 'email', 'history'],
    project: ['view', 'call', 'email', 'history'],
    contact: ['call', 'email', 'edit', 'documents'],
    dashboard: ['view'],
    search: ['view', 'call']
  };

  return defaultActions[context];
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Κεντρικοποιημένα action buttons για customer interactions
 * Context-aware με smart defaults και customization options
 */
export function CustomerActionButtons({
  customerInfo,
  context,
  actions: customActions,
  disabledActions = [],
  size = 'sm',
  direction = 'horizontal',
  iconsOnly = false
}: CustomerActionButtonsProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  // ========================================================================
  // ACTION DEFINITIONS (inside component for i18n access)
  // ========================================================================

  const createActionDefinitions = useMemo(() => {
    const { contactId, displayName, primaryPhone, primaryEmail } = customerInfo;

    return {
      view: {
        type: 'view' as const,
        label: t('customerActions.view'),
        icon: Eye,
        variant: 'outline' as const,
        onClick: () => {
          window.open(`/contacts?contactId=${contactId}`, '_blank');
        },
        tooltip: t('customerActions.tooltips.viewDetails', { name: displayName })
      },

      call: {
        type: 'call' as const,
        label: t('customerActions.call'),
        icon: Phone,
        variant: 'outline' as const,
        onClick: () => {
          if (primaryPhone) {
            const cleanPhone = primaryPhone.replace(/\s+/g, '');
            window.open(`tel:${cleanPhone}`, '_self');
          }
        },
        disabled: !primaryPhone,
        tooltip: primaryPhone
          ? t('customerActions.tooltips.callTo', { phone: primaryPhone })
          : t('customerActions.tooltips.noPhone')
      },

      email: {
        type: 'email' as const,
        label: t('customerActions.email'),
        icon: Mail,
        variant: 'outline' as const,
        onClick: () => {
          if (primaryEmail) {
            window.open(`mailto:${primaryEmail}`, '_self');
          }
        },
        disabled: !primaryEmail,
        tooltip: primaryEmail
          ? t('customerActions.tooltips.emailTo', { email: primaryEmail })
          : t('customerActions.tooltips.noEmail')
      },

      message: {
        type: 'message' as const,
        label: t('customerActions.message'),
        icon: MessageSquare,
        variant: 'outline' as const,
        onClick: () => {
          if (primaryPhone) {
            const cleanPhone = primaryPhone.replace(/\s+/g, '');
            window.open(`sms:${cleanPhone}`, '_self');
          }
        },
        disabled: !primaryPhone,
        tooltip: primaryPhone
          ? t('customerActions.tooltips.smsTo', { phone: primaryPhone })
          : t('customerActions.tooltips.noPhoneForSms')
      },

      edit: {
        type: 'edit' as const,
        label: t('customerActions.edit'),
        icon: Edit,
        variant: 'outline' as const,
        onClick: () => {
          window.open(`/contacts?contactId=${contactId}&edit=true`, '_blank');
        },
        tooltip: t('customerActions.tooltips.editDetails', { name: displayName })
      },

      reassign: {
        type: 'reassign' as const,
        label: context === 'unit' ? t('customerActions.changeUnit') : t('customerActions.reassign'),
        icon: RefreshCw,
        variant: 'outline' as const,
        onClick: () => {
          logger.info('Reassign action triggered', { contactId });
          // TODO: Implement reassignment logic
        },
        tooltip: t('customerActions.tooltips.reassignFor', { name: displayName })
      },

      history: {
        type: 'history' as const,
        label: t('customerActions.history'),
        icon: History,
        variant: 'ghost' as const,
        onClick: () => {
          window.open(`/contacts?contactId=${contactId}&tab=history`, '_blank');
        },
        tooltip: t('customerActions.tooltips.viewHistory', { name: displayName })
      },

      documents: {
        type: 'documents' as const,
        label: t('customerActions.documents'),
        icon: FileText,
        variant: 'ghost' as const,
        onClick: () => {
          window.open(`/contacts?contactId=${contactId}&tab=documents`, '_blank');
        },
        tooltip: t('customerActions.tooltips.viewDocuments', { name: displayName })
      },

      notes: {
        type: 'notes' as const,
        label: t('customerActions.notes'),
        icon: StickyNote,
        variant: 'ghost' as const,
        onClick: () => {
          window.open(`/contacts?contactId=${contactId}&tab=notes`, '_blank');
        },
        tooltip: t('customerActions.tooltips.viewNotes', { name: displayName })
      }
    };
  }, [customerInfo, context, t]);

  // ========================================================================
  // COMPUTED ACTIONS
  // ========================================================================

  const actionDefinitions = createActionDefinitions;

  const finalActions = useMemo(() => {
    // Use custom actions if provided, otherwise use context defaults
    const actionTypes = customActions
      ? customActions.map(action => action.type)
      : getDefaultContextActions(context);

    return actionTypes
      .filter(type => !disabledActions.includes(type))
      .map(type => customActions?.find(a => a.type === type) || actionDefinitions[type])
      .filter(Boolean);
  }, [customActions, context, disabledActions, actionDefinitions]);

  // ========================================================================
  // STYLING
  // ========================================================================

  const sizeClasses = {
    sm: iconsOnly ? `${iconSizes.xl} p-0` : 'h-8 text-xs px-2',
    md: iconsOnly ? 'h-9 w-9 p-0' : 'h-9 text-sm px-3',
    lg: iconsOnly ? `${iconSizes['2xl']} p-0` : 'h-10 text-base px-4'
  };

  const containerClasses = direction === 'horizontal'
    ? 'flex items-center gap-1'
    : 'flex flex-col gap-1';

  const iconSize = size === 'lg' ? iconSizes.md : iconSizes.sm;

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const renderActionButton = (action: CustomerAction, index: number) => {
    const buttonContent = (
      <Button
        key={`${action.type}-${index}`}
        variant={action.variant || 'outline'}
        size="sm"
        disabled={action.disabled || action.loading}
        onClick={action.onClick}
        className={`
          ${sizeClasses[size]}
          ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY}
          ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <action.icon className={iconSize} />
        {!iconsOnly && (
          <span className="ml-1">{action.label}</span>
        )}
      </Button>
    );

    // Wrap με tooltip αν έχουμε tooltip text
    if (action.tooltip) {
      return (
          <Tooltip key={`${action.type}-${index}`}>
            <TooltipTrigger asChild>
              {buttonContent}
            </TooltipTrigger>
            <TooltipContent>
              <p>{action.tooltip}</p>
            </TooltipContent>
          </Tooltip>
      );
    }

    return buttonContent;
  };

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  if (finalActions.length === 0) {
    return null;
  }

  // Special handling για single primary action (π.χ. unit context)
  if (context === 'unit' && finalActions.length === 1 && finalActions[0]?.type === 'view') {
    return (
      <Link href={`/contacts?contactId=${customerInfo.contactId}`} className="inline-block">
        <Button
          variant="ghost"
          size="sm"
          className={`
            ${sizeClasses[size]}
            ${INTERACTIVE_PATTERNS.LINK_PRIMARY}
          `}
        >
          <ArrowRight className={iconSize} />
          {!iconsOnly && <span className="ml-1">{t('customerActions.viewCustomer')}</span>}
        </Button>
      </Link>
    );
  }

  return (
    <nav className={containerClasses} role="group" aria-label={t('customerActions.aria.customerActions')}>
      {finalActions.map((action, index) => renderActionButton(action, index))}
    </nav>
  );
}