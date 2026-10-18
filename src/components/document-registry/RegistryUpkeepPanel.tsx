'use client';

/**
 * @fileoverview ADR-915 §35 — **η ενότητα «Μόνιμες υποχρεώσεις»** του μητρώου: η εφαρμογή προτείνει, ο άνθρωπος αποφασίζει.
 * @related lib/document-validity/property-upkeep.ts (πρόταση · απόφαση) · RegistryUpkeepDecision.tsx (τα κουμπιά) ·
 *   hooks/document-registry/useUpkeepDeclaration.ts (η αποστολή)
 * @module components/document-registry/RegistryUpkeepPanel
 *
 * 🏆 Arthur Online: απαιτήσεις «τικάρονται» σε λευκό κουτί, χωρίς προεπιλογή ανά τύπο· «mark as completed» χωρίς λόγο.
 *    Εδώ: η εφαρμογή **προτείνει** από κλάση + φάση και **λέει γιατί** · η εξαίρεση θέλει λόγο · η απόφαση κρατά αν
 *    ακολούθησε ή **παρέκαμψε** την πρόταση.
 * 🔑 **Χωριστά από τις γραμμές**: η πρόταση **δεν** είναι κατάσταση εγγράφου — καμία νέα κάρτα, κανένα φίλτρο, καμία
 *    ψευδής κόκκινη. Μόνο η επιβεβαίωση γίνεται απαίτηση, και τότε «λείπει» / «τι σταματά» τα λέει ο ΙΔΙΟΣ πυρήνας.
 * 🔑 **Κανένας υπολογισμός**: πρόταση και απόφαση ήρθαν έτοιμες από τον διακομιστή. Χωρίς δικαίωμα ⇒ μόνο ανάγνωση.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { documentKindSpec } from '@/config/document-validity/document-validity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { followsProposal, type UpkeepItem } from '@/lib/document-validity/property-upkeep';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { upkeepItemKeyOf, type UpkeepDeclarationSubmit } from '@/hooks/document-registry/useUpkeepDeclaration';
import { RegistryPropertyValue } from '@/components/document-registry/RegistryPropertyValue';
import { RegistryUpkeepDecision } from '@/components/document-registry/RegistryUpkeepDecision';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  LEGALITY_NS,
  REGISTRY_KEYS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';
import {
  UPKEEP_DECISION_KEYS,
  UPKEEP_ERROR_KEYS,
  UPKEEP_EXEMPTION_KEYS,
  UPKEEP_KEYS,
  UPKEEP_PROPOSAL_KEYS,
} from '@/components/document-registry/upkeep-labels';

interface ItemProps {
  readonly item: UpkeepItem;
  readonly registry: Pick<DocumentRegistryResponse, 'properties'>;
  readonly declaration: UpkeepDeclarationSubmit;
  readonly canDecide: boolean;
}

/** Η απόφαση όπως πάρθηκε: τι, γιατί (εξαίρεση), πότε — και αν πήγε **αντίθετα** στην πρόταση της εφαρμογής. */
function DecisionValue({ item }: { readonly item: UpkeepItem }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { declaration } = item;
  if (declaration === null) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-foreground">
      <Badge variant={declaration.decision === 'required' ? 'default' : 'muted'}>{t(UPKEEP_DECISION_KEYS[declaration.decision])}</Badge>
      {declaration.exemptionReason === null ? null : <span>{t(UPKEEP_EXEMPTION_KEYS[declaration.exemptionReason])}</span>}
      <span className="text-muted-foreground">{t(UPKEEP_KEYS.decidedOn, { date: formatDate(declaration.declaredAt) })}</span>
      {followsProposal(declaration) === false ? <span className="text-muted-foreground">{t(UPKEEP_KEYS.overrode)}</span> : null}
    </p>
  );
}

function UpkeepItemCard({ item, registry, declaration, canDecide }: ItemProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const key = upkeepItemKeyOf(item.propertyId, item.documentKind);
  const statute = documentKindSpec(item.documentKind).standingObligation?.statute ?? null;
  const error = declaration.error?.key === key ? declaration.error.reason : null;
  return (
    <article className="flex flex-col gap-2">
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.property)}</dt>
        <RegistryPropertyValue propertyId={item.propertyId} names={registry} />
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.document)}</dt>
        <dd className="m-0 text-sm text-foreground">{t(DOCUMENT_KIND_LABEL_KEYS[item.documentKind])}</dd>
      </dl>
      <p className="m-0 text-sm text-muted-foreground">{t(UPKEEP_PROPOSAL_KEYS[item.proposal.reason])}</p>
      <DecisionValue item={item} />
      {statute === null ? null : <p className="m-0 text-xs text-muted-foreground">{t(UPKEEP_KEYS.statute, { statute })}</p>}
      {canDecide ? <RegistryUpkeepDecision item={item} busy={declaration.busyKey === key} onSubmit={declaration.submit} /> : null}
      {error === null ? null : <p role="alert" className="m-0 text-sm text-destructive">{t(UPKEEP_ERROR_KEYS[error])}</p>}
    </article>
  );
}

export interface RegistryUpkeepPanelProps {
  readonly registry: Pick<DocumentRegistryResponse, 'properties' | 'upkeep'>;
  readonly declaration: UpkeepDeclarationSubmit;
  readonly canDecide: boolean;
}

/** Η ενότητα — **τίποτα** όταν δεν υπάρχει ούτε πρόταση ούτε απόφαση (κανένα άδειο πλαίσιο). */
export function RegistryUpkeepPanel({ registry, declaration, canDecide }: RegistryUpkeepPanelProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  if (registry.upkeep.length === 0) return null;
  const pending = registry.upkeep.filter((item) => item.declaration === null).length;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="registry-upkeep-title">
      <header className="flex flex-col gap-1">
        <h2 id="registry-upkeep-title" className="m-0 text-lg font-semibold text-foreground">
          {t(UPKEEP_KEYS.title)}{' '}
          <span className="text-sm font-normal text-muted-foreground">{t(UPKEEP_KEYS.pending, { count: pending })}</span>
        </h2>
        <p className="m-0 text-sm text-muted-foreground">{t(UPKEEP_KEYS.lead)}</p>
      </header>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {registry.upkeep.map((item) => (
          <li key={upkeepItemKeyOf(item.propertyId, item.documentKind)}>
            <Card className="p-4">
              <UpkeepItemCard item={item} registry={registry} declaration={declaration} canDecide={canDecide} />
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
