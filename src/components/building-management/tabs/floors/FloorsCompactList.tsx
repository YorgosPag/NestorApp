'use client';

/**
 * @fileoverview **Οι όροφοι ως λίστα** — η όψη για στενό χώρο: κινητό, ή στενό πάνελ σε desktop (ADR-912 §5).
 * @related FloorsTable.tsx (η όψη για φαρδύ χώρο) · floor-row-model.ts (η κοινή γραμμή)
 * @module components/building-management/tabs/floors/FloorsCompactList
 *
 * 📚 Procore · Autodesk Construction Cloud · Zillow · Idealista: σε στενό πλάτος ο πίνακας **δεν** κυλά οριζόντια —
 * κάθε γραμμή γίνεται στοιχείο λίστας με το όνομα πρώτο και τα μεγέθη από κάτω. Μετρημένο 2026-10-10 στα 390px:
 * ο πίνακας των 7 στηλών έκοβε τη στήλη «Ύψος» στη μέση και έκρυβε **ολόκληρες** τις «Μονάδες» και τις «Ενέργειες» —
 * ο άνθρωπος δεν μπορούσε να επεξεργαστεί ούτε να διαγράψει όροφο από κινητό.
 *
 * 🔑 **Τίποτα δεν λείπει σε σχέση με τον πίνακα**: ίδια μεγέθη, ίδιες πράξεις, ίδια πεδία επεξεργασίας, ίδια
 * επισήμανση σφάλματος. Αλλάζει μόνο η διάταξη. Τα μεγέθη είναι `<dl>` — όρος/τιμή, όπως τα διαβάζει ένας
 * αναγνώστης οθόνης — και κάθε πεδίο επεξεργασίας έχει **ορατή** ετικέτα (στον πίνακα τη δίνει η στήλη).
 */

import type { ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import type { Building } from '@/types/building/contracts';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { BuildingSpaceEditActions } from '../../shared/BuildingSpaceActions';
import { FloorElevationField, FloorHeightField, FloorNameField, FloorNumberField } from './floor-edit-fields';
import { buildFloorRowModel, floorRowTone, type FloorRowModel, type FloorsTabState } from './floor-row-model';
import { FloorExpandButton, FloorExpandedPanel, FloorHeightValue, FloorTitle, FloorViewActions } from './floor-row-parts';

interface FloorsCompactListProps {
  readonly state: FloorsTabState;
  readonly building: Building;
}

interface RowProps {
  readonly row: FloorRowModel;
  readonly state: FloorsTabState;
}

const TERM = 'text-[11px] font-medium uppercase tracking-wide';

function Fact({ term, tone, children }: { term: string; tone?: string; children: ReactNode }) {
  const colors = useSemanticColors();
  return (
    <div className="min-w-0">
      <dt className={cn(TERM, colors.text.muted)}>{term}</dt>
      <dd className={cn('font-mono text-xs', tone ?? colors.text.muted)}>{children}</dd>
    </div>
  );
}

/** Προβολή: όνομα και πράξεις στην πρώτη γραμμή, τα τέσσερα μεγέθη σε πλέγμα 2×2 από κάτω. */
function ViewBody({ row, state }: RowProps) {
  const { t } = useTranslation(['building-tabs']);
  const { floor } = row;
  return (
    <>
      <header className="flex items-start gap-1">
        <FloorExpandButton row={row} state={state} />
        <h3 className="min-w-0 flex-1 self-center text-sm font-medium"><FloorTitle row={row} state={state} /></h3>
        <FloorViewActions row={row} state={state} />
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 pl-9">
        <Fact term={t('tabs.floors.number')}>{floor.number}</Fact>
        <Fact term={t('tabs.floors.elevation')}>{state.formatElevation(floor.elevation)}</Fact>
        <Fact term={t('tabs.floors.height')} tone={row.isTooLow ? getStatusColor('error', 'text') : undefined}>
          <FloorHeightValue row={row} />
        </Fact>
        <Fact term={t('tabs.floors.units')}>{floor.units ?? 0}</Fact>
      </dl>
    </>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  const colors = useSemanticColors();
  return (
    <label className={cn('flex min-w-0 flex-col gap-1', wide && 'col-span-2')}>
      <span className={cn(TERM, colors.text.muted)}>{label}</span>
      {children}
    </label>
  );
}

/** Επεξεργασία: τα ίδια πεδία με τον πίνακα, στοιβαγμένα, με ορατές ετικέτες. Το όνομα πιάνει όλο το πλάτος. */
function EditBody({ row, state }: RowProps) {
  const { t } = useTranslation(['building-tabs']);
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label={t('tabs.floors.name')} wide><FloorNameField state={state} className="w-full" /></Field>
        <Field label={t('tabs.floors.number')}><FloorNumberField state={state} className="w-full" /></Field>
        <Field label={t('tabs.floors.elevation')}><FloorElevationField state={state} className="w-full" /></Field>
        <Field label={t('tabs.floors.height')}><FloorHeightField state={state} row={row} className="w-full" /></Field>
      </div>
      <footer className="flex justify-end">
        <BuildingSpaceEditActions
          onSave={state.handleSaveEdit}
          onCancel={state.cancelEdit}
          saving={state.saving}
          canSave={Boolean(state.editName.trim())}
        />
      </footer>
    </>
  );
}

export function FloorsCompactList({ state, building }: FloorsCompactListProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <ul className="flex flex-col">
        {state.floors.map((floor, index) => {
          const row = buildFloorRowModel(state, index);
          return (
            <li
              key={floor.id}
              ref={(el) => state.registerFloorRowRef(floor.id, el)}
              className={cn(
                'flex flex-col gap-2 border-b border-border/50 px-1 py-3 transition-colors duration-700',
                floorRowTone(row),
              )}
            >
              {row.isEditing ? <EditBody row={row} state={state} /> : <ViewBody row={row} state={state} />}
              {row.isExpanded && (
                <section className="rounded-md bg-muted/5">
                  <FloorExpandedPanel row={row} state={state} building={building} />
                </section>
              )}
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
