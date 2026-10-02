'use client';

/**
 * @fileoverview **Η καρτέλα «Αντικειμενική» του κτιρίου** (ADR-898 Φ4β) — το schedule του Revit για την αντικειμενική:
 * μία γραμμή ανά μονάδα, ομάδες ανά όροφο με υποσύνολο, σύνολο **μόνο όταν είναι αληθινό**, ανάλυση ανά μονάδα με
 * παραπομπή στον νόμο, γεγονότα κτιρίου γραμμένα **μία φορά**, εξαγωγή XLSX.
 * @related `useBuildingObjectiveValueTab.ts` (κατάσταση) · `ADR-898 §17` · `ADR-184` (καρτέλες χώρων κτιρίου)
 * @module components/building-management/tabs/ObjectiveValueTab/BuildingObjectiveValueTab
 *
 * ⛔ Ο πελάτης **δεν** υπολογίζει: ποσά, σύνολο, ερωτήσεις έρχονται από τον server (ADR-889 §10.2 — τίποτα αποθηκευμένο).
 */

import React, { useCallback, useId, useMemo, useState } from 'react';

import { useObjectiveValueFactorLabel } from '@/components/objective-value/ObjectiveValueResult';
import { Button } from '@/components/ui/button';
import { marketDayOf } from '@/lib/listings/listing-stats';
import type { BuildingObjectiveValues, BuildingUnitObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';
import { createModuleLogger } from '@/lib/telemetry';

import { BuildingSpaceTabError, BuildingSpaceTabLoading } from '../../shared/BuildingSpaceTabStatus';
import { BuildingSpaceTable } from '../../shared/BuildingSpaceTable';
import type { SortState } from '../../shared/space-table-sort';
import type { SpaceColumn } from '../../shared/types';
import { buildingObjectiveValueColumns, FLOOR_COLUMN_KEY, isScreenColumn } from './building-objective-value-columns';
import { exportBuildingObjectiveValuesXlsx } from './building-objective-value-xlsx';
import { BuildingObjectiveValueFacts, focusBuildingFact } from './BuildingObjectiveValueFacts';
import { BuildingObjectiveValueSummary } from './BuildingObjectiveValueSummary';
import { BuildingUnitObjectiveValueSheet } from './BuildingUnitObjectiveValueSheet';
import { useBuildingObjectiveValueLabels, type BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';
import { useBuildingObjectiveValueTab, type BuildingObjectiveValueTabState } from './useBuildingObjectiveValueTab';

const B = 'objective-value:building';
const BY_FLOOR: SortState = { key: FLOOR_COLUMN_KEY, direction: 'asc' };
const logger = createModuleLogger('BuildingObjectiveValueTab');

export interface BuildingObjectiveValueTabProps {
  readonly buildingId: string;
  /** Για το όνομα του αρχείου και το φύλλο «Παραδοχές». */
  readonly buildingName: string;
  /** Από τον `UniversalTabsRenderer` — μετάβαση στο χρονοδιάγραμμα, όπου ζει το στάδιο. */
  readonly onNavigateToTab?: (tabId: string) => void;
}

/** Η επιλεγμένη μονάδα και αν είναι ανοιχτό το συρτάρι — χωριστά, ώστε το κλείσιμο να μην αδειάζει το περιεχόμενο. */
function useUnitSheet() {
  const [row, setRow] = useState<BuildingUnitObjectiveValueRow | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((next: BuildingUnitObjectiveValueRow) => {
    setRow(next);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return { row, open, show, close };
}

interface ExportInput {
  readonly data: BuildingObjectiveValues;
  readonly buildingName: string;
  readonly columns: readonly SpaceColumn<BuildingUnitObjectiveValueRow>[];
  readonly sort: SortState | null;
  readonly labels: BuildingObjectiveValueLabels;
}

/** Το κουμπί εξαγωγής: «Εξαγωγή…» όσο γράφεται το αρχείο, και **λόγος** σε αποτυχία — ποτέ σιωπηλό κλικ. */
function ExportButton({ input }: { readonly input: ExportInput }) {
  const factorLabel = useObjectiveValueFactorLabel();
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle');
  const { t } = input.labels;
  const run = () => {
    setStatus('busy');
    exportBuildingObjectiveValuesXlsx({ ...input, factorLabel, exportedOn: marketDayOf(Date.now()) })
      .then(() => setStatus('idle'))
      .catch((cause: unknown) => {
        logger.warn('Η εξαγωγή XLSX απέτυχε', { error: cause instanceof Error ? cause.message : String(cause) });
        setStatus('failed');
      });
  };
  return (
    <span className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={status === 'busy'} onClick={run}>
        {t(status === 'busy' ? `${B}.export.busy` : `${B}.export.button`)}
      </Button>
      {status === 'failed' && <span role="alert" className="text-xs text-destructive">{t(`${B}.export.failed`)}</span>}
    </span>
  );
}

interface ReadyProps {
  readonly data: BuildingObjectiveValues;
  readonly buildingName: string;
  readonly refreshing: boolean;
  readonly state: BuildingObjectiveValueTabState;
  readonly labels: BuildingObjectiveValueLabels;
  readonly onNavigateToTab?: (tabId: string) => void;
}

function Ready({ data, buildingName, refreshing, state, labels, onNavigateToTab }: ReadyProps) {
  const sheet = useUnitSheet();
  const [sort, setSort] = useState<SortState | null>(BY_FLOOR);
  const columns = useMemo(() => buildingObjectiveValueColumns(labels, sheet.show), [labels, sheet.show]);
  const screenColumns = useMemo(() => columns.filter(isScreenColumn), [columns]);
  const { t } = labels;
  const exportInput: ExportInput = { data, buildingName, columns, sort, labels };
  return (
    <>
      <BuildingObjectiveValueSummary
        data={data}
        refreshing={refreshing}
        labels={labels}
        onGoToFact={focusBuildingFact}
        actions={<ExportButton input={exportInput} />}
      />
      {state.facts !== null && (
        <BuildingObjectiveValueFacts
          stage={data.stage}
          facts={state.facts}
          questions={data.questions}
          save={state.save}
          today={data.valuationDate}
          onOpenSchedule={onNavigateToTab ? () => onNavigateToTab('timeline') : undefined}
        />
      )}
      {data.units.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${B}.empty`)}</p>
      ) : (
        <BuildingSpaceTable items={[...data.units]} columns={screenColumns} getKey={(row) => row.id} initialSort={BY_FLOOR} onSortChange={setSort} />
      )}
      <p className="m-0 text-xs text-muted-foreground">{t('objective-value:result.disclaimer')}</p>
      <BuildingUnitObjectiveValueSheet row={sheet.row} open={sheet.open} labels={labels} onClose={sheet.close} />
    </>
  );
}

export function BuildingObjectiveValueTab({ buildingId, buildingName, onNavigateToTab }: BuildingObjectiveValueTabProps) {
  const state = useBuildingObjectiveValueTab(buildingId);
  const labels = useBuildingObjectiveValueLabels();
  const { t } = labels;
  const { values } = state;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="m-0 text-lg font-semibold text-foreground">{t(`${B}.title`)}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t(`${B}.intro`)}</p>
      </header>
      {values.kind === 'loading' && <BuildingSpaceTabLoading />}
      {values.kind === 'failed' && <BuildingSpaceTabError message={t(`${B}.loadFailed`)} retryLabel={t(`${B}.retry`)} onRetry={state.refresh} />}
      {values.kind === 'ready' && (
        <Ready
          data={values.data}
          buildingName={buildingName}
          refreshing={values.refreshing}
          state={state}
          labels={labels}
          onNavigateToTab={onNavigateToTab}
        />
      )}
    </section>
  );
}
