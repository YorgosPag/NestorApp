'use client';

/**
 * ProfessionalsCard — 3 νομικοί ρόλοι (seller_lawyer, buyer_lawyer, notary)
 * Interactive: inline assign/change/remove via ContactSearchManager.
 *
 * Conflict validation (Greek Law):
 * - Notary + Lawyer = HARD BLOCK (Ν.2830/2000, Άρ.22§2 + Άρ.37§1)
 * - Seller Lawyer + Buyer Lawyer = WARNING (Κώδικας Δεοντολογίας, Άρ.37)
 *
 * @enterprise ADR-230 (SPEC-230D Task C)
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { User, Scale, Briefcase, Pencil, X, Loader2, UserPlus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { ENTITY_ROUTES } from '@/lib/routes';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { useNotifications } from '@/providers/NotificationProvider';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { EntityAssociationLink } from '@/types/entity-associations';
import { clientSafeFireAndForget } from '@/lib/safe-fire-and-forget';
import type { LegalContract, LegalProfessionalRole } from '@/types/legal-contracts';
import {
  notifyProfessionalAssignmentWithPolicy,
  recordPropertyActivityWithPolicy,
} from '@/services/sales/sales-legal-mutation-gateway';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  ConflictBlockDialog,
  ConflictWarningDialog,
  EmailNotifyDialog,
  type PendingAssignment,
  type PendingEmailNotification,
} from './professionals-card-dialogs';

// ============================================================================
// TYPES
// ============================================================================

interface ProfessionalsCardProps {
  /** Unit ID — used for email notification on assignment */
  propertyId: string;
  /** All contact links for this unit */
  associations: EntityAssociationLink[];
  /** Draft contracts — to sync professional snapshots */
  contracts: LegalContract[];
  /** Add a new contact link (role → Firestore contact_links) */
  onAssign: (contactId: string, role: string) => Promise<boolean>;
  /** Remove a contact link by linkId */
  onRemove: (linkId: string) => Promise<boolean>;
  /** Override professional snapshot on a contract */
  onOverrideProfessional: (
    contractId: string,
    role: LegalProfessionalRole,
    contactId: string | null
  ) => Promise<{ success: boolean; error?: string }>;
}

interface ProfessionalSlot {
  role: LegalProfessionalRole;
  labelKey: string;
  defaultLabel: string;
  icon: React.ElementType;
}

const SLOTS: ProfessionalSlot[] = [
  { role: 'seller_lawyer', labelKey: 'sales.legal.sellerLawyer', defaultLabel: 'Δικηγόρος Πωλητή', icon: Briefcase },
  { role: 'buyer_lawyer', labelKey: 'sales.legal.buyerLawyer', defaultLabel: 'Δικηγόρος Αγοραστή', icon: Briefcase },
  { role: 'notary', labelKey: 'sales.legal.notary', defaultLabel: 'Συμβολαιογράφος', icon: Scale },
];

const LAWYER_ROLES: LegalProfessionalRole[] = ['seller_lawyer', 'buyer_lawyer'];

/** Only draft contracts get professional overrides */
function getDraftContracts(contracts: LegalContract[]): LegalContract[] {
  return contracts.filter((c) => c.status === 'draft');
}

// ============================================================================
// CONFLICT VALIDATION — Greek Law
// ============================================================================

/**
 * Rules (Greek Law):
 * 1. Notary + Lawyer (either) = HARD BLOCK
 *    Ν.2830/2000 Άρ.22§2 + Άρ.37§1.
 * 2. Seller Lawyer + Buyer Lawyer = WARNING
 *    Κώδικας Δεοντολογίας Δικηγόρων Άρ.37.
 */
function detectConflict(
  contactId: string,
  targetRole: LegalProfessionalRole,
  associations: EntityAssociationLink[]
): { existingRole: LegalProfessionalRole; conflictType: 'hard_block' | 'warning' } | null {
  const existingLink = associations.find((a) => a.contactId === contactId && a.role !== targetRole);
  if (!existingLink) return null;

  const existingRole = existingLink.role as LegalProfessionalRole;

  const isNotaryVsLawyer =
    (targetRole === 'notary' && LAWYER_ROLES.includes(existingRole)) ||
    (LAWYER_ROLES.includes(targetRole) && existingRole === 'notary');

  if (isNotaryVsLawyer) {
    return { existingRole, conflictType: 'hard_block' };
  }

  const isLawyerVsLawyer =
    LAWYER_ROLES.includes(targetRole) && LAWYER_ROLES.includes(existingRole);

  if (isLawyerVsLawyer) {
    return { existingRole, conflictType: 'warning' };
  }

  return null;
}

function getRoleLabel(role: LegalProfessionalRole): string {
  const slot = SLOTS.find((s) => s.role === role);
  return slot?.defaultLabel ?? role;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProfessionalsCard({
  propertyId,
  associations,
  contracts,
  onAssign,
  onRemove,
  onOverrideProfessional,
}: ProfessionalsCardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { success, error: notifyError } = useNotifications();
  const [editingRole, setEditingRole] = useState<LegalProfessionalRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
  const [pendingEmail, setPendingEmail] = useState<PendingEmailNotification | null>(null);

  const drafts = getDraftContracts(contracts);

  const sendEmailNotification = useCallback(
    (notification: PendingEmailNotification) => {
      notifyProfessionalAssignmentWithPolicy({
        contactId: notification.contactId,
        role: notification.role,
        propertyId,
        type: notification.type,
      })
        .then(() => success(t('sales.legal.emailSent')))
        .catch(() => notifyError(t('sales.legal.emailFailed')));
    },
    [propertyId, t, success, notifyError]
  );

  const executeAssign = useCallback(
    async (contact: ContactSummary, role: LegalProfessionalRole) => {
      setSaving(true);

      try {
        const linked = await onAssign(contact.id, role);
        if (!linked) {
          notifyError(t('status.error'));
          return;
        }

        for (const draft of drafts) {
          await onOverrideProfessional(draft.id, role, contact.id);
        }

        setEditingRole(null);
        success(t('sales.legal.professionalAssigned'));

        const roleLabel = getRoleLabel(role);
        clientSafeFireAndForget(recordPropertyActivityWithPolicy(propertyId, {
          action: 'professional_assigned',
          changes: [{ field: 'professional', oldValue: null, newValue: contact.name, label: roleLabel }],
        }), 'ProfessionalsCard.auditAssign');

        setPendingEmail({
          contactId: contact.id,
          contactName: contact.name,
          role,
          roleLabel,
          type: 'assignment',
        });
      } catch {
        notifyError(t('status.error'));
      } finally {
        setSaving(false);
      }
    },
    [onAssign, onOverrideProfessional, drafts, propertyId, t, success, notifyError]
  );

  const handleAssign = useCallback(
    (contact: ContactSummary | null, role: LegalProfessionalRole) => {
      if (!contact) return;

      const conflict = detectConflict(contact.id, role, associations);

      if (!conflict) {
        executeAssign(contact, role);
        return;
      }

      const existingRoleLabel = getRoleLabel(conflict.existingRole);
      const targetRoleLabel = getRoleLabel(role);

      setPendingAssignment({
        contact,
        targetRole: role,
        existingRole: conflict.existingRole,
        existingRoleLabel,
        targetRoleLabel,
        conflictType: conflict.conflictType,
      });
    },
    [associations, executeAssign]
  );

  const handleConfirmAssignment = useCallback(() => {
    if (!pendingAssignment || pendingAssignment.conflictType === 'hard_block') return;
    executeAssign(pendingAssignment.contact, pendingAssignment.targetRole);
    setPendingAssignment(null);
  }, [pendingAssignment, executeAssign]);

  const handleDismissDialog = useCallback(() => {
    setPendingAssignment(null);
  }, []);

  const handleRemove = useCallback(
    async (linkId: string, role: LegalProfessionalRole, contactId: string, contactName: string) => {
      setSaving(true);

      try {
        const removed = await onRemove(linkId);
        if (!removed) {
          notifyError(t('status.error'));
          return;
        }

        for (const draft of drafts) {
          await onOverrideProfessional(draft.id, role, null);
        }

        success(t('sales.legal.professionalRemoved'));

        const roleLabel = getRoleLabel(role);
        clientSafeFireAndForget(recordPropertyActivityWithPolicy(propertyId, {
          action: 'professional_removed',
          changes: [{ field: 'professional', oldValue: contactName, newValue: null, label: roleLabel }],
        }), 'ProfessionalsCard.auditRemove');

        setPendingEmail({
          contactId,
          contactName,
          role,
          roleLabel,
          type: 'removal',
        });
      } catch {
        notifyError(t('status.error'));
      } finally {
        setSaving(false);
      }
    },
    [onRemove, onOverrideProfessional, drafts, propertyId, t, success, notifyError]
  );

  return (
    <>
      <section className="rounded-lg border bg-card p-3 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <User className={cn("h-4 w-4", colors.text.muted)} />
          {t('sales.legal.professionalsTitle')}
        </h3>

        <ul className="space-y-2">
          {SLOTS.map((slot) => {
            const linked = associations.find((a) => a.role === slot.role);
            const isEditing = editingRole === slot.role;

            return (
              <li key={slot.role} className="space-y-1">
                <article className="flex items-center gap-2 text-sm">
                  <slot.icon className={cn("h-3.5 w-3.5 shrink-0", colors.text.muted)} />
                  <span className={cn("min-w-0 shrink-0", colors.text.muted)}>
                    {t(slot.labelKey, { defaultValue: slot.defaultLabel })}:
                  </span>

                  {linked ? (
                    <>
                      <Link
                        href={ENTITY_ROUTES.contacts.withId(linked.contactId)}
                        className="font-medium truncate text-foreground hover:text-primary hover:underline"
                        title={t('sales.legal.viewContact')}
                      >
                        {linked.contactName}
                      </Link>
                      <nav className="ml-auto flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => setEditingRole(isEditing ? null : slot.role)}
                          disabled={saving}
                          title={t('actions.edit')}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive hover:text-destructive"
                          onClick={() => handleRemove(linked.linkId, slot.role, linked.contactId, linked.contactName)}
                          disabled={saving}
                          title={t('sales.legal.removeProfessional')}
                        >
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </Button>
                      </nav>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1"
                      onClick={() => setEditingRole(isEditing ? null : slot.role)}
                      disabled={saving}
                    >
                      <UserPlus className="h-3 w-3" />
                      {t('sales.legal.assign')}
                    </Button>
                  )}
                </article>

                {isEditing && (
                  <aside className="pl-5">
                    <ContactSearchManager
                      selectedContactId=""
                      onContactSelect={(contact) => handleAssign(contact, slot.role)}
                      placeholder={t('sales.legal.searchProfessional')}
                      label=""
                      className="max-w-xs"
                    />
                  </aside>
                )}
              </li>
            );
          })}
        </ul>

        {saving && (
          <p className={cn("text-[10px] flex items-center gap-1", colors.text.muted)}>
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('loadingStates.saving')}
          </p>
        )}
      </section>

      <ConflictBlockDialog
        pendingAssignment={pendingAssignment}
        onDismiss={handleDismissDialog}
        onConfirm={handleConfirmAssignment}
      />
      <ConflictWarningDialog
        pendingAssignment={pendingAssignment}
        onDismiss={handleDismissDialog}
        onConfirm={handleConfirmAssignment}
      />
      <EmailNotifyDialog
        pendingEmail={pendingEmail}
        onClose={() => setPendingEmail(null)}
        onSend={sendEmailNotification}
      />
    </>
  );
}
