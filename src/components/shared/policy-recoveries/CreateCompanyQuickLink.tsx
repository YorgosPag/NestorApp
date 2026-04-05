'use client';

/**
 * =============================================================================
 * ENTERPRISE: Recovery for POLICY_COMPANY_REQUIRED
 * =============================================================================
 *
 * Inline recovery card: lets the user create a brand-new Company from the
 * error banner, without leaving the current form. Fires whenever a project
 * creation policy rejects the payload because no Company is linked.
 *
 * Expected context: (none)
 * Returns payload: `{ companyId: string }` — parent auto-selects the new
 * company in the EntityLinkCard dropdown.
 *
 * @enterprise
 *   Zero duplication: wraps the canonical `TabbedAddNewContactDialog` with
 *   `allowedContactTypes=['company']` — exactly the same editor used on the
 *   /contacts page. Captures the new contactId via RealtimeService rather
 *   than introducing a parallel `onContactAdded(id)` overload.
 *
 * @see lib/policy/policy-recovery-registry
 * @see components/contacts/dialogs/TabbedAddNewContactDialog
 * @module components/shared/policy-recoveries/CreateCompanyQuickLink
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { RealtimeService } from '@/services/realtime';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { PolicyRecoveryContext } from '@/lib/policy';

const logger = createModuleLogger('CreateCompanyQuickLink');

export function CreateCompanyQuickLink({
  onRecovered,
}: PolicyRecoveryContext) {
  const { t } = useTranslation('building');
  const [open, setOpen] = useState(false);
  // Ref for the contactId captured via RealtimeService — avoids race with
  // onContactAdded which fires without the id.
  const newContactIdRef = useRef<string | null>(null);

  // Subscribe to CONTACT_CREATED while the dialog is open; any new contact
  // that flies by during this window is ours. Unsubscribe on close.
  useEffect(() => {
    if (!open) {
      newContactIdRef.current = null;
      return;
    }
    const unsubscribe = RealtimeService.subscribe('CONTACT_CREATED', (payload) => {
      if (payload?.contact?.type === 'company' && payload.contactId) {
        newContactIdRef.current = payload.contactId;
        logger.info('Captured new companyId via RealtimeService', { contactId: payload.contactId });
      }
    }, { checkPendingOnMount: false });
    return unsubscribe;
  }, [open]);

  const handleContactAdded = useCallback(() => {
    setOpen(false);
    const companyId = newContactIdRef.current;
    if (companyId) {
      onRecovered({ companyId });
    } else {
      // Fallback: we know a contact was created but couldn't capture the id
      // — parent still dismisses the banner and reloads options.
      logger.warn('Contact created but companyId was not captured — parent will reload only');
      onRecovered();
    }
  }, [onRecovered]);

  return (
    <>
      <aside className="flex items-center gap-2 p-2 border rounded bg-muted/40">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="text-sm flex-1">
          {t('recoveries.createCompany.hint')}
        </span>
        <Button size="sm" variant="default" onClick={() => setOpen(true)}>
          {t('recoveries.createCompany.action')}
        </Button>
      </aside>

      {/* Canonical contact editor — restricted to company type, presented as
          a right-side Sheet to stay consistent with the parent slide-over. */}
      <TabbedAddNewContactDialog
        open={open}
        onOpenChange={setOpen}
        onContactAdded={handleContactAdded}
        allowedContactTypes={['company']}
        presentation="sheet"
      />
    </>
  );
}
