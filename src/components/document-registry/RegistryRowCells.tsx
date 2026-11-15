'use client';

/**
 * @fileoverview ADR-915 §41.5 — **οι σύντομες τιμές μιας γραμμής** του μητρώου: ό,τι χωρά σε κελί πίνακα ή σε συμπαγή
 *   λίστα. Η πλήρης ανάλυση («τι σταματά» · «Εκδίδει» · «Το φέρνει» · ανάθεση) ζει στην κάρτα του πλαϊνού πάνελ.
 * @related RegistryTable.tsx · RegistryActionTab.tsx · RegistryRowItem.tsx (η κάρτα — ίδιοι κανόνες ονόματος/λήξης)
 * @module components/document-registry/RegistryRowCells
 *
 * 🔑 **Καμία δεύτερη κρίση**: κατάσταση · `blocking` · τι μπλοκάρει έρχονται από τους ΙΔΙΟΥΣ πυρήνες με την κάρτα
 *    (`blockersOf` · `undeterminedBlockersOf` · `isBlockingDependent`). Η ενέργεια της γραμμής: `RegistryRowAction.tsx`.
 * ⚠️ Κάθε `t(…)` με **κυριολεκτικό** κλειδί ή επίπεδο χάρτη: ο γεννήτορας του route slice τα λύνει μόνο έτσι.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateKey } from '@/lib/intl-formatting';
import { registryRowKindOf, type RegistryRow } from '@/lib/document-validity/document-registry';
import { blockersOf, undeterminedBlockersOf } from '@/lib/document-validity/document-registry-view';
import type { DocumentDependent } from '@/lib/document-validity/document-requirement';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { documentNameOf, relativeText } from '@/components/document-registry/registry-row-text';
import {
  REGISTRY_LINK_CLASS,
  RegistryProcessLink,
  registryProcessKeyOf,
} from '@/components/document-registry/registry-links';
import { LAYOUT_KEYS } from '@/components/document-registry/registry-layout-labels';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  LEGALITY_NS,
  PROCESS_LABEL_KEYS,
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

interface ProcessNameProps {
  readonly dependent: DocumentDependent;
  readonly registry: DocumentRegistryResponse;
}

/** Η διαδικασία ως σύνδεσμος — «Μεταβίβαση» · «Δημοσιευμένη αγγελία» (ο ΕΝΑΣ κανόνας συνδέσμων, §43). */
function ProcessName({ dependent, registry }: ProcessNameProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <RegistryProcessLink requirement={dependent.requirement} names={registry} className={`text-foreground ${REGISTRY_LINK_CLASS}`}>
      {t(PROCESS_LABEL_KEYS[dependent.requirement.process.kind])}
    </RegistryProcessLink>
  );
}

interface UndeterminedTextProps {
  readonly dependents: readonly DocumentDependent[];
  readonly registry: DocumentRegistryResponse;
}

/** §43 — άγνωστη λήξη που τη ζητά διαδικασία `block`: «Δεν κρίνεται» + ποιες περιμένουν. Ποτέ «μπλοκάρει» (δεν το ξέρουμε). */
function UndeterminedText({ dependents, registry }: UndeterminedTextProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <span className="flex flex-col">
      <span className="text-foreground">{t(LAYOUT_KEYS.blocksUndetermined)}</span>
      <ul className="m-0 flex list-none flex-col p-0">
        {dependents.map((dependent) => (
          <li key={registryProcessKeyOf(dependent.requirement.process)}><ProcessName dependent={dependent} registry={registry} /></li>
        ))}
      </ul>
    </span>
  );
}

/**
 * **ΤΙ μπλοκάρει και ΠΟΤΕ** (ADR-915 §43): κάθε διαδικασία που ο πυρήνας κρίνει μπλοκαρισμένη, ως σύνδεσμος, με «ήδη» ή
 * «από …» — η νωρίτερη πρώτη. Πέρα από Drata/Vanta, που μετρούν επηρεαζόμενους ελέγχους χωρίς να λένε ποια πράξη σταματά.
 */
export function BlocksText({ row, registry }: CellProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const blockers = blockersOf(row, registry.asOf);
  if (blockers.length === 0) {
    const undetermined = undeterminedBlockersOf(row);
    if (undetermined.length > 0) return <UndeterminedText dependents={undetermined} registry={registry} />;
    return <span className="text-muted-foreground">{t(LAYOUT_KEYS.blocksNo)}</span>;
  }
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {blockers.map(({ dependent, day }) => (
        <li key={registryProcessKeyOf(dependent.requirement.process)} className="flex flex-wrap items-center gap-x-1">
          <ProcessName dependent={dependent} registry={registry} />
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          {day === registry.asOf
            ? <span className="font-medium text-foreground">{t(LAYOUT_KEYS.blocksNow)}</span>
            : <span className="text-foreground">{t(LAYOUT_KEYS.blocksOn, { date: formatDateKey(day) })}</span>}
        </li>
      ))}
    </ul>
  );
}

