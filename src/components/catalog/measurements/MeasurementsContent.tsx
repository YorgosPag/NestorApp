'use client';

/**
 * @fileoverview **Η σελίδα «Μονάδες μέτρησης» του καταλόγου** (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/measurements/MeasurementsContent
 *
 * - Οικογένειες της **πλατφόρμας**: μόνο ανάγνωση + ζωντανή δοκιμή μετατροπής (κωδικοί UNECE, συγκρίσιμες παντού).
 * - Οικογένειες του **χώρου**: επεξεργασία (με `catalog:schema:manage`), append-only όσο χρησιμοποιούνται.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?family=<κωδικός>`) — ο κωδικός, όχι το id: η οικογένεια της πλατφόρμας δεν έχει id.
 */

import React, { useCallback, useMemo } from 'react';
import { Plus, Ruler } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCatalogLibrary, type CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { MeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import { newEntityKey } from '../shared/catalog-actions';
import { useCatalogCanManage, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { CatalogSplit } from '../shared/CatalogSplit';
import { NEW_SELECTION, useCatalogSelection, type CatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard, type UnsavedGuard } from '../shared/use-unsaved-guard';
import { isMeasurementFamilyInUse } from './measurement-draft';
import { MeasurementConversionTester } from './MeasurementConversionTester';
import { MeasurementFamilyEditor } from './MeasurementFamilyEditor';
import { MeasurementFamilyList, useMeasurementFamilyName } from './MeasurementFamilyList';
import { MeasurementUnitsTable } from './MeasurementUnitsTable';

// 🔴 ADR-744 §18 · ADR-923 §5.10.4 Β7 — το `catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
// Καταχωρείται από client component (όχι από το `page.tsx`, που είναι Server Component).
import routeSlice from '@/i18n/generated/routes/o__workspace__catalog__measurements.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/** Οι κωδικοί με εκκρεμή εγγραφή (υπάρχουσα: id · νέα: `new:<κωδικός>`). */
function usePendingCodes(library: CatalogLibrary): ReadonlySet<string> {
  const { view, pendingKeys } = library.ops.measurementFamilies;
  return useMemo(
    () => new Set(view.filter((family) => pendingKeys.has(family.id) || pendingKeys.has(newEntityKey(family.code))).map((family) => family.code)),
    [view, pendingKeys],
  );
}

interface DetailsProps {
  readonly family: MeasurementFamilyDefinition | undefined;
  readonly isNew: boolean;
  readonly library: CatalogLibrary;
  readonly canManage: boolean;
  readonly unsaved: UnsavedGuard;
  readonly selection: CatalogSelection;
}

function MeasurementDetails({ family, isNew, library, canManage, unsaved, selection }: DetailsProps) {
  if (!isNew && family?.source === 'platform') {
    return (
      <section className="flex flex-col gap-4 p-4">
        <MeasurementUnitsTable family={family} />
        <MeasurementConversionTester family={family} />
      </section>
    );
  }
  const record = isNew ? null : library.ops.measurementFamilies.settled.find((item) => item.code === family?.code) ?? null;
  if (!isNew && record === null) return null;
  return (
    <MeasurementFamilyEditor
      key={selection.key}
      record={record}
      inUse={record !== null && isMeasurementFamilyInUse(record.code, library.attributes)}
      ops={library.ops.measurementFamilies}
      canManage={canManage}
      onCreated={(code) => selection.selectIfCurrent(selection.key, code)}
      onDeleted={() => selection.select(null)}
      reportDirty={unsaved.reportDirty}
    />
  );
}

export function MeasurementsContent() {
  const { t } = useCatalogText();
  const library = useCatalogLibrary(useCatalogFailureNotice());
  const canManage = useCatalogCanManage();
  const unsaved = useUnsavedGuard();
  const selection = useCatalogSelection('family');
  const { selected, select } = selection;
  const choose = useCallback((code: string | null) => unsaved.guard(() => select(code)), [unsaved, select]);
  const nameOf = useMeasurementFamilyName();
  const pendingCodes = usePendingCodes(library);
  const isNew = selected === NEW_SELECTION && canManage;
  const family = selected && !isNew ? library.registry.get(selected) : undefined;
  const title = isNew ? t('measurement.newFamily') : family ? nameOf(family) : '';
  return (
    <CatalogPageFrame
      title={t('pages.measurements.title')}
      lead={t('pages.measurements.lead')}
      state={library.state}
      actions={canManage ? (
        <Button type="button" onClick={() => choose(NEW_SELECTION)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('measurement.newFamily')}</Button>
      ) : null}
    >
      <CatalogSplit
        listLabel={t('pages.measurements.title')}
        list={<MeasurementFamilyList families={library.registry.families} selectedCode={selected} pendingCodes={pendingCodes} onSelect={choose} />}
        open={isNew || family !== undefined}
        title={title}
        onClose={() => choose(null)}
        empty={{ icon: Ruler, title: t('measurement.emptyTitle'), description: t('measurement.emptyDescription') }}
        details={<MeasurementDetails family={family} isNew={isNew} library={library} canManage={canManage} unsaved={unsaved} selection={selection} />}
      />
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
