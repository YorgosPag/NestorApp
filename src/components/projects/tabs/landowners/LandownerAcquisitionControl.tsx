'use client';

/**
 * Landowner acquisition status — per-row selector + tri-state summary.
 *
 * Split out of `ProjectLandownersTab` for two reasons:
 * 1. N.7.1 — the tab would exceed 500 lines.
 * 2. ADR-745 Φ3β will render the same status on the canvas title block; a shared
 *    control means one vocabulary, not two.
 *
 * Business logic lives in `@/lib/ownership/landowner-acquisition` — this file is
 * pure presentation.
 *
 * @module components/projects/tabs/landowners/LandownerAcquisitionControl
 * @enterprise ADR-244 (Landowners) · ADR-745 Φ3α
 */

import React, { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';
import { allowedTransitionsFrom, summarizeAcquisition } from '@/lib/ownership/landowner-acquisition';
import type { AcquisitionStatus, LandownerEntry } from '@/types/ownership-table';

// ============================================================================
// STATIC MAPS
// ============================================================================

/**
 * Status → i18n key.
 *
 * ⚠️ Literal strings on purpose — **never** `t(\`…status.${value}\`)`.
 * Dynamic keys are unresolvable for the i18n shell-slice generator (CHECK 3.34),
 * which refuses to emit when it meets one, and invisible to the reachability
 * check (CHECK 3.13).
 */
const STATUS_LABEL_KEY: Record<AcquisitionStatus, string> = {
  prospective: 'ownership.landownersTab.acquisition.status.prospective',
  under_contract: 'ownership.landownersTab.acquisition.status.under_contract',
  secured: 'ownership.landownersTab.acquisition.status.secured',
  withdrawn: 'ownership.landownersTab.acquisition.status.withdrawn',
};

const STATUS_HINT_KEY: Record<AcquisitionStatus, string> = {
  prospective: 'ownership.landownersTab.acquisition.hint.prospective',
  under_contract: 'ownership.landownersTab.acquisition.hint.under_contract',
  secured: 'ownership.landownersTab.acquisition.hint.secured',
  withdrawn: 'ownership.landownersTab.acquisition.hint.withdrawn',
};

/**
 * Status → text colour on the trigger itself.
 *
 * Colour lives on the existing control rather than on a separate Badge: a badge
 * beside the selector would state the same fact twice, and importing `Badge` here
 * pulls in the whole effects module — which broke the existing save-gate test the
 * moment this file entered the tab's import graph.
 */
const STATUS_TEXT_CLASS: Record<AcquisitionStatus, string> = {
  prospective: COLOR_BRIDGE.text.warning,
  under_contract: COLOR_BRIDGE.text.info,
  secured: COLOR_BRIDGE.text.success,
  withdrawn: COLOR_BRIDGE.text.muted,
};

// ============================================================================
// PER-ROW SELECTOR
// ============================================================================

interface LandownerAcquisitionSelectProps {
  /** `undefined` = δεν δηλώθηκε (δεν είναι τιμή — είναι απουσία τιμής) */
  readonly value: AcquisitionStatus | undefined;
  readonly onChange: (next: AcquisitionStatus) => void;
  readonly ownerName: string;
  readonly disabled?: boolean;
}

export function LandownerAcquisitionSelect({
  value,
  onChange,
  ownerName,
  disabled = false,
}: LandownerAcquisitionSelectProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);

  // Only the transitions the FSM allows from here — the UI never offers a move
  // that the domain would reject.
  const options = useMemo(() => allowedTransitionsFrom(value), [value]);

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as AcquisitionStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn('h-9 w-44', value && STATUS_TEXT_CLASS[value])}
        aria-label={t('ownership.landownersTab.acquisition.selectAria', { name: ownerName })}
      >
        <SelectValue placeholder={t('ownership.landownersTab.acquisition.notDeclared')} />
      </SelectTrigger>
      <SelectContent>
        {options.map((status) => (
          <SelectItem key={status} value={status} title={t(STATUS_HINT_KEY[status])}>
            {t(STATUS_LABEL_KEY[status])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// TRI-STATE SUMMARY
// ============================================================================

/**
 * «Κλειδωμένο 66,67%» — but only when that number means something.
 *
 * A bare 0% would show on **every** pre-existing project and would look identical
 * to a project where everyone was explicitly declared and nobody has secured yet.
 * The three branches come from `summarizeAcquisition().kind`, so the decision has
 * exactly one home.
 */
export function LandownerAcquisitionSummary({
  entries,
}: {
  readonly entries: readonly LandownerEntry[];
}) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const summary = useMemo(() => summarizeAcquisition(entries), [entries]);

  if (summary.totalCount === 0) return null;

  if (summary.kind === 'none') {
    return (
      <span className={cn('text-xs', COLOR_BRIDGE.text.muted)}>
        {t('ownership.landownersTab.acquisition.summary.none')}
      </span>
    );
  }

  const pct = summary.securedPct.toFixed(2).replace(/\.?0+$/, '');

  if (summary.kind === 'partial') {
    return (
      <span className={cn('text-xs', COLOR_BRIDGE.text.muted)}>
        {t('ownership.landownersTab.acquisition.summary.partial', {
          pct,
          missing: summary.undeclaredCount,
        })}
      </span>
    );
  }

  return (
    <span className={cn('text-xs font-medium', COLOR_BRIDGE.text.success)}>
      {t('ownership.landownersTab.acquisition.summary.complete', { pct })}
    </span>
  );
}
