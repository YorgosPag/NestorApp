'use client';

/**
 * ADR-643 Φ3 + Φ4 — visual swatch grid για την επιλογή υλικού εικόνας (μοντέλο
 * Revit/ArchiCAD/Figma material browser). Ζωγραφίζεται bespoke από τον
 * `HatchPropertiesTab` όταν fillType='image', πάνω από τα πεδία διάστασης/γωνίας.
 *
 * SSoT (μηδέν νέο asset): οι builtin μικρογραφίες = οι ΙΔΙΕΣ CC0 `albedo.jpg` του
 * ADR-413 μέσω `useMaterialThumbnailUrl(slug)`. **Φ4:** το «Ανέβασμα φωτο» + το grid
 * με τα user uploads (δικά μου) περνούν από τον `useHatchImageUploads` (reuse του
 * `useMaterialLibrary` + thin upload service — μία shared material library, 2D+3D).
 * Read/write assetId μέσω του ΙΔΙΟΥ `useRibbonHatchBridge` (dumb component: value +
 * onSelect props) → ribbon/panel/draft ποτέ δεν αποκλίνουν.
 *
 * Προσβασιμότητα: `aria-pressed` ανά υλικό + `aria-label` (ΟΧΙ native `title=` — CHECK 3.23).
 *
 * @see ./hooks/useHatchImageUploads.ts — user uploads + upload() (Φ4)
 * @see ../../bim/materials/material-thumbnail-resolver.ts — thumbnail store (slug → albedo URL)
 * @see ../../data/material-image-catalog.ts — starter library (Φ2)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §7, §8 Φ3/Φ4
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  listMaterialImages,
  materialImageLabelKey,
  type MaterialImageDef,
} from '../../data/material-image-catalog';
import { useMaterialThumbnailUrl } from '../../bim/materials/material-thumbnail-resolver';
import { useHatchImageUploads, type HatchImageUploadEntry } from './hooks/useHatchImageUploads';

export interface MaterialImagePickerProps {
  /** Τρέχον asset id (από το bridge) — καθορίζει το επιλεγμένο swatch. */
  readonly selectedAssetId: string;
  /** Επιλογή υλικού → γράφει το assetId μέσω του bridge. */
  readonly onSelect: (assetId: string) => void;
  /** Project scope για τα user uploads (Φ4). */
  readonly projectId?: string;
}

/** Presentational swatch button (κοινό markup builtin + upload — μηδέν clone). */
function SwatchButton({
  url,
  label,
  selected,
  onSelect,
}: {
  readonly url: string | null;
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): React.ReactElement {
  const ring = selected
    ? 'border-primary ring-2 ring-primary'
    : 'border-border hover:border-primary/50';
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
      className={`flex w-full flex-col items-center gap-1 rounded-md border p-1 text-[10px] transition ${ring}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" aria-hidden="true" loading="lazy" className="h-10 w-full rounded-sm object-cover" />
      ) : (
        <span aria-hidden="true" className="h-10 w-full rounded-sm bg-muted" />
      )}
      <span className="w-full truncate text-center text-muted-foreground">{label}</span>
    </button>
  );
}

/**
 * User-upload swatch — the shared `SwatchButton` + a hover/focus «κάδος» affordance
 * (μόνο για δικά μου uploads, όχι builtin· Revit/ArchiCAD material-browser idiom).
 * Το delete button είναι sibling του swatch (χωριστό <button>) → το κλικ του δεν
 * ενεργοποιεί το onSelect. `aria-label` (CHECK 3.23, ΟΧΙ native `title=`).
 */
function UploadSwatch({
  entry,
  selected,
  onSelect,
  onRequestDelete,
  deleteLabel,
}: {
  readonly entry: HatchImageUploadEntry;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onRequestDelete: () => void;
  readonly deleteLabel: string;
}): React.ReactElement {
  return (
    <div className="group relative">
      <SwatchButton url={entry.url} label={entry.label} selected={selected} onSelect={onSelect} />
      <button
        type="button"
        aria-label={deleteLabel}
        onClick={onRequestDelete}
        className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5 text-muted-foreground opacity-0 transition hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 aria-hidden="true" className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Builtin swatch — resolves the shared ADR-413 albedo thumbnail by slug. */
function BuiltinSwatch({
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
  return (
    <SwatchButton
      url={url}
      label={t(materialImageLabelKey(def))}
      selected={selected}
      onSelect={() => onSelect(def.id)}
    />
  );
}

/** «Ανέβασμα φωτο» control + inline uploading/error state (Φ4). */
function UploadControl({
  uploading,
  errorKey,
  onFile,
}: {
  readonly uploading: boolean;
  readonly errorKey: string | null;
  readonly onFile: (file: File) => void;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = ''; // allow re-selecting the same file
  };
  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={handleChange}
        />
        {uploading ? t('hatchImageFill.upload.uploading') : t('hatchImageFill.upload.button')}
      </label>
      {errorKey && (
        <p role="alert" className="text-[10px] text-destructive">
          {t(`hatchImageFill.upload.errors.${errorKey}`)}
        </p>
      )}
    </div>
  );
}

export function MaterialImagePicker({
  selectedAssetId,
  onSelect,
  projectId,
}: MaterialImagePickerProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { uploads, upload, uploading, remove, removingId, errorKey } = useHatchImageUploads(projectId);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  const handleUpload = (file: File): void => {
    void upload(file).then((assetId) => {
      if (assetId) onSelect(assetId);
    });
  };

  const pendingDelete = uploads.find((u) => u.assetId === pendingDeleteId) ?? null;

  const handleConfirmDelete = async (): Promise<void> => {
    if (!pendingDeleteId) return;
    await remove(pendingDeleteId); // errorKey ('deleteFailed') surfaces below on failure
    setPendingDeleteId(null); // close either way — the live snapshot drops the swatch on success
  };

  return (
    <section aria-label={t('hatchImageFill.pickerTitle')} className="flex flex-col gap-2 px-1">
      <h4 className="text-xs font-medium text-foreground">{t('hatchImageFill.pickerTitle')}</h4>
      <ul className="grid grid-cols-4 gap-1">
        {listMaterialImages().map((def) => (
          <li key={def.id}>
            <BuiltinSwatch def={def} selected={def.id === selectedAssetId} onSelect={onSelect} />
          </li>
        ))}
      </ul>

      {uploads.length > 0 && (
        <>
          <h5 className="text-[11px] font-medium text-muted-foreground">
            {t('hatchImageFill.upload.uploadsTitle')}
          </h5>
          <ul className="grid grid-cols-4 gap-1">
            {uploads.map((u) => (
              <li key={u.assetId}>
                <UploadSwatch
                  entry={u}
                  selected={u.assetId === selectedAssetId}
                  onSelect={() => onSelect(u.assetId)}
                  onRequestDelete={() => setPendingDeleteId(u.assetId)}
                  deleteLabel={t('hatchImageFill.upload.delete')}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <UploadControl uploading={uploading} errorKey={errorKey} onFile={handleUpload} />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDeleteId(null);
        }}
        title={t('hatchImageFill.upload.deleteTitle')}
        description={
          // `overflow-wrap:anywhere` shrinks the min-content of a long material name
          // (uploads keyed by hash → 80-char names) so the AlertDialog's CSS `grid`
          // does NOT blow out past `max-w-md` (which pushes the footer buttons off-frame).
          <span className="[overflow-wrap:anywhere]">
            {t('hatchImageFill.upload.deleteDescription', { name: pendingDelete?.label ?? '' })}
          </span>
        }
        confirmText={t('hatchImageFill.upload.deleteConfirm')}
        variant="destructive"
        loading={removingId !== null}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
}
