'use client';

/**
 * @fileoverview ADR-915 §35 · §36 — **ένα** (ακίνητο, είδος) της μόνιμης υποχρέωσης: η πρόταση με τον λόγο της, η
 *   απόφαση με το ίχνος της, και τα κουμπιά. ΕΝΑ συστατικό για το μητρώο **και** την καρτέλα του ακινήτου.
 * @related RegistryUpkeepPanel.tsx (το μητρώο) · PropertyUpkeepSection.tsx (η καρτέλα ακινήτου) ·
 *   RegistryUpkeepDecision.tsx (τα κουμπιά) · lib/document-validity/property-upkeep.ts (`followsProposal` ·
 *   `proposalChangedSince`)
 * @module components/document-registry/RegistryUpkeepItem
 *
 * 🔑 `names: null` = μέσα στην καρτέλα του ίδιου του ακινήτου: η γραμμή «Ακίνητο» θα επαναλάμβανε την κεφαλίδα.
 * 🔑 «Η πρόταση άλλαξε από τότε» (§36): η απόφαση μένει — ο άνθρωπος κρίνει αν θα την αναιρέσει (§35.9).
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { documentKindSpec } from '@/config/document-validity/document-validity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { followsProposal, proposalChangedSince, type UpkeepItem } from '@/lib/document-validity/property-upkeep';
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

const NAMESPACES = [REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS];

/** Η απόφαση όπως πάρθηκε: τι, γιατί (εξαίρεση), πότε — και αν πήγε **αντίθετα** στην πρόταση της εφαρμογής. */
function DecisionValue({ item }: { readonly item: UpkeepItem }): React.ReactElement | null {
  const { t } = useTranslation(NAMESPACES);
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

export interface RegistryUpkeepItemProps {
  readonly item: UpkeepItem;
  /** Τα ονόματα των ακινήτων (μητρώο) — `null` μέσα στην καρτέλα του ίδιου του ακινήτου. */
  readonly names: Pick<DocumentRegistryResponse, 'properties'> | null;
  readonly declaration: UpkeepDeclarationSubmit;
  readonly canDecide: boolean;
}

export function RegistryUpkeepItem({ item, names, declaration, canDecide }: RegistryUpkeepItemProps): React.ReactElement {
  const { t } = useTranslation(NAMESPACES);
  const key = upkeepItemKeyOf(item.propertyId, item.documentKind);
  const statute = documentKindSpec(item.documentKind).standingObligation?.statute ?? null;
  const error = declaration.error?.key === key ? declaration.error.reason : null;
  return (
    <article className="flex flex-col gap-2">
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {names === null ? null : (
          <>
            <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.property)}</dt>
            <RegistryPropertyValue propertyId={item.propertyId} names={names} />
          </>
        )}
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.document)}</dt>
        <dd className="m-0 text-sm text-foreground">{t(DOCUMENT_KIND_LABEL_KEYS[item.documentKind])}</dd>
      </dl>
      <p className="m-0 text-sm text-muted-foreground">{t(UPKEEP_PROPOSAL_KEYS[item.proposal.reason])}</p>
      <DecisionValue item={item} />
      {proposalChangedSince(item) ? <p className="m-0 text-sm text-muted-foreground">{t(UPKEEP_KEYS.proposalChanged)}</p> : null}
      {statute === null ? null : <p className="m-0 text-xs text-muted-foreground">{t(UPKEEP_KEYS.statute, { statute })}</p>}
      {canDecide ? <RegistryUpkeepDecision item={item} busy={declaration.busyKey === key} onSubmit={declaration.submit} /> : null}
      {error === null ? null : <p role="alert" className="m-0 text-sm text-destructive">{t(UPKEEP_ERROR_KEYS[error])}</p>}
    </article>
  );
}
