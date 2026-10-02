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
import { marketDayOf } from '@/lib/listings/listing-stats';
import type { BuildingObjectiveValues, BuildingObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';

import { BuildingSpaceTabError, BuildingSpaceTabLoading } from '../../shared/BuildingSpaceTabStatus';
import { BuildingSpaceTable } from '../../shared/BuildingSpaceTable';
import { SpaceExportButton } from '../../shared/SpaceExportButton';
import type { SortState } from '../../shared/space-table-sort';
import type { SpaceColumn } from '../../shared/types';
import { useExportAction } from '../../shared/useExportAction';
import { buildingObjectiveValueColumns, FLOOR_COLUMN_KEY } from './building-objective-value-columns';
import { exportBuildingObjectiveValuesXlsx } from './building-objective-value-xlsx';
import { BuildingObjectiveValueFacts, focusBuildingFact } from './BuildingObjectiveValueFacts';
import { BuildingObjectiveValueSummary } from './BuildingObjectiveValueSummary';
import { BuildingUnitObjectiveValueSheet } from './BuildingUnitObjectiveValueSheet';
import { useBuildingObjectiveValueLabels, type BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';
import { useBuildingObjectiveValueTab, type BuildingObjectiveValueTabState } from './useBuildingObjectiveValueTab';

const B = 'objective-value:building';
const BY_FLOOR: SortState = { key: FLOOR_COLUMN_KEY, direction: 'asc' };

export interface BuildingObjectiveValueTabProps {
  readonly buildingId: string;
  /** Για το όνομα του αρχείου και το φύλλο «Παραδοχές». */
  readonly buildingName: string;
  /** Από τον `UniversalTabsRenderer` — μετάβαση στο χρονοδιάγραμμα, όπου ζει το στάδιο. */
  readonly onNavigateToTab?: (tabId: string) => void;
}

/** Η επιλεγμένη μονάδα και αν είναι ανοιχτό το συρτάρι — χωριστά, ώστε το κλείσιμο να μην αδειάζει το περιεχόμενο. */
function useUnitSheet() {
  const [row, setRow] = useState<BuildingObjectiveValueRow | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((next: BuildingObjectiveValueRow) => {
    setRow(next);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return { row, open, show, close };
}

interface ExportInput {
  readonly data: BuildingObjectiveValues;
  readonly buildingName: string;
  readonly columns: readonly SpaceColumn<BuildingObjectiveValueRow>[];
  readonly sort: SortState | null;
  readonly labels: BuildingObjectiveValueLabels;
}

/** Η εξαγωγή διαβάζει ό,τι δείχνει η οθόνη **τη στιγμή του κλικ** (δεδομένα · στήλες · σειρά) — κοινό κουμπί και κατάσταση. */
function ExportButton({ input }: { readonly input: ExportInput }) {
  const factorLabel = useObjectiveValueFactorLabel();
  const action = useExportAction(() => exportBuildingObjectiveValuesXlsx({ ...input, factorLabel, exportedOn: marketDayOf(Date.now()) }));
  return <SpaceExportButton action={action} />;
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
  const columns = useMemo(() => buildingObjectiveValueColumns(labels, data.rows, sheet.show), [labels, data.rows, sheet.show]);
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
          asksStorageEntrance={data.rows.some((row) => row.kind === 'storage') || state.facts.basementStorageEntrance !== null}
          onOpenSchedule={onNavigateToTab ? () => onNavigateToTab('timeline') : undefined}
        />
      )}
      {data.rows.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${B}.empty`)}</p>
      ) : (
        <BuildingSpaceTable items={[...data.rows]} columns={columns} getKey={(row) => row.id} initialSort={BY_FLOOR} onSortChange={setSort} />
      )}
      <p className="m-0 text-xs text-muted-foreground">{t('objective-value:result.disclaimer')}</p>
      <BuildingUnitObjectiveValueSheet row={sheet.row} rows={data.rows} references={data.references} open={sheet.open} labels={labels} onOpen={sheet.show} onClose={sheet.close} />
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
