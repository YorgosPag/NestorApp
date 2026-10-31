'use client';

/**
 * @fileoverview **Τα μέλη μιας ομάδας πελατών** — αναθέσεις συμβαλλομένου → ομάδα, άμεσες και αισιόδοξες (ADR-923 §5.11 «3δ»
 *   Τμήμα 2).
 * @related pricing-group-draft.ts (`membershipVerdict` · `membersOf`) · PricingPartyPicker.tsx (ο ΕΝΑΣ επιλογέας συμβαλλομένου) ·
 *   server/catalog/customer-assignment-writer.server.ts (ταυτότητα ανάθεσης = ο συμβαλλόμενος)
 * @module components/catalog/pricing/CustomerGroupMembers
 *
 * 🔑 **«Ένας συμβαλλόμενος ⇒ μία ομάδα» φαίνεται πριν από το κλικ**: αν ο επιλεγμένος ανήκει ήδη αλλού, το κουμπί λέει
 *    **«Μετακίνηση εδώ»** και αλλάζει την ομάδα της **ίδιας** ανάθεσης (αυτό επιτρέπει ο γραφέας) — ποτέ «Προσθήκη» που θα
 *    έπαιρνε 409. Ήδη μέλος ⇒ τίποτα να σταλεί.
 * 🔑 **Άμεσες πράξεις** (Google Contacts: ετικέτα σε επαφή) — όχι μέρος του προχείρου της ομάδας· η αφαίρεση γυρίζει πίσω αν
 *    αρνηθεί ο γραφέας.
 * 🔑 Τα ονόματα έρχονται **από την όψη** (`partyNames`, expand στην ίδια συναλλαγή) **+** ό,τι μόλις διάλεξε ο άνθρωπος
 *    (`party-name-memory.ts`, Σ6 — το αισιόδοξο μέλος δεν λέγεται «χωρίς όνομα») — ποτέ φόρτωση όλων των επαφών.
 */

import React, { useState } from 'react';
import { ArrowRightLeft, UserMinus, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { pricingPartyKey } from '@/subapps/catalog/pricing/price-audience';
import type { CustomerAssignmentDefinition, PricingPartyRef } from '@/subapps/catalog/types/price-list';
import type { CustomerAssignmentWire, CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import { CatalogListSection } from '../shared/CatalogList';
import { deleteDefinition, newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { membersOf, membershipVerdict, type MembershipVerdict } from './pricing-group-draft';
import { PricingPartyPicker } from './PricingPartyPicker';
import type { DiscountsWorkspace } from './use-discounts-workspace';
import { usePartyName } from './use-discount-words';

const NO_ISSUES: readonly never[] = [];

interface CustomerGroupMembersProps {
  readonly group: CustomerGroupWire;
  readonly workspace: Pick<DiscountsWorkspace, 'assignments' | 'customerGroups' | 'partyNames'>;
}

/** Νέα ανάθεση, ή μετακίνηση της υπάρχουσας στην ομάδα `groupId`. */
function assign(workspace: CustomerGroupMembersProps['workspace'], party: PricingPartyRef, groupId: string, existing: CustomerAssignmentWire | null): void {
  const definition: CustomerAssignmentDefinition = { party: existing?.party ?? party, customerGroupId: groupId };
  saveDefinition(workspace.assignments, {
    kind: 'customerAssignment',
    existing,
    definition,
    optimistic: optimisticWire(definition, existing, existing?.id ?? newEntityKey(pricingPartyKey(party))),
  });
}

function AddMember({ group, workspace, disabled }: CustomerGroupMembersProps & { readonly disabled: boolean }) {
  const { t, text } = useCatalogText();
  const [party, setParty] = useState<PricingPartyRef | null>(null);
  const verdict: MembershipVerdict | null = party ? membershipVerdict(party, group.id, workspace.assignments.view, workspace.customerGroups.view) : null;
  const commit = (existing: CustomerAssignmentWire | null) => { if (party) { assign(workspace, party, group.id, existing); setParty(null); } };
  return (
    <section className="flex flex-col gap-2 rounded-md border p-3">
      <PricingPartyPicker value={party} onChange={setParty} disabled={disabled} issues={NO_ISSUES} path="party" />
      {verdict?.kind === 'alreadyHere' ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('pricing.discounts.members.alreadyHere')}</p> : null}
      {verdict?.kind === 'move' ? (
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm" role="status">
          {t('pricing.discounts.members.alreadyIn', { group: verdict.from ? text(verdict.from.labels, verdict.from.code) : t('pricing.discounts.members.unknownGroup') })}
          <Button type="button" size="sm" disabled={disabled} onClick={() => commit(verdict.assignment)}><ArrowRightLeft className="mr-1 h-4 w-4" aria-hidden />{t('pricing.discounts.members.move')}</Button>
        </p>
      ) : null}
      {verdict?.kind === 'add' ? (
        <Button type="button" size="sm" className="self-start" disabled={disabled} onClick={() => commit(null)}><UserPlus className="mr-1 h-4 w-4" aria-hidden />{t('pricing.discounts.members.add')}</Button>
      ) : null}
    </section>
  );
}

export function CustomerGroupMembers({ group, workspace }: CustomerGroupMembersProps) {
  const { t } = useCatalogText();
  const disabled = useCatalogAccess('pricing') !== 'granted';
  const partyName = usePartyName(workspace.partyNames);
  const nameOf = (assignment: CustomerAssignmentWire) => partyName(assignment.party);
  const members = membersOf(group.id, workspace.assignments.view, nameOf);
  return (
    <section className="flex flex-col gap-3 border-t p-4">
      <CatalogListSection title={t('pricing.discounts.members.title')} count={members.length}>
        {members.length === 0 ? <p className="m-0 px-2 text-sm text-muted-foreground">{t('pricing.discounts.members.empty')}</p> : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-2 rounded-md px-2 py-1" aria-busy={workspace.assignments.pendingKeys.has(member.id) || undefined}>
                <span className="min-w-0 flex-1 truncate text-sm">{nameOf(member)}</span>
                {workspace.assignments.pendingKeys.has(member.id) ? <span className="text-xs text-muted-foreground">{t('common.saving')}</span> : null}
                {!disabled ? (
                  <Button type="button" size="icon" variant="ghost" aria-label={t('pricing.discounts.members.remove', { name: nameOf(member) })}
                    onClick={() => deleteDefinition(workspace.assignments, 'customerAssignment', member)}>
                    <UserMinus className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CatalogListSection>
      {!disabled ? <AddMember group={group} workspace={workspace} disabled={disabled} /> : null}
    </section>
  );
}
