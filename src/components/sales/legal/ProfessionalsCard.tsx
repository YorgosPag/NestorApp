'use client';

/**
 * ProfessionalsCard — 3 νομικοί ρόλοι (seller_lawyer, buyer_lawyer, notary)
 * Interactive: inline assign/change/remove via ContactSearchManager.
 *
 * @enterprise ADR-230 (SPEC-230D Task C)
 */

import React, { useState, useCallback } from 'react';
import { User, Scale, Briefcase, Pencil, X, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { toast } from 'sonner';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { EntityAssociationLink } from '@/types/entity-associations';
import type { LegalContract, LegalProfessionalRole } from '@/types/legal-contracts';

// ============================================================================
// TYPES
// ============================================================================

interface ProfessionalsCardProps {
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

/** Only draft contracts get professional overrides */
function getDraftContracts(contracts: LegalContract[]): LegalContract[] {
  return contracts.filter((c) => c.status === 'draft');
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProfessionalsCard({
  associations,
  contracts,
  onAssign,
  onRemove,
  onOverrideProfessional,
}: ProfessionalsCardProps) {
  const { t } = useTranslation('common');
  const [editingRole, setEditingRole] = useState<LegalProfessionalRole | null>(null);
  const [saving, setSaving] = useState(false);

  const drafts = getDraftContracts(contracts);

  // Assign a contact to a role
  const handleAssign = useCallback(
    async (contact: ContactSummary | null, role: LegalProfessionalRole) => {
      if (!contact) return;
      setSaving(true);

      try {
        const linked = await onAssign(contact.id, role);
        if (!linked) {
          toast.error(t('common.error', { defaultValue: 'Σφάλμα' }));
          return;
        }

        // Sync draft contracts
        for (const draft of drafts) {
          await onOverrideProfessional(draft.id, role, contact.id);
        }

        setEditingRole(null);
        toast.success(t('sales.legal.professionalAssigned', { defaultValue: 'Ανατέθηκε επιτυχώς' }));
      } catch {
        toast.error(t('common.error', { defaultValue: 'Σφάλμα' }));
      } finally {
        setSaving(false);
      }
    },
    [onAssign, onOverrideProfessional, drafts, t]
  );

  // Remove a contact from a role
  const handleRemove = useCallback(
    async (linkId: string, role: LegalProfessionalRole) => {
      setSaving(true);

      try {
        const removed = await onRemove(linkId);
        if (!removed) {
          toast.error(t('common.error', { defaultValue: 'Σφάλμα' }));
          return;
        }

        // Nullify in draft contracts
        for (const draft of drafts) {
          await onOverrideProfessional(draft.id, role, null);
        }

        toast.success(t('sales.legal.professionalRemoved', { defaultValue: 'Αφαιρέθηκε' }));
      } catch {
        toast.error(t('common.error', { defaultValue: 'Σφάλμα' }));
      } finally {
        setSaving(false);
      }
    },
    [onRemove, onOverrideProfessional, drafts, t]
  );

  return (
    <section className="rounded-lg border bg-card p-3 space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <User className="h-4 w-4 text-muted-foreground" />
        {t('sales.legal.professionalsTitle', { defaultValue: 'Νομικοί Επαγγελματίες' })}
      </h3>

      <ul className="space-y-2">
        {SLOTS.map((slot) => {
          const linked = associations.find((a) => a.role === slot.role);
          const isEditing = editingRole === slot.role;

          return (
            <li key={slot.role} className="space-y-1">
              <article className="flex items-center gap-2 text-sm">
                <slot.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground min-w-0 shrink-0">
                  {t(slot.labelKey, { defaultValue: slot.defaultLabel })}:
                </span>

                {linked ? (
                  <>
                    <span className="font-medium truncate">{linked.contactName}</span>
                    <nav className="ml-auto flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => setEditingRole(isEditing ? null : slot.role)}
                        disabled={saving}
                        title={t('common.edit', { defaultValue: 'Επεξεργασία' })}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(linked.linkId, slot.role)}
                        disabled={saving}
                        title={t('sales.legal.removeProfessional', { defaultValue: 'Αφαίρεση' })}
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                      </Button>
                    </nav>
                  </>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground/60 cursor-pointer hover:border-primary hover:text-primary transition-colors"
                    onClick={() => setEditingRole(isEditing ? null : slot.role)}
                  >
                    {t('sales.legal.unassigned', { defaultValue: 'Μη ανατεθ.' })}
                  </Badge>
                )}
              </article>

              {/* Inline contact search */}
              {isEditing && (
                <aside className="pl-5">
                  <ContactSearchManager
                    selectedContactId=""
                    onContactSelect={(contact) => handleAssign(contact, slot.role)}
                    placeholder={t('sales.legal.searchProfessional', { defaultValue: 'Αναζήτηση επαγγελματία...' })}
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
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('common.saving', { defaultValue: 'Αποθήκευση...' })}
        </p>
      )}
    </section>
  );
}
