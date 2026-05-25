'use client';

/**
 * ADR-376 Phase B.1 — Renumber Openings dialog.
 *
 * IMAGINiT-style global utility dialog. Pure UI — all data/services are
 * injected via props. Caller (`RenumberOpeningsHost`) wires
 *   - scope/floor list / floorNumberByFloorId map
 *   - kind prefixes (i18n-resolved)
 *   - confirm callback → executes ICommand via CommandHistory
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §7 Phase B.1
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import type { OpeningKind } from '../../../bim/types/opening-types';
import {
  computeRenumberUpdates,
  type RenumberOpeningRow,
  type RenumberScope,
  type RenumberResult,
} from '../../../bim/services/opening-renumber-service';

const ALL_KINDS: ReadonlyArray<OpeningKind> = [
  'door',
  'sliding-door',
  'french-door',
  'window',
  'fixed',
];

export interface RenumberOpeningsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** Pre-fetched openings rows for the active floorplan. */
  readonly rows: ReadonlyArray<RenumberOpeningRow>;
  /** Current floor scope candidate — null = no current floor active. */
  readonly currentFloor: { readonly floorId: string; readonly floorNumber: number } | null;
  /** Floor.number lookup map για 'all-floors' scope. */
  readonly floorNumberByFloorId: ReadonlyMap<string, number>;
  /** i18n-resolved per-kind prefix (Θ/Σ/ΔΘ/Π/ΣΥ). */
  readonly kindPrefixes: Readonly<Record<OpeningKind, string>>;
  /** i18n-resolved basement prefix (Υ in el, B in en). */
  readonly basementPrefix: string;
  /** Called with the resolved RenumberResult όταν user πατάει "Εκτέλεση". */
  readonly onConfirm: (result: RenumberResult) => void;
}

export function RenumberOpeningsDialog(props: RenumberOpeningsDialogProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const [scopeKind, setScopeKind] = React.useState<'current-floor' | 'all-floors'>(
    props.currentFloor ? 'current-floor' : 'all-floors',
  );
  const [kindSelection, setKindSelection] = React.useState<ReadonlySet<OpeningKind>>(
    () => new Set(ALL_KINDS),
  );
  const [includeManual, setIncludeManual] = React.useState(false);

  const scope: RenumberScope | null = React.useMemo(() => {
    if (scopeKind === 'current-floor') {
      return props.currentFloor
        ? { kind: 'current-floor', floorId: props.currentFloor.floorId, floorNumber: props.currentFloor.floorNumber }
        : null;
    }
    return { kind: 'all-floors' };
  }, [scopeKind, props.currentFloor]);

  const result: RenumberResult | null = React.useMemo(() => {
    if (!scope) return null;
    return computeRenumberUpdates(props.rows, {
      scope,
      includeManual,
      kindFilter: Array.from(kindSelection),
      kindPrefixes: props.kindPrefixes,
      basementPrefix: props.basementPrefix,
      floorNumberByFloorId: props.floorNumberByFloorId,
    });
  }, [scope, includeManual, kindSelection, props.rows, props.kindPrefixes, props.basementPrefix, props.floorNumberByFloorId]);

  const updateCount = result?.updates.length ?? 0;

  const toggleKind = (kind: OpeningKind) => {
    setKindSelection((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const handleConfirm = () => {
    if (result) props.onConfirm(result);
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ribbon.commands.openingEditor.renumber.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('ribbon.commands.openingEditor.renumber.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">
            {t('ribbon.commands.openingEditor.renumber.dialog.scope.label')}
          </legend>
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-2">
              <input
                type="radio"
                name="renumber-scope"
                value="current-floor"
                checked={scopeKind === 'current-floor'}
                disabled={!props.currentFloor}
                onChange={() => setScopeKind('current-floor')}
              />
              <span>{t('ribbon.commands.openingEditor.renumber.dialog.scope.currentFloor')}</span>
            </Label>
            <Label className="flex items-center gap-2">
              <input
                type="radio"
                name="renumber-scope"
                value="all-floors"
                checked={scopeKind === 'all-floors'}
                onChange={() => setScopeKind('all-floors')}
              />
              <span>{t('ribbon.commands.openingEditor.renumber.dialog.scope.allFloors')}</span>
            </Label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">
            {t('ribbon.commands.openingEditor.renumber.dialog.kindFilter.label')}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {ALL_KINDS.map((kind) => (
              <Label key={kind} className="flex items-center gap-2">
                <Checkbox
                  checked={kindSelection.has(kind)}
                  onCheckedChange={() => toggleKind(kind)}
                />
                <span>{t(`ribbon.commands.openingEditor.kind.${toCamel(kind)}`)}</span>
              </Label>
            ))}
          </div>
        </fieldset>

        <Label className="flex items-center gap-2">
          <Checkbox
            checked={includeManual}
            onCheckedChange={(next) => setIncludeManual(next === true)}
          />
          <span>{t('ribbon.commands.openingEditor.renumber.dialog.includeManual.label')}</span>
        </Label>

        <p className="text-sm text-muted-foreground">
          {t('ribbon.commands.openingEditor.renumber.dialog.preview', { count: updateCount })}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            {t('ribbon.commands.openingEditor.renumber.dialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={updateCount === 0}>
            {t('ribbon.commands.openingEditor.renumber.dialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toCamel(kind: OpeningKind): string {
  if (kind === 'sliding-door') return 'slidingDoor';
  if (kind === 'french-door') return 'frenchDoor';
  return kind;
}
