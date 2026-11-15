'use client';

/**
 * @fileoverview ADR-915 §41.5 — **οι σύντομες τιμές μιας γραμμής** του μητρώου: ό,τι χωρά σε κελί πίνακα ή σε συμπαγή
 *   λίστα. Η πλήρης ανάλυση («τι σταματά» · «Εκδίδει» · «Το φέρνει» · ανάθεση) ζει στην κάρτα του πλαϊνού πάνελ.
 * @related RegistryTable.tsx · RegistryActionTab.tsx · RegistryRowItem.tsx (η κάρτα — ίδιοι κανόνες ονόματος/λήξης)
 * @module components/document-registry/RegistryRowCells
 *
 * 🔑 **Καμία δεύτερη κρίση**: κατάσταση · `blocking` · επόμενο βήμα · στάδιο ανάθεσης έρχονται από τους ΙΔΙΟΥΣ πυρήνες με
 *    την κάρτα (`blockingDayOf` · `documentNextSteps` · `registryIssuanceOf` + `visibleIssuanceStage`).
 * ⚠️ Κάθε `t(…)` με **κυριολεκτικό** κλειδί ή επίπεδο χάρτη: ο γεννήτορας του route slice τα λύνει μόνο έτσι.
 */

import React from 'react';

import { AUTHORITY_SERVICE_SPECS } from '@/config/document-validity/document-issuers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateKey } from '@/lib/intl-formatting';
import { documentNextSteps } from '@/lib/document-validity/document-next-step';
import { registryRowKindOf, type RegistryRow } from '@/lib/document-validity/document-registry';
import { blockingDayOf } from '@/lib/document-validity/document-registry-view';
import { visibleIssuanceStage } from '@/lib/document-validity/issuance-assignment';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { documentNameOf, relativeText } from '@/components/document-registry/registry-row-text';
import { registryIssuanceOf } from '@/components/document-registry/registry-issuance';
import { ISSUANCE_STAGE_KEYS } from '@/components/document-registry/issuance-labels';
import { LAYOUT_KEYS } from '@/components/document-registry/registry-layout-labels';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  ISSUER_AUTHORITY_LABEL_KEYS,
  LEGALITY_NS,
  NEXT_STEP_KEYS,
  REGISTRY_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

interface CellProps {
  readonly row: RegistryRow;
  readonly registry: DocumentRegistryResponse;
}

/** «ΠΕΑ» — το είδος, το όνομα με το οποίο ο άνθρωπος ψάχνει. */
export function useRowKindLabel(row: RegistryRow): string {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return t(DOCUMENT_KIND_LABEL_KEYS[registryRowKindOf(row)]);
}

/** Το αρχείο / η δήλωση της γραμμής — ή «λείπει». */
export function rowDocumentText(t: Translate, row: RegistryRow, registry: DocumentRegistryResponse): string {
  return row.kind === 'gap' ? t(REGISTRY_KEYS.missingDocument) : documentNameOf(t, row.document, registry);
}

/** Η λήξη: ημερομηνία + «σε N ημέρες» από το `asOf` της απόκρισης· κενό ⇒ παύλα (καμία λήξη για ό,τι λείπει). */
export function ExpiryText({ row, registry }: CellProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const expiresOn = row.kind === 'gap' ? null : row.expiry.expiresOn;
  if (expiresOn === null) return <span className="text-muted-foreground">{t(LAYOUT_KEYS.noExpiry)}</span>;
  const relative = relativeText(t, expiresOn, registry.asOf);
  return (
    <span className="flex flex-col">
      <time dateTime={expiresOn}>{formatDateKey(expiresOn)}</time>
      {relative !== null ? <span className="text-xs text-muted-foreground">{relative}</span> : null}
    </span>
  );
}

/** Πότε μπλοκάρει συναλλαγή — «ήδη» · «στις …» · «δεν μπλοκάρει». */
export function BlocksText({ row, registry }: CellProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const day = blockingDayOf(row, registry.asOf);
  if (day === null) return <span className="text-muted-foreground">{t(LAYOUT_KEYS.blocksNo)}</span>;
  if (day === registry.asOf) return <span className="font-medium text-foreground">{t(LAYOUT_KEYS.blocksNow)}</span>;
  return <span className="text-foreground">{t(LAYOUT_KEYS.blocksOn, { date: formatDateKey(day) })}</span>;
}

/**
 * Το επόμενο βήμα σε μία λέξη: ανάθεση σε εξέλιξη ⇒ το **στάδιό** της· αλλιώς η πρώτη ενέργεια του πυρήνα· τίποτα ⇒ παύλα.
 * Οι ίδιες οι ενέργειες (κουμπιά, φόρμες) ζουν στο πάνελ — ένα σημείο πράξης.
 */
export function NextStepText({ row, registry }: CellProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const issuance = registryIssuanceOf(row, registry);
  const stage = issuance === null || issuance === 'unavailable' ? null : visibleIssuanceStage(issuance.state);
  if (stage !== null) return <span className="text-foreground">{t(ISSUANCE_STAGE_KEYS[stage])}</span>;
  const first = row.state === 'superseded' ? undefined : documentNextSteps(registryRowKindOf(row), row.state)[0];
  if (first === undefined) return <span className="text-muted-foreground">{t(LAYOUT_KEYS.nextNone)}</span>;
  switch (first.kind) {
    case 'assign-professional': return <span className="text-foreground">{t(LAYOUT_KEYS.nextAssign)}</span>;
    case 'find-professional': return <span className="text-foreground">{t(NEXT_STEP_KEYS.findProfessional)}</span>;
    case 'self-service': {
      const { authority } = AUTHORITY_SERVICE_SPECS[first.service];
      return (
        <span className="text-foreground">
          {t(NEXT_STEP_KEYS.selfService, { authority: t(ISSUER_AUTHORITY_LABEL_KEYS[authority]) })}
        </span>
      );
    }
  }
}
