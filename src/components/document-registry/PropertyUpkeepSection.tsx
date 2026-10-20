'use client';

/**
 * @fileoverview ADR-915 §36 — **«Μόνιμες υποχρεώσεις» στην καρτέλα του ακινήτου**: η πρόταση φαίνεται από τη γέννηση
 *   του ακινήτου, και αποφασίζεται **εκεί** — όχι μόνο από το μητρώο.
 * @related RegistryUpkeepPanel.tsx (`UpkeepItemsSection` — η ΙΔΙΑ ενότητα) · hooks/document-registry/usePropertyUpkeep.ts ·
 *   hooks/document-registry/useUpkeepDeclaration.ts (η ΙΔΙΑ αποστολή, το ΙΔΙΟ `PUT`)
 * @module components/document-registry/PropertyUpkeepSection
 *
 * 🏆 Arthur Online: οι απαιτήσεις «τικάρονται» στη δημιουργία **ή** από τη σελίδα του ακινήτου· Re-Leased: καρτέλα
 *    «Compliance» ανά ακίνητο. Εδώ: η εφαρμογή **προτείνει με λόγο** (νέο ακίνητο = `draft` ⇒ «φάση μη δηλωμένη») και ο
 *    άνθρωπος αποφασίζει με ίχνος. Η δημιουργία **δεν** γράφει απόφαση — η πρόταση ποτέ δεν γεννά «λείπει» (§35 Μ3).
 * 🔑 **Μηδέν δεύτερη μηχανή**: ίδια όψη (`upkeepItemsOf` στον διακομιστή), ίδια συστατικά, ίδιος γραφέας.
 * 🔑 Αποσυρμένο · ξένο ακίνητο ⇒ ο διακομιστής αρνείται ⇒ η ενότητα σιωπά. Βλάβη ⇒ το λέει, δεν σιωπά.
 * 🔑 §37 — **ΜΙΑ ενότητα, τρεις σελίδες**: καρτέλα ακινήτου εταιρείας · σελίδα εντολής του γραφείου (ακίνητο ιδιώτη υπό
 *    θεματοφυλακή) · «Τα ακίνητά μου» του ιδιώτη χωρίς μεσίτη. Το «μπορείς να αποφασίσεις;» το λέει ο **server**
 *    (`canDecide`, ο ίδιος κανόνας με το PUT) — ο ιδιώτης δεν έχει ρόλο εταιρείας για να το κρίνει ο πελάτης.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePropertyUpkeep } from '@/hooks/document-registry/usePropertyUpkeep';
import { useUpkeepDeclaration } from '@/hooks/document-registry/useUpkeepDeclaration';
import { UpkeepItemsSection } from '@/components/document-registry/RegistryUpkeepPanel';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { UPKEEP_KEYS } from '@/components/document-registry/upkeep-labels';

export interface PropertyUpkeepSectionProps {
  readonly propertyId: string;
}

export function PropertyUpkeepSection({ propertyId }: PropertyUpkeepSectionProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const { view, revalidate } = usePropertyUpkeep(propertyId);
  const declaration = useUpkeepDeclaration(revalidate);
  if (view.state === 'failed') return <p role="alert" className="m-0 mb-4 text-sm text-destructive">{t(UPKEEP_KEYS.loadFailed)}</p>;
  if (view.state !== 'ready') return null;
  return (
    <UpkeepItemsSection
      headingId={`property-upkeep-title-${propertyId}`}
      place="property"
      items={view.items}
      names={null}
      declaration={declaration}
      canDecide={view.canDecide}
      className="mb-4"
    />
  );
}
