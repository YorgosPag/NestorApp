'use client';

/**
 * ADR-643 Φ3 — visual swatch grid για την επιλογή υλικού εικόνας (μοντέλο
 * Revit/ArchiCAD/Figma material browser). Ζωγραφίζεται bespoke από τον
 * `HatchPropertiesTab` όταν fillType='image', πάνω από τα πεδία διάστασης/γωνίας.
 *
 * SSoT (μηδέν νέο asset): οι μικρογραφίες = οι ΙΔΙΕΣ CC0 `albedo.jpg` του ADR-413,
 * μέσω του υπάρχοντος `useMaterialThumbnailUrl(slug)` thumbnail store (ίδιο που
 * τροφοδοτεί τα 3D material swatches). Κατάλογος = `material-image-catalog` (Φ2).
 * Read/write assetId μέσω του ΙΔΙΟΥ `useRibbonHatchBridge` (dumb component: value +
 * onSelect props) → ribbon/panel/draft ποτέ δεν αποκλίνουν.
 *
 * Προσβασιμότητα: `aria-pressed` ανά υλικό + `aria-label` (ΟΧΙ native `title=` — CHECK 3.23).
 *
 * @see ../../bim/materials/material-thumbnail-resolver.ts — thumbnail store (slug → albedo URL)
 * @see ../../data/material-image-catalog.ts — starter library (Φ2)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §7, §8 Φ3
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  listMaterialImages,
  materialImageLabelKey,
  type MaterialImageDef,
} from '../../data/material-image-catalog';
import { useMaterialThumbnailUrl } from '../../bim/materials/material-thumbnail-resolver';

export interface MaterialImagePickerProps {
  /** Τρέχον asset id (από το bridge) — καθορίζει το επιλεγμένο swatch. */
  readonly selectedAssetId: string;
  /** Επιλογή υλικού → γράφει το assetId μέσω του bridge. */
  readonly onSelect: (assetId: string) => void;
}

/** Ένα swatch (μικρογραφία albedo + όνομα) — δικό του hook ανά υλικό. */
function MaterialImageSwatch({
  def,
  selected,
  onSelect,
}: {
  readonly def: MaterialImageDef;
  readonly selected: boolean;
  readonly onSelect: (assetId: string) => void;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const url = useMaterialThumbnailUrl(def.textureSlug);
  const label = t(materialImageLabelKey(def));
  const ring = selected
    ? 'border-primary ring-2 ring-primary'
    : 'border-border hover:border-primary/50';
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={() => onSelect(def.id)}
      className={`flex w-full flex-col items-center gap-1 rounded-md border p-1 text-[10px] transition ${ring}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-10 w-full rounded-sm object-cover"
        />
      ) : (
        <span aria-hidden="true" className="h-10 w-full rounded-sm bg-muted" />
      )}
      <span className="w-full truncate text-center text-muted-foreground">{label}</span>
    </button>
  );
}

export function MaterialImagePicker({
  selectedAssetId,
  onSelect,
}: MaterialImagePickerProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <section aria-label={t('hatchImageFill.pickerTitle')} className="flex flex-col gap-1 px-1">
      <h4 className="text-xs font-medium text-foreground">{t('hatchImageFill.pickerTitle')}</h4>
      <ul className="grid grid-cols-4 gap-1">
        {listMaterialImages().map((def) => (
          <li key={def.id}>
            <MaterialImageSwatch
              def={def}
              selected={def.id === selectedAssetId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
