'use client';

/**
 * ImportUnitScaleControl — ADR-683 §units: η **ρητή** επιλογή μονάδας ενός εισαγόμενου `.glb`/`.gltf`.
 *
 * **Γιατί ρητή και όχι auto-detect:** το glTF ορίζει μέτρα (Khronos)· ένα αρχείο σε ίντσες/χιλιοστά είναι
 * «λάθος» και μόνο ο χρήστης ξέρει τι εξήγαγε ο συνεργάτης του. Οι μεγάλοι το λύνουν ίδια — Revit «Import
 * Units», SketchUp mm/cm/in/ft/m dropdown, C4D scale multiplier — **ποτέ** silent bbox rescale (§units).
 *
 * Καθαρά controlled/presentational: κρατά μηδέν state· ο dialog κατέχει την επιλογή, ώστε η ίδια τιμή να
 * τροφοδοτεί **και** τη live λίστα διαστάσεων **και** την τελική εισαγωγή (μία πηγή αλήθειας στο UI).
 *
 * @see ../../../io/mesh3d-roundtrip/import-unit-scale — το SSoT των μονάδων/factor
 * @see ./ImportedMeshImportDialog — ο κάτοχος του state
 */

import { useTranslation } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SceneUnits } from '../../../utils/scene-units';
import {
  IMPORT_UNIT_OPTIONS,
  type ImportUnitSelection,
} from '../../../io/mesh3d-roundtrip/import-unit-scale';

/** SceneUnits → κλειδί ονόματος στο κοινό `common:units.*` (SSoT ονομάτων — όχι διπλότυπα εδώ). */
const UNIT_LABEL_KEY: Record<SceneUnits, string> = {
  m: 'units.meters',
  cm: 'units.centimeters',
  mm: 'units.millimeters',
  in: 'units.inches',
  ft: 'units.feet',
};

/** Η ειδική τιμή του dropdown για «προσαρμοσμένος συντελεστής» (το Radix απαγορεύει κενή τιμή). */
const CUSTOM_VALUE = 'custom';

export interface ImportUnitScaleControlProps {
  readonly selection: ImportUnitSelection;
  readonly customFactor: number;
  readonly onSelectionChange: (selection: ImportUnitSelection) => void;
  readonly onCustomFactorChange: (factor: number) => void;
  readonly disabled?: boolean;
}

export function ImportUnitScaleControl({
  selection,
  customFactor,
  onSelectionChange,
  onCustomFactorChange,
  disabled,
}: ImportUnitScaleControlProps) {
  const { t } = useTranslation(['dxf-viewer-shell', 'common']);

  return (
    <section className="flex flex-col gap-1.5 px-2 py-1">
      <label className="text-xs font-medium text-foreground">
        {t('c4dMaterialImport.importMeshes.unitSectionLabel')}
      </label>

      <div className="flex items-center gap-2">
        <Select
          value={selection}
          onValueChange={(v) => onSelectionChange(v as ImportUnitSelection)}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMPORT_UNIT_OPTIONS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {t(`common:${UNIT_LABEL_KEY[unit]}`)}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_VALUE}>
              {t('c4dMaterialImport.importMeshes.unitCustom')}
            </SelectItem>
          </SelectContent>
        </Select>

        {selection === CUSTOM_VALUE && (
          <input
            type="number"
            min={0}
            step="any"
            value={Number.isFinite(customFactor) ? customFactor : ''}
            onChange={(e) => onCustomFactorChange(Number.parseFloat(e.target.value))}
            disabled={disabled}
            aria-label={t('c4dMaterialImport.importMeshes.customFactorLabel')}
            className="w-24 rounded-md border border-input bg-background px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('c4dMaterialImport.importMeshes.unitHint')}
      </p>
    </section>
  );
}
