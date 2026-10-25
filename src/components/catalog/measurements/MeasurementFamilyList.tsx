'use client';

/**
 * @fileoverview **Οι οικογένειες μέτρησης: της πλατφόρμας και του χώρου, χωριστά** (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/measurements/MeasurementFamilyList
 *
 * 🔑 Η διάκριση **λέγεται**: της πλατφόρμας = συγκρίσιμες σε όλη την πύλη, μόνο ανάγνωση· του χώρου = ελεύθερες, αλλά
 *    «μη συγκρίσιμες» ως την έγκριση του §17 — ο προμηθευτής ξέρει από την αρχή τι κερδίζει και τι όχι.
 */

import React, { useCallback } from 'react';
import { Ruler } from 'lucide-react';

import type { MeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import { findUnit } from '@/subapps/catalog/measurement/conversion';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogListItem, CatalogListSection } from '../shared/CatalogList';

/** Το όνομα μιας οικογένειας μέτρησης: κλειδί i18n (πλατφόρμα) ή κείμενο του χρήστη (χώρος). */
export function useMeasurementFamilyName(): (family: MeasurementFamilyDefinition) => string {
  const { t, text } = useCatalogText();
  return useCallback(
    (family: MeasurementFamilyDefinition) =>
      family.label.kind === 'i18n' ? t(family.label.key) : text(family.label.text, family.code),
    [t, text],
  );
}

interface MeasurementFamilyListProps {
  readonly families: readonly MeasurementFamilyDefinition[];
  readonly selectedCode: string | null;
  readonly pendingCodes: ReadonlySet<string>;
  readonly onSelect: (code: string) => void;
}

export function MeasurementFamilyList({ families, selectedCode, pendingCodes, onSelect }: MeasurementFamilyListProps) {
  const { t } = useCatalogText();
  const nameOf = useMeasurementFamilyName();
  const platform = families.filter((family) => family.source === 'platform');
  const workspace = families.filter((family) => family.source === 'workspace');
  const item = (family: MeasurementFamilyDefinition) => (
    <li key={family.code}>
      <CatalogListItem
        icon={Ruler}
        primary={nameOf(family)}
        secondary={findUnit(family, family.standardUnitCode)?.symbol ?? family.standardUnitCode}
        badges={family.source === 'workspace' ? [{ label: t('measurement.notComparable'), variant: 'warning' }] : []}
        selected={family.code === selectedCode}
        pending={pendingCodes.has(family.code)}
        onSelect={() => onSelect(family.code)}
      />
    </li>
  );
  return (
    <>
      <CatalogListSection title={t('measurement.workspaceFamilies')} count={workspace.length}>
        {workspace.length === 0 ? (
          <p className="m-0 px-2 text-sm text-muted-foreground">{t('measurement.noWorkspaceFamilies')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{workspace.map(item)}</ul>
        )}
      </CatalogListSection>
      <CatalogListSection title={t('measurement.platformFamilies')} count={platform.length}>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{platform.map(item)}</ul>
      </CatalogListSection>
    </>
  );
}
