'use client';

/**
 * BuildingVerticalSetupForm — ADR-451 «Quick Setup» (Revit-grade building setup).
 *
 * One step that generates the whole storey stack (basement → ground → upper
 * floors) with consistent elevations, plus the building-level foundation datum
 * (`hasFoundation` + `foundationDepth`). Incremental per-floor editing stays in the
 * «Όροφοι» table — this is only the fast-path bootstrap.
 *
 * SSoT: floors are created through the same `createFloorWithPolicy` path as the
 * inline form (server reconcile keeps `height` derived from `elevation`); the
 * stack itself comes from the pure {@link generateFloorStack} generator.
 *
 * @module components/building-management/tabs/BuildingVerticalSetupForm
 * @see docs/centralized-systems/reference/adrs/ADR-451-building-vertical-setup-floor-ssot.md
 */

import { useCallback, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Check, X, AlertTriangle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getStatusColor } from '@/lib/design-system';
import { formatFloorLabel } from '@/lib/intl-domain';
import { createFloorWithPolicy } from '@/services/floor-mutation-gateway';
import { updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import { createFloor } from '@/services/factories/floor.factory';
import { isBuildingStorey } from '@/utils/floor-naming';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  generateFloorStack,
  DEFAULT_TYPICAL_STOREY_HEIGHT_M,
} from './building-vertical-setup';
import {
  DEFAULT_BUILDING_FOUNDATION_DEPTH_M,
  DEFAULT_BUILDING_FOUNDATION_DEPTH_AUTO,
  DEFAULT_BUILDING_STAIR_PENTHOUSE_HEIGHT_M,
} from '@/types/building/elevation.schemas';
// ADR-488 §6.2 — δυναμικό βάθος θεμελίωσης (shared engine· seed στο bootstrap).
import { seedDerivedFoundationDepthMm } from '@/types/building/derived-foundation-depth';

interface FloorMutationResponse {
  floorId?: string;
  data?: { floorId: string };
}

export interface BuildingVerticalSetupFormProps {
  buildingId: string;
  projectId?: string;
  /** Existing floor numbers — generation skips these (idempotent, no 409). */
  existingFloorNumbers: ReadonlySet<number>;
  /** Called after the stack is created so the parent refreshes the list. */
  onComplete: () => void;
  onCancel: () => void;
}

function parseCount(value: string): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function BuildingVerticalSetupForm({
  buildingId,
  projectId,
  existingFloorNumbers,
  onComplete,
  onCancel,
}: BuildingVerticalSetupFormProps) {
  const { t } = useTranslation(['building', 'building-tabs']);
  const { success, error: notifyError } = useNotifications();
  const colors = useSemanticColors();

  const [basements, setBasements] = useState('0');
  const [uppers, setUppers] = useState('2');
  const [typicalHeight, setTypicalHeight] = useState(DEFAULT_TYPICAL_STOREY_HEIGHT_M.toFixed(2));
  const [hasFoundation, setHasFoundation] = useState(true);
  // ADR-488 §6.2 — το βάθος θεμελίωσης παράγεται δυναμικά (Auto) by default· ο μηχανικός
  // μπορεί να κάνει χειροκίνητη υπέρβαση. Στο bootstrap (καθόλου πέδιλα ακόμη) χρησιμοποιούμε
  // το seed του engine (τυπικό πέδιλο + συνδετήριες = 1,20μ) αντί για χειροκίνητη σταθερά.
  const [foundationDepthIsAuto, setFoundationDepthIsAuto] = useState(DEFAULT_BUILDING_FOUNDATION_DEPTH_AUTO);
  const derivedFoundationDepthM = useMemo(() => seedDerivedFoundationDepthMm() / 1000, []);
  const [foundationDepth, setFoundationDepth] = useState(DEFAULT_BUILDING_FOUNDATION_DEPTH_M.toFixed(2));
  // Το ενεργό βάθος που οδηγεί stack + persist: derived (Auto) ή χειροκίνητο (υπέρβαση).
  const effectiveFoundationDepthM = foundationDepthIsAuto
    ? derivedFoundationDepthM
    : parseFloat(foundationDepth) || DEFAULT_BUILDING_FOUNDATION_DEPTH_M;
  const [hasStairPenthouse, setHasStairPenthouse] = useState(true);
  const [stairPenthouseHeight, setStairPenthouseHeight] = useState(DEFAULT_BUILDING_STAIR_PENTHOUSE_HEIGHT_M.toFixed(2));
  const [busy, setBusy] = useState(false);

  // ADR-461 — foundation & stair-penthouse are emitted as special levels (own
  // FloorKind, Revit «Building Story» OFF) so the table can mark them and exclude
  // them from the «Όροφοι: N» count.
  const stack = useMemo(
    () => generateFloorStack({
      basementCount: parseCount(basements),
      upperCount: parseCount(uppers),
      typicalHeightM: parseFloat(typicalHeight) || DEFAULT_TYPICAL_STOREY_HEIGHT_M,
      hasFoundation,
      foundationDepthM: effectiveFoundationDepthM,
      hasStairPenthouse,
      stairPenthouseHeightM: parseFloat(stairPenthouseHeight) || DEFAULT_BUILDING_STAIR_PENTHOUSE_HEIGHT_M,
    }),
    [basements, uppers, typicalHeight, hasFoundation, effectiveFoundationDepthM, hasStairPenthouse, stairPenthouseHeight],
  );

  // Idempotent (Revit-grade): only create storeys that don't already exist —
  // never crash on a duplicate number, never leave a half-built stack.
  const newSpecs = useMemo(
    () => stack.filter((s) => !existingFloorNumbers.has(s.number)),
    [stack, existingFloorNumbers],
  );
  const skippedCount = stack.length - newSpecs.length;

  const handleGenerate = useCallback(async () => {
    setBusy(true);
    try {
      // Create storeys low → high so the server reconcile sees a consistent chain.
      for (const spec of newSpecs) {
        // ADR-461 — special levels (foundation / stair-penthouse) auto-derive their
        // Greek canonical name from `kind` ("Θεμελίωση" / "Απόληξη Κλιμακοστασίου");
        // counted storeys keep the locale floor label. `formatFloorLabel(number)`
        // would mis-label a special level (its number is just lowest−1 / top+1).
        const isSpecialLevel = !isBuildingStorey(spec.kind);
        const floor = createFloor({
          number: spec.number,
          kind: spec.kind,
          ...(isSpecialLevel ? {} : { name: formatFloorLabel(spec.number) }),
          buildingId,
          elevation: spec.elevation,
          height: spec.height,
          ...(projectId ? { projectId } : {}),
        });
        const payload: Record<string, unknown> = {
          number: floor.number,
          name: floor.name,
          kind: floor.kind,
          longName: floor.longName,
          nameAutoGenerated: floor.nameAutoGenerated,
          longNameAutoGenerated: floor.longNameAutoGenerated,
          finishThickness: floor.finishThickness,
          buildingId,
        };
        if (floor.elevation !== undefined) payload.elevation = floor.elevation;
        if (floor.height !== null && floor.height !== undefined) payload.height = floor.height;
        if (projectId) payload.projectId = projectId;
        await createFloorWithPolicy<FloorMutationResponse>({ payload });
      }

      // ADR-461 — foundation & stair-penthouse datums (building-level), NOT counted
      // storeys. Persisted alongside the special-level floor records above so the
      // building keeps the toggle state for re-runs / downstream DXF levels.
      await updateBuildingWithPolicy({
        buildingId,
        updates: {
          hasFoundation,
          foundationDepth: hasFoundation ? effectiveFoundationDepthM : 0,
          // ADR-488 §6.2 — διατήρησε αν το βάθος είναι Auto (παράγεται) ή χειροκίνητη υπέρβαση.
          foundationDepthAuto: foundationDepthIsAuto,
          hasStairPenthouse,
          stairPenthouseHeight: hasStairPenthouse ? parseFloat(stairPenthouseHeight) || 0 : 0,
        },
      });

      const created = newSpecs.length;
      if (created === 0) {
        success(t('tabs.floors.quickSetup.allExist'));
      } else if (skippedCount > 0) {
        success(t('tabs.floors.quickSetup.successSkipped', { created, skipped: skippedCount }));
      } else {
        success(t('tabs.floors.quickSetup.success', { count: created }));
      }
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      notifyError(t('tabs.floors.quickSetup.error') + (msg ? `: ${msg}` : ''));
    } finally {
      setBusy(false);
    }
  }, [newSpecs, skippedCount, buildingId, projectId, hasFoundation, effectiveFoundationDepthM, foundationDepthIsAuto, hasStairPenthouse, stairPenthouseHeight, t, success, notifyError, onComplete]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3" role="group">
      <header className="flex items-center gap-2 text-sm font-semibold">
        <Building2 className="h-4 w-4 text-primary" />
        {t('tabs.floors.quickSetup.title')}
      </header>

      {skippedCount > 0 && (
        <p className={cn('flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs', getStatusColor('warning', 'border'), getStatusColor('warning', 'text'))}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('tabs.floors.quickSetup.existingWarning', { skipped: skippedCount })}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <fieldset className="flex flex-col gap-1">
          <label className={cn('text-xs font-medium', colors.text.muted)}>{t('tabs.floors.quickSetup.basements')}</label>
          <Input type="number" min="0" value={basements} onChange={(e) => setBasements(e.target.value)} className="h-9" disabled={busy} />
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <label className={cn('text-xs font-medium', colors.text.muted)}>{t('tabs.floors.quickSetup.uppers')}</label>
          <Input type="number" min="0" value={uppers} onChange={(e) => setUppers(e.target.value)} className="h-9" disabled={busy} />
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <label className={cn('text-xs font-medium', colors.text.muted)}>{t('tabs.floors.quickSetup.typicalHeight')}</label>
          <Input type="number" step="0.01" min="0.1" value={typicalHeight} onChange={(e) => setTypicalHeight(e.target.value)} className="h-9" disabled={busy} />
        </fieldset>
      </section>

      <section className="flex flex-wrap items-end gap-3">
        <label htmlFor="vs-has-foundation" className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <Checkbox id="vs-has-foundation" checked={hasFoundation} onCheckedChange={(v) => setHasFoundation(v === true)} disabled={busy} />
          {t('tabs.floors.quickSetup.hasFoundation')}
        </label>
        {hasFoundation && (
          <fieldset className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <label className={cn('text-xs font-medium', colors.text.muted)}>{t('tabs.floors.quickSetup.foundationDepth')}</label>
              {foundationDepthIsAuto && (
                <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase', getStatusColor('info', 'border'), getStatusColor('info', 'text'))}>
                  {t('tabs.floors.quickSetup.foundationDepthAutoBadge')}
                </span>
              )}
            </span>
            {foundationDepthIsAuto ? (
              <>
                <Input type="number" value={derivedFoundationDepthM.toFixed(2)} className="h-9 w-28" disabled readOnly />
                <span className={cn('text-[10px]', colors.text.muted)}>{t('tabs.floors.quickSetup.foundationDepthDerivedFrom')}</span>
                <Button type="button" variant="link" size="sm" className="h-auto justify-start p-0 text-[10px]" onClick={() => { setFoundationDepth(derivedFoundationDepthM.toFixed(2)); setFoundationDepthIsAuto(false); }} disabled={busy}>
                  {t('tabs.floors.quickSetup.foundationDepthOverride')}
                </Button>
              </>
            ) : (
              <>
                <Input type="number" step="0.01" min="0" value={foundationDepth} onChange={(e) => setFoundationDepth(e.target.value)} className="h-9 w-28" disabled={busy} />
                <Button type="button" variant="link" size="sm" className="h-auto justify-start p-0 text-[10px]" onClick={() => setFoundationDepthIsAuto(true)} disabled={busy}>
                  {t('tabs.floors.quickSetup.foundationDepthAutoReset')}
                </Button>
              </>
            )}
          </fieldset>
        )}
        <label htmlFor="vs-has-stair-penthouse" className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <Checkbox id="vs-has-stair-penthouse" checked={hasStairPenthouse} onCheckedChange={(v) => setHasStairPenthouse(v === true)} disabled={busy} />
          {t('tabs.floors.quickSetup.hasStairPenthouse')}
        </label>
        {hasStairPenthouse && (
          <fieldset className="flex flex-col gap-1">
            <label className={cn('text-xs font-medium', colors.text.muted)}>{t('tabs.floors.quickSetup.stairPenthouseHeight')}</label>
            <Input type="number" step="0.01" min="0" value={stairPenthouseHeight} onChange={(e) => setStairPenthouseHeight(e.target.value)} className="h-9 w-28" disabled={busy} />
          </fieldset>
        )}
      </section>

      <footer className="flex items-center justify-between">
        <p className={cn('text-xs', colors.text.muted)}>{t('tabs.floors.quickSetup.preview', { count: newSpecs.length })}</p>
        <nav className="flex gap-1">
          <Button type="button" size="sm" className="h-9" onClick={handleGenerate} disabled={busy || newSpecs.length === 0}>
            {busy ? <Spinner size="small" color="inherit" /> : <Check className="mr-1 h-4 w-4" />}
            {t('tabs.floors.quickSetup.generate')}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onCancel} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </nav>
      </footer>
    </section>
  );
}

export default BuildingVerticalSetupForm;
