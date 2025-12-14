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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

import type {
  CustomerActionButtonsProps,
  CustomerAction,
  CustomerActionType,
  CustomerInfoContext,
  DEFAULT_CONTEXT_ACTIONS
} from '../types/CustomerInfoTypes';

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

/**
 * Κεντρικοποιημένες action definitions
 * Χρησιμοποιεί existing UI patterns για consistency
 */
const createActionDefinitions = (
  customerInfo: CustomerActionButtonsProps['customerInfo'],
  context: CustomerInfoContext
): Record<CustomerActionType, CustomerAction> => {
  const { contactId, displayName, primaryPhone, primaryEmail } = customerInfo;

  return {
    view: {
      type: 'view',
      label: 'Προβολή',
      icon: Eye,
      variant: 'outline',
      onClick: () => {
        window.open(`/contacts?contactId=${contactId}`, '_blank');
      },
      tooltip: `Προβολή στοιχείων του ${displayName}`
    },

    call: {
      type: 'call',
      label: 'Κλήση',
      icon: Phone,
      variant: 'outline',
      onClick: () => {
        if (primaryPhone) {
          const cleanPhone = primaryPhone.replace(/\s+/g, '');
          window.open(`tel:${cleanPhone}`, '_self');
        }
      },
      disabled: !primaryPhone,
      tooltip: primaryPhone
        ? `Κλήση στο ${primaryPhone}`
        : 'Δεν είναι διαθέσιμο τηλέφωνο'
    },

    email: {
      type: 'email',
      label: 'Email',
      icon: Mail,
      variant: 'outline',
      onClick: () => {
        if (primaryEmail) {
          window.open(
            `mailto:${primaryEmail}?subject=Επικοινωνία από Nestor App&body=Αγαπητέ/ή ${displayName},`,
            '_self'
          );
        }
      },
      disabled: !primaryEmail,
      tooltip: primaryEmail
        ? `Email στο ${primaryEmail}`
        : 'Δεν είναι διαθέσιμο email'
    },

    message: {
      type: 'message',
      label: 'Μήνυμα',
      icon: MessageSquare,
      variant: 'outline',
      onClick: () => {
        if (primaryPhone) {
          const cleanPhone = primaryPhone.replace(/\s+/g, '');
          window.open(`sms:${cleanPhone}`, '_self');
        }
      },
      disabled: !primaryPhone,
      tooltip: primaryPhone
        ? `SMS στο ${primaryPhone}`
        : 'Δεν είναι διαθέσιμο τηλέφωνο για SMS'
    },

    edit: {
      type: 'edit',
      label: 'Επεξεργασία',
      icon: Edit,
      variant: 'outline',
      onClick: () => {
        window.open(`/contacts?contactId=${contactId}&edit=true`, '_blank');
      },
      tooltip: `Επεξεργασία στοιχείων του ${displayName}`
    },

    reassign: {
      type: 'reassign',
      label: context === 'unit' ? 'Αλλαγή Μονάδας' : 'Ανακατανομή',
      icon: RefreshCw,
      variant: 'outline',
      onClick: () => {
        console.log(`Reassign action για πελάτη ${contactId}`);
        // TODO: Implement reassignment logic
      },
      tooltip: `Αλλαγή κατανομής για ${displayName}`
    },

    history: {
      type: 'history',
      label: 'Ιστορικό',
      icon: History,
      variant: 'ghost',
      onClick: () => {
        window.open(`/contacts?contactId=${contactId}&tab=history`, '_blank');
      },
      tooltip: `Προβολή ιστορικού του ${displayName}`
    },

    documents: {
      type: 'documents',
      label: 'Έγγραφα',
      icon: FileText,
      variant: 'ghost',
      onClick: () => {
        window.open(`/contacts?contactId=${contactId}&tab=documents`, '_blank');
      },
      tooltip: `Προβολή εγγράφων του ${displayName}`
    },

    notes: {
      type: 'notes',
      label: 'Σημειώσεις',
      icon: StickyNote,
      variant: 'ghost',
      onClick: () => {
        window.open(`/contacts?contactId=${contactId}&tab=notes`, '_blank');
      },
      tooltip: `Προβολή σημειώσεων για ${displayName}`
    }
  };
};

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
  // ========================================================================
  // COMPUTED ACTIONS
  // ========================================================================

  const actionDefinitions = useMemo(
    () => createActionDefinitions(customerInfo, context),
    [customerInfo, context]
  );

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
    sm: iconsOnly ? 'h-8 w-8 p-0' : 'h-8 text-xs px-2',
    md: iconsOnly ? 'h-9 w-9 p-0' : 'h-9 text-sm px-3',
    lg: iconsOnly ? 'h-10 w-10 p-0' : 'h-10 text-base px-4'
  };

  const containerClasses = direction === 'horizontal'
    ? 'flex items-center gap-1'
    : 'flex flex-col gap-1';

  const iconSize = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

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
        <TooltipProvider key={`${action.type}-${index}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              {buttonContent}
            </TooltipTrigger>
            <TooltipContent>
              <p>{action.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
          {!iconsOnly && <span className="ml-1">Προβολή Πελάτη</span>}
        </Button>
      </Link>
    );
  }

  return (
    <nav className={containerClasses} role="group" aria-label="Ενέργειες πελάτη">
      {finalActions.map((action, index) => renderActionButton(action, index))}
    </nav>
  );
}