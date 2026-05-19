'use client';

/**
 * ADR-363 Phase 7.1 Step 6.4 — Common-properties bulk-edit widget.
 *
 * Live commit on Enter / blur. Internal `pendingValues` map κρατάει string
 * inputs (επιτρέπει mid-type values). Όταν ο χρήστης πατήσει Enter / blur,
 * γίνεται parse + range check + dispatch `executeBulkPatch` (CompoundCommand,
 * single undo step). Mixed values εμφανίζονται με placeholder `differentValues`.
 *
 * ADR-040 Rule 1: subscribe to selection store μέσα στο leaf (όχι σε
 * CanvasSection orchestrator).
 *
 * Empty intersection (e.g. wall + stair) → εμφάνιση hint message που οδηγεί
 * τον χρήστη στο Filter panel.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useMultiSelectionRibbonBridge } from '../hooks/useMultiSelectionRibbonBridge';
import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';
import type { BimEditableProperty, BimEditablePropertyKey } from '../../../bim/types/bim-common-properties';
import type { BimBulkEditPatch } from '../../../bim/cascade/bim-bulk-update-builder';
import type { MultiSelectionValue } from '../hooks/useMultiSelectionRibbonBridge';

export function MultiSelectionCommonPropertiesPanel(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();

  const bridge = useMultiSelectionRibbonBridge({ levelManager, universalSelection });

  if (bridge.mode !== 'multi') return null;

  if (bridge.commonProperties.length === 0) {
    return (
      <div className="dxf-ribbon-multi-common dxf-ribbon-multi-common--empty">
        <span className="dxf-ribbon-multi-common-hint">
          {t('ribbon.contextualTabs.multiSelection.emptyCommon')}
        </span>
      </div>
    );
  }

  return (
    <div className="dxf-ribbon-multi-common">
      {bridge.commonProperties.map((prop) => (
        <PropertyInput
          key={prop.key}
          prop={prop}
          initialValue={bridge.currentValues.get(prop.key) ?? 'mixed'}
          onCommit={(value) => bridge.executeBulkPatch({ [prop.key]: value } as BimBulkEditPatch)}
          mixedLabel={t('ribbon.contextualTabs.multiSelection.differentValues')}
        />
      ))}
    </div>
  );
}

// ─── Single input row (label + numeric input) ────────────────────────────────

interface PropertyInputProps {
  readonly prop: BimEditableProperty;
  readonly initialValue: MultiSelectionValue;
  readonly onCommit: (value: number) => void;
  readonly mixedLabel: string;
}

function PropertyInput(props: PropertyInputProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { prop, initialValue, onCommit, mixedLabel } = props;

  const initialString = useMemo(
    () => (typeof initialValue === 'number' ? String(initialValue) : ''),
    [initialValue],
  );
  const [draft, setDraft] = useState<string>(initialString);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef<boolean>(false);

  // Reset draft όταν bridge re-emits new initial (νέα selection / external change).
  React.useEffect(() => { setDraft(initialString); }, [initialString]);

  const commit = useCallback(() => {
    const parsed = Number.parseFloat(draft);
    if (Number.isNaN(parsed)) {
      setDraft(initialString);
      return;
    }
    const clamped = Math.min(prop.max, Math.max(prop.min, parsed));
    if (typeof initialValue === 'number' && clamped === initialValue) return;
    onCommit(clamped);
  }, [draft, initialString, initialValue, prop.max, prop.min, onCommit]);

  // ESC reverts draft + blurs (ADR-364 escape-bus SSoT — owns ESC while focused).
  useEscapeHandler({
    id: `ribbon-multi-${prop.key}`,
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => focusedRef.current,
    handle: () => {
      setDraft(initialString);
      inputRef.current?.blur();
      return true;
    },
  });

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const placeholder = initialValue === 'mixed' ? mixedLabel : '';

  return (
    <label className="dxf-ribbon-multi-common-row">
      <span className="dxf-ribbon-multi-common-label">{t(prop.labelKey)}</span>
      <input
        ref={inputRef}
        className="dxf-ribbon-multi-common-input"
        type="number"
        inputMode="numeric"
        min={prop.min}
        max={prop.max}
        step={1}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => { focusedRef.current = false; commit(); }}
        onKeyDown={onKeyDown}
        aria-label={t(prop.labelKey)}
      />
    </label>
  );
}
