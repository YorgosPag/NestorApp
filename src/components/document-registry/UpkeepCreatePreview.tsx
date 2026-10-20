'use client';

/**
 * @fileoverview ADR-915 §37 (Γ) — **«Μόνιμες υποχρεώσεις που θα προταθούν» στο συρτάρι δημιουργίας ακινήτου**: η πρόταση
 *   φαίνεται **πριν** σωθεί το ακίνητο, και αλλάζει ζωντανά όσο αλλάζουν είδος και φάση.
 * @related lib/document-validity/property-upkeep.ts (`upkeepItemsOf` — ο ΙΔΙΟΣ με μητρώο, καρτέλα και πράξη) ·
 *   RegistryUpkeepPanel.tsx (`UpkeepItemsSection` — η ΙΔΙΑ ενότητα) · features/property-details/components/PropertyFieldsBlock.tsx
 * @module components/document-registry/UpkeepCreatePreview
 *
 * 🏆 Arthur Online: «tick requirements on create» σε **λευκό** κουτί· Idealista: σκέτο «σε εκκρεμότητα». Εδώ η εφαρμογή
 *    **προτείνει με λόγο** από τα πεδία της φόρμας, πριν καν υπάρξει ακίνητο.
 * 🔑 **Μηδέν δεύτερη μηχανή**: καθαρή συνάρτηση (`upkeepItemsOf`, leaf, χωρίς I/O) πάνω στα ΙΔΙΑ γεγονότα (κλάση από
 *    `resolvedPropertyClassOf`, ωμή φάση) που διαβάζει ο διακομιστής μετά την αποθήκευση — άρα ό,τι δείχνει εδώ είναι
 *    ακριβώς ό,τι θα δείξει η καρτέλα «Έγγραφα».
 * 🔑 **Η δημιουργία ΔΕΝ γράφει απόφαση** (§35 Μ3): καμία κλήση δικτύου, κανένα κουμπί (`declaration: null`), κανένα
 *    «λείπει». Η απόφαση παίρνεται με ίχνος, από άνθρωπο, στην καρτέλα του ακινήτου.
 */

import React, { useMemo } from 'react';

import { resolvedPropertyClassOf } from '@/constants/property-classification';
import { upkeepItemsOf } from '@/lib/document-validity/property-upkeep';
import { UpkeepItemsSection } from '@/components/document-registry/RegistryUpkeepPanel';

/** Δεν υπάρχει ακόμη ταυτότητα: η προεπισκόπηση αφορά **ένα** υποκείμενο, το ακίνητο που γράφεται τώρα. */
const DRAFT_PROPERTY_ID = 'draft';

export interface UpkeepCreatePreviewProps {
  /** Το είδος όπως το έχει η φόρμα (ωμό· κανονικοποιείται από τον ΕΝΑ κριτή κλάσης). */
  readonly type: string;
  /** Η φάση όπως την έχει η φόρμα (ωμή· κανονικοποιείται στον πυρήνα, όχι εδώ). */
  readonly phase: unknown;
}

export function UpkeepCreatePreview({ type, phase }: UpkeepCreatePreviewProps): React.ReactElement | null {
  const items = useMemo(
    () => upkeepItemsOf([{ propertyId: DRAFT_PROPERTY_ID, propertyClass: resolvedPropertyClassOf(type), phase }], []),
    [type, phase],
  );
  // Είδος που δεν διαλέχτηκε ακόμη ≠ «άγνωστο είδος»: η κενή φόρμα δεν έχει τίποτα να προτείνει (κανένας θόρυβος).
  if (type.trim() === '') return null;
  return (
    <UpkeepItemsSection
      headingId="property-create-upkeep-title"
      place="create"
      items={items}
      names={null}
      declaration={null}
      canDecide={false}
      className="mb-4"
    />
  );
}
