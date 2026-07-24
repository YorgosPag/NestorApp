'use client';

/**
 * ADR-407 Φ9 — left-sidebar Properties panel for a selected `RailingEntity`.
 *
 * Pure presentational component: maps `RAILING_PROPERTY_GROUPS` (the SSoT
 * section/field layout, shared with the ribbon contextual tab via
 * `railing-param-keys.ts`) into `<section>` blocks of generic
 * `BimPropertyRow`s. Mirrors `StairAdvancedPanel` (ADR-358) — same
 * `containerClassName`/`hideHeader` contract so the sidebar tab host can
 * treat every BIM per-type panel identically.
 *
 * Read/write goes through the ONE railing param SSoT (`readRailingField` /
 * `patchRailingField`) so this component never touches `RailingParams`
 * fields directly — no drift possible between the ribbon and this panel.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BimPropertyRow } from '../bim-properties/BimPropertyRow';
import { RAILING_PROPERTY_GROUPS } from '../../bim/railings/railing-property-groups';
import { readRailingField, patchRailingField } from '../../bim/railings/railing-param-access';
import type { RailingEntity } from '../../bim/types/railing-types';
import type { DispatchRailingParamPatch } from './commands/dispatchRailingParamPatch';

export interface RailingAdvancedPanelProps {
  readonly railing: RailingEntity;
  readonly dispatchPatch: DispatchRailingParamPatch;
  /** Override container className (sidebar-tab mode passes a flow-layout class). */
  readonly containerClassName?: string;
  /** Hide the header (caller renders its own — e.g. tab label). */
  readonly hideHeader?: boolean;
}

export function RailingAdvancedPanel({
  railing,
  dispatchPatch,
  containerClassName,
  hideHeader,
}: RailingAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const resolvedClassName =
    containerClassName
    ?? 'fixed right-4 top-20 z-40 flex w-80 max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background/95 p-3 shadow-xl backdrop-blur';

  const handleChange = (commandKey: string, value: string): void => {
    dispatchPatch(railing, patchRailingField(commandKey, railing.params, value));
  };

  return (
    <aside
      aria-label={t('railingAdvancedPanel.title')}
      className={resolvedClassName}
    >
      {!hideHeader && (
        <header>
          <h3 className="text-sm font-medium text-foreground">
            {t('railingAdvancedPanel.title')}
          </h3>
        </header>
      )}
      {RAILING_PROPERTY_GROUPS.map((group) => (
        <section key={group.id} className="flex flex-col gap-1">
          <header>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(group.titleKey)}
            </h4>
          </header>
          {group.fields.map((field) => (
            <BimPropertyRow
              key={field.commandKey}
              field={field}
              value={readRailingField(field.commandKey, railing.params)}
              onChange={handleChange}
            />
          ))}
        </section>
      ))}
    </aside>
  );
}
