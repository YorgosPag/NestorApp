'use client';

/**
 * @fileoverview **Ο επιλογέας συμβαλλομένου της τιμολόγησης** — επαφή του προμηθευτή ή χώρος συνεργάτη (ADR-923 §5.11 «3δ»).
 *   Κοινός για το κοινό «συνεργάτης» λίστας/συνθήκης και για τα μέλη ομάδας πελατών (Τμήμα 2).
 * @related components/contacts/relationships/ContactSearchManager.tsx (η ΜΙΑ αυστηρή αναζήτηση επαφής — κανένα ελεύθερο κείμενο) ·
 *   server/catalog/pricing-party-reads.server.ts (ο διακομιστής ξαναρωτά την ύπαρξη: ξένη επαφή ≡ ανύπαρκτη)
 * @module components/catalog/pricing/PricingPartyPicker
 *
 * 🔑 **Χώρος = ΜΟΝΟ από συνδεδεμένους συνεργάτες** (απόφαση Giorgio 2026-10-29, «όπως οι μεγάλοι»): SAP Ariba · Coupa ·
 *    Slack Connect συνδέουν εταιρείες με **αποδεκτή πρόσκληση**, ποτέ με αναζήτηση σε κατάλογο πελατών της πλατφόρμας. Ο
 *    ΑΦΜ του χώρου είναι **αυτοδήλωση** (`accounting_settings`) ⇒ αναζήτηση με ΑΦΜ = πλαστογραφήσιμη και μαντείο
 *    «είναι πελάτης του Νέστορα;». Η σύνδεση χώρου ↔ χώρου γεννιέται στο ADR-862 Φ4· ως τότε η επιλογή λέει **γιατί** λείπει.
 * ⚠️ `next/dynamic`: η αναζήτηση επαφών φέρνει όλη την υπηρεσία επαφών — όριο της κλειστότητας του route slice (CHECK 3.34).
 */

import React from 'react';
import dynamic from 'next/dynamic';

import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { PricingPartyRef } from '@/subapps/catalog/types/price-list';
import { FieldIssues } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';

const ContactSearchManager = dynamic(
  () => import('@/components/contacts/relationships/ContactSearchManager').then((mod) => mod.ContactSearchManager),
  { ssr: false },
);

interface PricingPartyPickerProps {
  readonly value: PricingPartyRef | null;
  readonly onChange: (party: PricingPartyRef | null) => void;
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
  /** Η διαδρομή του συμβαλλομένου μέσα στον ορισμό (π.χ. `audience.party`). */
  readonly path: string;
}

export function PricingPartyPicker({ value, onChange, disabled, issues, path }: PricingPartyPickerProps) {
  const { t } = useCatalogText();
  const contactId = value?.kind === 'contact' ? value.contactId : '';
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0" disabled={disabled}>
      <legend className="sr-only">{t('pricing.audience.partner')}</legend>
      <ContactSearchManager
        selectedContactId={contactId}
        onContactSelect={(contact) => onChange(contact?.id ? { kind: 'contact', contactId: contact.id } : null)}
        label={t('pricing.audience.partnerContact')}
        disabled={disabled}
      />
      <p className="m-0 text-xs text-muted-foreground">
        <strong className="font-medium">{t('pricing.audience.partnerWorkspace')}</strong>
        {' — '}
        {t('pricing.audience.partnerWorkspaceUnavailable')}
      </p>
      <FieldIssues issues={issues} path={path} />
    </fieldset>
  );
}
