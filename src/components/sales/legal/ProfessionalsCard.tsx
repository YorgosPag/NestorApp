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

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { User, Scale, Briefcase, Pencil, X, Loader2, AlertTriangle, ShieldAlert, UserPlus, Mail } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { ENTITY_ROUTES } from '@/lib/routes';
import { API_ROUTES } from '@/config/domain-constants';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
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

/** Pending assignment waiting for user confirmation */
interface PendingAssignment {
  contact: ContactSummary;
  targetRole: LegalProfessionalRole;
  existingRole: LegalProfessionalRole;
  existingRoleLabel: string;
  targetRoleLabel: string;
  conflictType: 'hard_block' | 'warning';
}

/** Pending email notification — shown after successful assignment or removal */
interface PendingEmailNotification {
  contactId: string;
  contactName: string;
  role: string;
  roleLabel: string;
  type: 'assignment' | 'removal';
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
 * Check if assigning a contact to a role conflicts with their existing role.
 *
 * Rules (Greek Law):
 * 1. Notary + Lawyer (either) = HARD BLOCK
 *    Ν.2830/2000 Άρ.22§2: Ο διορισμός ως συμβολαιογράφος συνεπάγεται
 *    αυτοδίκαια αποβολή ιδιότητας δικηγόρου.
 *    Άρ.37§1: Ασυμβίβαστο με κάθε άλλη επαγγελματική δραστηριότητα.
 *
 * 2. Seller Lawyer + Buyer Lawyer = WARNING (σύγκρουση συμφερόντων)
 *    Κώδικας Δεοντολογίας Δικηγόρων Άρ.37: Απαγορεύεται παροχή βοήθειας
 *    σε αμφότερα τα μέρη. Conflict of interest.
 */
function detectConflict(
  contactId: string,
  targetRole: LegalProfessionalRole,
  associations: EntityAssociationLink[]
): { existingRole: LegalProfessionalRole; conflictType: 'hard_block' | 'warning' } | null {
  const existingLink = associations.find((a) => a.contactId === contactId && a.role !== targetRole);
  if (!existingLink) return null;

  const existingRole = existingLink.role as LegalProfessionalRole;

  // Rule 1: Notary ↔ Lawyer = HARD BLOCK
  const isNotaryVsLawyer =
    (targetRole === 'notary' && LAWYER_ROLES.includes(existingRole)) ||
    (LAWYER_ROLES.includes(targetRole) && existingRole === 'notary');

  if (isNotaryVsLawyer) {
    return { existingRole, conflictType: 'hard_block' };
  }

  // Rule 2: Seller Lawyer ↔ Buyer Lawyer = WARNING
  const isLawyerVsLawyer =
    LAWYER_ROLES.includes(targetRole) && LAWYER_ROLES.includes(existingRole);

  if (isLawyerVsLawyer) {
    return { existingRole, conflictType: 'warning' };
  }

  return null;
}

/** Get human-readable label for a role */
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
  const { t } = useTranslation('common');
  const { success, error: notifyError } = useNotifications();
  const [editingRole, setEditingRole] = useState<LegalProfessionalRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
  const [pendingEmail, setPendingEmail] = useState<PendingEmailNotification | null>(null);

  const drafts = getDraftContracts(contracts);

  // Send the email notification (assignment or removal)
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

  // Execute the actual assignment (after validation/confirmation)
  const executeAssign = useCallback(
    async (contact: ContactSummary, role: LegalProfessionalRole) => {
      setSaving(true);

      try {
        const linked = await onAssign(contact.id, role);
        if (!linked) {
          notifyError(t('status.error'));
          return;
        }

        // Sync draft contracts
        for (const draft of drafts) {
          await onOverrideProfessional(draft.id, role, contact.id);
        }

        setEditingRole(null);
        success(t('sales.legal.professionalAssigned'));

        // Audit trail: professional assigned
        const roleLabel = getRoleLabel(role);
        clientSafeFireAndForget(recordPropertyActivityWithPolicy(propertyId, {
          action: 'professional_assigned',
          changes: [{ field: 'professional', oldValue: null, newValue: contact.name, label: roleLabel }],
        }), 'ProfessionalsCard.auditAssign');

        // Ask user whether to send email notification
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
    [onAssign, onOverrideProfessional, drafts, t, success, notifyError]
  );

  // Validate before assigning — check for conflicts
  const handleAssign = useCallback(
    (contact: ContactSummary | null, role: LegalProfessionalRole) => {
      if (!contact) return;

      const conflict = detectConflict(contact.id, role, associations);

      if (!conflict) {
        // No conflict — assign directly
        executeAssign(contact, role);
        return;
      }

      const existingRoleLabel = getRoleLabel(conflict.existingRole);
      const targetRoleLabel = getRoleLabel(role);

      if (conflict.conflictType === 'hard_block') {
        // HARD BLOCK — show error dialog, cannot proceed
        setPendingAssignment({
          contact,
          targetRole: role,
          existingRole: conflict.existingRole,
          existingRoleLabel,
          targetRoleLabel,
          conflictType: 'hard_block',
        });
        return;
      }

      // WARNING — show confirmation dialog
      setPendingAssignment({
        contact,
        targetRole: role,
        existingRole: conflict.existingRole,
        existingRoleLabel,
        targetRoleLabel,
        conflictType: 'warning',
      });
    },
    [associations, executeAssign]
  );

  // Handle confirmation dialog response
  const handleConfirmAssignment = useCallback(() => {
    if (!pendingAssignment || pendingAssignment.conflictType === 'hard_block') return;
    executeAssign(pendingAssignment.contact, pendingAssignment.targetRole);
    setPendingAssignment(null);
  }, [pendingAssignment, executeAssign]);

  const handleDismissDialog = useCallback(() => {
    setPendingAssignment(null);
  }, []);

  // Remove a contact from a role
  const handleRemove = useCallback(
    async (linkId: string, role: LegalProfessionalRole, contactId: string, contactName: string) => {
      setSaving(true);

      try {
        const removed = await onRemove(linkId);
        if (!removed) {
          notifyError(t('status.error'));
          return;
        }

        // Nullify in draft contracts
        for (const draft of drafts) {
          await onOverrideProfessional(draft.id, role, null);
        }

        success(t('sales.legal.professionalRemoved'));

        // Audit trail: professional removed
        const roleLabel = getRoleLabel(role);
        clientSafeFireAndForget(recordPropertyActivityWithPolicy(propertyId, {
          action: 'professional_removed',
          changes: [{ field: 'professional', oldValue: contactName, newValue: null, label: roleLabel }],
        }), 'ProfessionalsCard.auditRemove');

        // Ask user whether to send removal email
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
    [onRemove, onOverrideProfessional, drafts, t, success, notifyError]
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
                        className="font-medium truncate text-foreground hover:text-blue-700 hover:underline dark:hover:text-blue-400"
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

                {/* Inline contact search */}
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

      {/* ================================================================== */}
      {/* Conflict Dialog — Hard Block (Notary ↔ Lawyer)                     */}
      {/* ================================================================== */}
      <AlertDialog
        open={pendingAssignment?.conflictType === 'hard_block'}
        onOpenChange={(open) => { if (!open) handleDismissDialog(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              {t('sales.legal.conflictBlockTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <section className="space-y-2 text-sm">
                <p>
                  {t('sales.legal.conflictBlockPre')}{' '}
                  <strong>«{pendingAssignment?.contact.name}»</strong>{' '}
                  {t('sales.legal.conflictBlockAlready')}{' '}
                  <strong>{pendingAssignment?.existingRoleLabel}</strong>.{' '}
                  {t('sales.legal.conflictBlockCannot')}{' '}
                  <strong>{pendingAssignment?.targetRoleLabel}</strong>.
                </p>
                <p className={cn("italic", colors.text.muted)}>
                  {t('sales.legal.conflictBlockLaw')}
                </p>
              </section>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('sales.legal.understood')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================================================================== */}
      {/* Conflict Dialog — Warning (Seller ↔ Buyer Lawyer)                  */}
      {/* ================================================================== */}
      <AlertDialog
        open={pendingAssignment?.conflictType === 'warning'}
        onOpenChange={(open) => { if (!open) handleDismissDialog(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {t('sales.legal.conflictWarningTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <section className="space-y-2 text-sm">
                <p>
                  {t('sales.legal.conflictBlockPre')}{' '}
                  <strong>«{pendingAssignment?.contact.name}»</strong>{' '}
                  {t('sales.legal.conflictBlockAlready')}{' '}
                  <strong>{pendingAssignment?.existingRoleLabel}</strong>.{' '}
                  {t('sales.legal.conflictWarningSure')}{' '}
                  <strong>{pendingAssignment?.targetRoleLabel}</strong>;
                </p>
                <p className={cn("italic", colors.text.muted)}>
                  {t('sales.legal.conflictWarningLaw')}
                </p>
              </section>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAssignment} className="bg-amber-600 hover:bg-amber-700">
              {t('sales.legal.assignAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================================================================== */}
      {/* Email Notification Dialog — after successful assignment             */}
      {/* ================================================================== */}
      <AlertDialog
        open={pendingEmail !== null}
        onOpenChange={(open) => { if (!open) setPendingEmail(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className={`h-5 w-5 ${pendingEmail?.type === 'removal' ? 'text-destructive' : 'text-blue-600'}`} />
              {pendingEmail?.type === 'removal'
                ? t('sales.legal.emailNotifyRemoveTitle')
                : t('sales.legal.emailNotifyAssignTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="text-sm">
                {pendingEmail?.type === 'removal'
                  ? t('sales.legal.emailNotifyRemoveBody', {
                      contactName: pendingEmail?.contactName ?? '',
                      roleLabel: pendingEmail?.roleLabel ?? '',
                    })
                  : t('sales.legal.emailNotifyAssignBody', {
                      contactName: pendingEmail?.contactName ?? '',
                      roleLabel: pendingEmail?.roleLabel ?? '',
                    })}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('sales.legal.emailNotifyNo')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingEmail) sendEmailNotification(pendingEmail);
                setPendingEmail(null);
              }}
            >
              {t('sales.legal.emailNotifyYes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
