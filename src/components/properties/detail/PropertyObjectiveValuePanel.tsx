'use client';

/**
 * @fileoverview **Η αντικειμενική αξία στην καρτέλα ακινήτου του γραφείου** (ADR-898 Φ3β-3) — η ΙΔΙΑ ενότητα με την
 * οθόνη «Βελτίωσε την αγγελία σου» του ιδιώτη· αλλάζει μόνο ο κάτοχος (`subject`).
 * @related `components/owner-property/improve/ObjectiveValueImproveSection.tsx` (η ενότητα) ·
 *   `services/property/property-mutation-gateway.ts#updatePropertyObjectiveValueWithPolicy` (η πόρτα γραφής) ·
 *   πρότυπο `MarketingAudienceControl` (ένα component, η πράξη απ' έξω)
 * @module components/properties/detail/PropertyObjectiveValuePanel
 *
 * 🔑 **Ίδιο δικαίωμα απόκρυψης** για γραφείο και ιδιώτη (ADR-898 §12 — μάθημα της αγωγής κατά της Zillow).
 * 🔑 **Πράξη της καρτέλας, όχι πεδίο φόρμας**: κάθε απάντηση αποθηκεύεται αμέσως (σειριακή ουρά), όπως το κοινό
 *   αγγελίας δίπλα — η φόρμα με «Αποθήκευση» θα ξανάγραφε ολόκληρο το έγγραφο.
 * 🔑 **Κλειδωμένο σε συναλλαγή** (πώληση/μίσθωση, ADR-249): εξήγηση αντί για ερωτήσεις — η ΜΙΑ λίστα κλειδωμάτων.
 */

import React, { useId, useMemo } from 'react';

import { ObjectiveValueImproveSection } from '@/components/owner-property/improve/ObjectiveValueImproveSection';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ObjectiveValueDeclarationsPatch } from '@/lib/objective-value/objective-value-declarations';
import { objectiveValueFormOf } from '@/lib/objective-value/objective-value-form-of-type';
import type { ObjectiveValueImproveSubject } from '@/lib/objective-value/objective-value-improve-subject';
import { isFieldLocked } from '@/lib/property/property-locked-fields';
import { updatePropertyObjectiveValueWithPolicy } from '@/services/property/property-mutation-gateway';
import type { Property } from '@/types/property';

const NS = 'objective-value';
const I = `${NS}:improve`;

/**
 * **Η αναθεώρηση του εγγράφου** — αλλάζει μόνο όταν αλλάζει ΑΥΤΟ το ακίνητο. Ο listener του γραφείου ξαναφτιάχνει
 * αντικείμενα για κάθε αλλαγή **οποιουδήποτε** ακινήτου της εταιρείας· η ταυτότητα αντικειμένου θα ξαναζητούσε τη βάση
 * χωρίς λόγο. Το `_v` ανεβαίνει σε κάθε εγγραφή της διαδρομής PATCH· το `updatedAt` καλύπτει τους υπόλοιπους γραφείς.
 */
function revisionOf(property: Property): string {
  const updatedAt: unknown = property.updatedAt;
  const millis =
    typeof updatedAt === 'object' && updatedAt !== null && 'toMillis' in updatedAt && typeof updatedAt.toMillis === 'function'
      ? String(updatedAt.toMillis())
      : String(updatedAt);
  const version = (property as { readonly _v?: unknown })._v;
  return `${String(version)}|${millis}`;
}

function usePropertyImproveSubject(property: Property): ObjectiveValueImproveSubject {
  const { id, objectiveValueDeclarations, commercialStatus } = property;
  const revision = revisionOf(property);
  return useMemo(
    () => ({
      id,
      declarations: objectiveValueDeclarations,
      revision,
      write: (patch: ObjectiveValueDeclarationsPatch) =>
        updatePropertyObjectiveValueWithPolicy({ propertyId: id, currentProperty: { commercialStatus }, patch }),
    }),
    [id, objectiveValueDeclarations, revision, commercialStatus],
  );
}

export function PropertyObjectiveValuePanel({ property }: { readonly property: Property }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const headingId = useId();
  const subject = usePropertyImproveSubject(property);
  // Ποια είδη αποτιμώνται το λέει ο ΕΝΑΣ πίνακας εντύπων (κατάστημα · γραφείο · γη ⇒ καμία ενότητα).
  if (objectiveValueFormOf(property.type) === null) return null;
  const locked = isFieldLocked(property.commercialStatus, 'objectiveValueDeclarations');
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <h2 id={headingId} className="m-0 text-lg font-semibold text-foreground">{t(`${I}.sections.objectiveValue.title`)}</h2>
      {locked
        ? <p className="m-0 text-sm text-muted-foreground">{t(`${I}.locked`)}</p>
        : <ObjectiveValueImproveSection subject={subject} />}
    </section>
  );
}
