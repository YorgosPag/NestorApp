'use client';

/**
 * ADR-396 Phase P6 — Thermal Envelope (ETICS) authoring dialog.
 *
 * Pure UI — controlled by the surrounding `ThermalEnvelopeHost` (owns the draft
 * `ThermalEnvelopeSpec` + apply orchestration). Ο χρήστης ορίζει ΜΙΑ φορά ανά
 * όροφο: υλικό (Neopor / XPS), πάχος όψης + περβαζιών, ενεργές ζώνες Z1-Z4.
 * «Εφαρμογή» γράφει το spec στον τρέχοντα όροφο· «σε όλους» σε όλους (D1/D3).
 *
 * ΚΕΝΑΚ = soft warning μόνο (`isBelowKenakAdvisory`) — ΔΕΝ μπλοκάρει (D6).
 * UI πάχη σε mm· το spec κρατά ΜΕΤΡΑ (SSoT) → conversion στα handlers.
 *
 * Mirror του `OpeningTagStyleDialog` (ADR-376 C.2): Radix Dialog + Select
 * (ADR-001) + Switch. Accessibility: κάθε control με `<Label htmlFor>`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P6)
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ENVELOPE_FUNCTION_OPTIONS,
  ENVELOPE_MATERIAL_OPTIONS,
  MIN_ENVELOPE_THICKNESS_M,
  isBelowKenakAdvisory,
  mmToClampedMeters,
  metersToMm,
  readEnvelopeFunctionValue,
  type EnvelopeZoneId,
  type ThermalEnvelopeSpec,
} from '../../../bim/types/thermal-envelope-types';
import type {
  RegionEnvelopeRole,
} from '../../../bim/geometry/footprint-region-classifier';
import type {
  RegionOverrideTarget,
} from '../../../bim/services/envelope-region-override.service';
import {
  CLIMATE_ZONE_OPTIONS,
  REFERENCE_BARE_WALL_LAYERS,
  getKenakMaxUWall,
  isAboveKenakUMax,
  type ClimateZone,
} from '../../../bim/thermal/kenak-thermal-config';
import { computeAssemblyUValue } from '../../../bim/thermal/assembly-u-value';
import { getThermalConductivityLambda } from '../../../bim/walls/wall-material-catalog';

export interface ThermalEnvelopeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly value: ThermalEnvelopeSpec;
  readonly onChange: (next: ThermalEnvelopeSpec) => void;
  readonly onApply: () => void;
  readonly onApplyAll: () => void;
  /** Κλιματική ζώνη κτιρίου (ρύθμιση κτιρίου, ADR-396 P8 OQ-7a) — null αν αόριστη. */
  readonly climateZone: ClimateZone | null;
  readonly onClimateZoneChange: (zone: ClimateZone) => void;
  /**
   * ADR-396 v2 Φ6b — ανιχνευμένα όρια ορόφου (εξωτερικό/αίθριο/δωμάτιο) για
   * per-region override του `envelopeFunction`. Υπολογίζεται από τον host.
   */
  readonly regions: readonly RegionOverrideTarget[];
  /** Αλλαγή override ενός ορίου → γράφεται σε ΟΛΑ τα στοιχεία του (last write wins). */
  readonly onRegionFunctionChange: (region: RegionOverrideTarget, value: string) => void;
}

const ZONES: ReadonlyArray<EnvelopeZoneId> = ['Z1', 'Z2', 'Z3', 'Z4'];

/** i18n key ανά ρόλο ορίου (region panel Φ6b). */
const REGION_ROLE_LABEL_KEYS: Readonly<Record<RegionEnvelopeRole, string>> = {
  exterior: 'ribbon.commands.thermalEnvelope.regions.roles.exterior',
  atrium: 'ribbon.commands.thermalEnvelope.regions.roles.atrium',
  'interior-room': 'ribbon.commands.thermalEnvelope.regions.roles.interiorRoom',
  'open-structure': 'ribbon.commands.thermalEnvelope.regions.roles.openStructure',
};

/** Format U-value για εμφάνιση (2 δεκαδικά, em-dash αν μη υπολογίσιμο). */
function formatUValue(u: number): string {
  return Number.isFinite(u) ? u.toFixed(2) : '—';
}

export function ThermalEnvelopeDialog(props: ThermalEnvelopeDialogProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { value, onChange, climateZone, onClimateZoneChange, regions, onRegionFunctionChange } = props;

  // Πλήθος ορίων ανά ρόλο — ώστε να μπει αύξων αριθμός μόνο όταν υπάρχουν πολλά
  // του ίδιου τύπου (π.χ. «Αίθριο 1 / 2», αλλά σκέτο «Εξωτερικό περίγραμμα»).
  const roleCounts = React.useMemo(() => {
    const counts = new Map<RegionEnvelopeRole, number>();
    for (const region of regions) counts.set(region.role, (counts.get(region.role) ?? 0) + 1);
    return counts;
  }, [regions]);

  const regionLabel = (region: RegionOverrideTarget): string => {
    const base = t(REGION_ROLE_LABEL_KEYS[region.role]);
    return (roleCounts.get(region.role) ?? 0) > 1 ? `${base} ${region.ordinal}` : base;
  };

  // ADR-396 P8 — assembly U-value: τυπικός τοίχος (config) + ETICS μόνωση.
  const uValue = React.useMemo(() => {
    const lambda = getThermalConductivityLambda(value.materialId);
    const layers =
      lambda !== undefined
        ? [...REFERENCE_BARE_WALL_LAYERS, { thickness_m: value.thickness_m, lambda }]
        : [...REFERENCE_BARE_WALL_LAYERS];
    return computeAssemblyUValue(layers);
  }, [value.materialId, value.thickness_m]);

  const uAboveKenak = climateZone !== null && isAboveKenakUMax(uValue, climateZone);

  const setMaterial = (id: string) => onChange({ ...value, materialId: id });
  const setThickness = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, thickness_m: mmToClampedMeters(e.target.value, value.thickness_m) });
  const setReveal = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, revealThickness_m: mmToClampedMeters(e.target.value, value.revealThickness_m) });
  const toggleZone = (zone: EnvelopeZoneId, next: boolean) =>
    onChange({ ...value, zones: { ...value.zones, [zone]: next } });

  const facadeBelowKenak = isBelowKenakAdvisory(value.thickness_m, 'Z1');
  const revealBelowKenak = isBelowKenakAdvisory(value.revealThickness_m, 'Z4');

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ribbon.commands.thermalEnvelope.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('ribbon.commands.thermalEnvelope.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="envelope-material">
              {t('ribbon.commands.thermalEnvelope.fields.material')}
            </Label>
            <Select value={value.materialId} onValueChange={setMaterial}>
              <SelectTrigger id="envelope-material">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENVELOPE_MATERIAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="envelope-thickness">
                {t('ribbon.commands.thermalEnvelope.fields.thickness')}
              </Label>
              <Input
                id="envelope-thickness"
                type="number"
                inputMode="numeric"
                min={metersToMm(MIN_ENVELOPE_THICKNESS_M)}
                step={5}
                value={metersToMm(value.thickness_m)}
                onChange={setThickness}
              />
              {facadeBelowKenak && (
                <p className="text-xs text-[hsl(var(--text-warning))]" role="alert">
                  {t('ribbon.commands.thermalEnvelope.kenakWarning')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="envelope-reveal">
                {t('ribbon.commands.thermalEnvelope.fields.revealThickness')}
              </Label>
              <Input
                id="envelope-reveal"
                type="number"
                inputMode="numeric"
                min={metersToMm(MIN_ENVELOPE_THICKNESS_M)}
                step={5}
                value={metersToMm(value.revealThickness_m)}
                onChange={setReveal}
              />
              {revealBelowKenak && (
                <p className="text-xs text-[hsl(var(--text-warning))]" role="alert">
                  {t('ribbon.commands.thermalEnvelope.kenakWarning')}
                </p>
              )}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              {t('ribbon.commands.thermalEnvelope.fields.zones')}
            </legend>
            {ZONES.map((zone) => (
              <div key={zone} className="flex items-center justify-between">
                <Label htmlFor={`envelope-zone-${zone}`}>
                  {t(`ribbon.commands.thermalEnvelope.zones.${zone}`)}
                </Label>
                <Switch
                  id={`envelope-zone-${zone}`}
                  checked={value.zones[zone]}
                  onCheckedChange={(next) => toggleZone(zone, next)}
                />
              </div>
            ))}
          </fieldset>
        </section>

        <section className="space-y-3 border-t border-[hsl(var(--border))] py-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">
              {t('ribbon.commands.thermalEnvelope.regions.title')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('ribbon.commands.thermalEnvelope.regions.description')}
            </p>
          </div>
          {regions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('ribbon.commands.thermalEnvelope.regions.empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {regions.map((region) => (
                <li
                  key={region.regionId}
                  className="flex items-center justify-between gap-3"
                >
                  <Label htmlFor={`envelope-region-${region.regionId}`} className="text-sm">
                    {regionLabel(region)}
                  </Label>
                  <Select
                    value={
                      region.currentFn === 'mixed'
                        ? undefined
                        : readEnvelopeFunctionValue(region.currentFn)
                    }
                    onValueChange={(next) => onRegionFunctionChange(region, next)}
                  >
                    <SelectTrigger id={`envelope-region-${region.regionId}`} className="w-44">
                      <SelectValue
                        placeholder={t('ribbon.commands.thermalEnvelope.regions.mixed')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {ENVELOPE_FUNCTION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t border-[hsl(var(--border))] py-3">
          <div className="space-y-2">
            <Label htmlFor="envelope-climate-zone">
              {t('ribbon.commands.thermalEnvelope.climateZone.label')}
            </Label>
            <Select
              value={climateZone ?? undefined}
              onValueChange={(v) => onClimateZoneChange(v as ClimateZone)}
            >
              <SelectTrigger id="envelope-climate-zone">
                <SelectValue
                  placeholder={t('ribbon.commands.thermalEnvelope.climateZone.placeholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {CLIMATE_ZONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t('ribbon.commands.thermalEnvelope.performance.uValue', {
                value: formatUValue(uValue),
              })}
            </p>
            {climateZone === null ? (
              <p className="text-xs text-muted-foreground">
                {t('ribbon.commands.thermalEnvelope.performance.noZone')}
              </p>
            ) : (
              <p
                className={
                  uAboveKenak
                    ? 'text-xs text-[hsl(var(--text-warning))]'
                    : 'text-xs text-[hsl(var(--text-success))]'
                }
                role={uAboveKenak ? 'alert' : undefined}
              >
                {t('ribbon.commands.thermalEnvelope.performance.kenakLimit', {
                  value: getKenakMaxUWall(climateZone).toFixed(2),
                })}
                {' — '}
                {uAboveKenak
                  ? t('ribbon.commands.thermalEnvelope.performance.warn')
                  : t('ribbon.commands.thermalEnvelope.performance.pass')}
              </p>
            )}
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            {t('ribbon.commands.thermalEnvelope.actions.close')}
          </Button>
          <Button variant="secondary" onClick={props.onApplyAll}>
            {t('ribbon.commands.thermalEnvelope.actions.applyAllFloors')}
          </Button>
          <Button onClick={props.onApply}>
            {t('ribbon.commands.thermalEnvelope.actions.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
