'use client';

/**
 * @fileoverview ADR-915 §41.5 — **η καρτέλα «Όλα τα έγγραφα»**: προβολές (`?view=`) · ομαδοποίηση (`?group=`) · πυκνός πίνακας.
 * @related RegistryTable.tsx · lib/document-validity/document-registry-view.ts · hooks/document-registry/useRegistryAddress.ts
 * @module components/document-registry/RegistryAllTab
 *
 * 🔑 **Ο άνθρωπος διαλέγει τον άξονα** (§41.1 αιτία β): κατά κατάσταση ο ένας άξονας σκόρπιζε τα έγγραφα του ίδιου
 *    ακινήτου σε πέντε ομάδες. Κατά ακίνητο / είδος είναι **ομαδοποίηση** των ίδιων γραμμών — καμία νέα κρίση.
 * 🔑 Μέσα σε κάθε ομάδα μένει η σειρά του διακομιστή (επείγον πρώτα). Η **άδεια** ομάδα δεν ζωγραφίζεται.
 */

import React, { useMemo } from 'react';

import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { groupByKey } from '@/utils/collection-utils';
import {
  REGISTRY_ROW_STATES,
  REGISTRY_WINDOW_DAYS,
  registryRowKindOf,
  registryRowPropertyIdOf,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';
import {
  REGISTRY_GROUPINGS,
  REGISTRY_PICKER_VIEWS,
  registryViewTally,
  rowsOfRegistryView,
  type RegistryGrouping,
  type RegistryView,
} from '@/lib/document-validity/document-registry-view';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { registryPropertyNameOf } from '@/components/document-registry/RegistryPropertyValue';
import { RegistryTable } from '@/components/document-registry/RegistryTable';
import { LAYOUT_KEYS, REGISTRY_GROUPING_LABEL_KEYS } from '@/components/document-registry/registry-layout-labels';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  LEGALITY_NS,
  REGISTRY_KEYS,
  REGISTRY_NS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_VIEW_LABEL_KEYS,
} from '@/components/document-registry/document-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

interface RowGroup {
  readonly key: string;
  readonly heading: string;
  readonly rows: readonly RegistryRow[];
}

/** Κατά κατάσταση: η σειρά επείγοντος του κλειστού συνόλου. */
function groupsByState(t: Translate, rows: readonly RegistryRow[]): readonly RowGroup[] {
  return REGISTRY_ROW_STATES.map((state) => ({
    key: state, heading: t(REGISTRY_STATE_LABEL_KEYS[state]), rows: rows.filter((row) => row.state === state),
  }));
}

/** Κατά ακίνητο ή είδος: `groupByKey` διατηρεί τη σειρά πρώτης εμφάνισης ⇒ πρώτα η ομάδα με το πιο επείγον. */
function groupsByAxis(t: Translate, rows: readonly RegistryRow[], axis: Exclude<RegistryGrouping, 'state'>, registry: DocumentRegistryResponse) {
  const keyOf = (row: RegistryRow): string =>
    axis === 'kind' ? registryRowKindOf(row) : (registryRowPropertyIdOf(row) ?? '');
  return Object.entries(groupByKey([...rows], keyOf)).map(([key, members]): RowGroup => {
    const first = members[0];
    const heading = axis === 'kind'
      ? t(DOCUMENT_KIND_LABEL_KEYS[registryRowKindOf(first)])
      : (registryPropertyNameOf(t, registryRowPropertyIdOf(first), registry) ?? t(LAYOUT_KEYS.groupNoProperty));
    return { key, heading, rows: members };
  });
}

function groupsOf(t: Translate, rows: readonly RegistryRow[], grouping: RegistryGrouping, registry: DocumentRegistryResponse) {
  const groups = grouping === 'state' ? groupsByState(t, rows) : groupsByAxis(t, rows, grouping, registry);
  return groups.filter((group) => group.rows.length > 0);
}

interface ToolbarProps {
  readonly view: RegistryView;
  readonly grouping: RegistryGrouping;
  readonly tally: Readonly<Record<RegistryView, number>>;
  readonly onView: (next: RegistryView) => void;
  readonly onGrouping: (next: RegistryGrouping) => void;
}

function Toolbar({ view, grouping, tally, onView, onGrouping }: ToolbarProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <section className="flex flex-col gap-3" aria-label={t(REGISTRY_KEYS.filterLabel)}>
      {/* Προβολή κατάστασης (από κάρτα) ⇒ κανένα τσιπ πατημένο — την πατημένη τη δείχνει η κάρτα. */}
      <SegmentedControl value={view} onValueChange={onView} aria-label={t(REGISTRY_KEYS.filterLabel)}>
        {REGISTRY_PICKER_VIEWS.map((option) => (
          <SegmentedControlItem key={option} value={option} size="sm">
            {t(REGISTRY_KEYS.filterOption, {
              label: t(REGISTRY_VIEW_LABEL_KEYS[option], { days: REGISTRY_WINDOW_DAYS }), count: tally[option],
            })}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <SegmentedControl value={grouping} onValueChange={onGrouping} aria-label={t(LAYOUT_KEYS.groupingLabel)}>
        {REGISTRY_GROUPINGS.map((option) => (
          <SegmentedControlItem key={option} value={option} size="sm">{t(REGISTRY_GROUPING_LABEL_KEYS[option])}</SegmentedControlItem>
        ))}
      </SegmentedControl>
    </section>
  );
}

export interface RegistryAllTabProps extends Omit<ToolbarProps, 'tally'> {
  readonly registry: DocumentRegistryResponse;
  readonly onOpen: (rowId: string) => void;
}

export function RegistryAllTab({ registry, view, grouping, onView, onGrouping, onOpen }: RegistryAllTabProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const tally = useMemo(() => registryViewTally(registry.rows, registry.asOf), [registry]);
  const groups = useMemo(
    () => groupsOf(t, rowsOfRegistryView(registry.rows, view, registry.asOf), grouping, registry),
    [t, registry, view, grouping],
  );
  return (
    <section className="flex flex-col gap-4">
      <Toolbar view={view} grouping={grouping} tally={tally} onView={onView} onGrouping={onGrouping} />
      {groups.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.filterEmpty)}</p> : null}
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <h2 className="m-0 text-lg font-semibold text-foreground">
            {group.heading}{' '}
            <span className="text-sm font-normal text-muted-foreground">{t(REGISTRY_KEYS.groupCount, { count: group.rows.length })}</span>
          </h2>
          <RegistryTable rows={group.rows} registry={registry} onOpen={onOpen} />
        </section>
      ))}
    </section>
  );
}
