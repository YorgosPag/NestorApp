'use client';

/**
 * @fileoverview 🏆 **«ΔΗΜΟΣΙΕΥΣΗ ΚΑΤΟΨΗΣ»** — σε ποιο ακίνητο, με ή χωρίς επίπλωση, και **τι ακριβώς θα δει το κοινό**.
 * @related ADR-909 Α4 (υποχρεωτική προεπισκόπηση) · Α8 (η δημοσίευση είναι η δήλωση) · ../publish-model/PublishModelDialog
 * @module subapps/dxf-viewer/ui/components/publish-floorplan/PublishFloorplanDialog
 *
 * Ο διάλογος ρωτά **δύο** πράγματα *(ακίνητο · επίπλωση)* και δείχνει **ένα** *(την εικόνα)*. Ό,τι άλλο
 * χρειάζεται η δημοσίευση — επίπεδο, αρχείο σκηνής, έκδοση, ταυτότητα, διαβάθμιση — το ξέρει ή το γράφει ο
 * διακομιστής. Το κουμπί «Δημοσίευση» είναι σβηστό όσο δεν υπάρχει εικόνα να φανεί.
 *
 * ⚠️ **ADR-040**: μηδέν καμβάς στο DOM, μηδέν `useSyncExternalStore`. Η λήψη γίνεται σε **αποσπασμένο**
 * καμβά από τη μηχανή εκτύπωσης· ο ζωντανός καμβάς δεν ξανασχεδιάζεται.
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
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePropertiesByBuilding } from '@/components/properties/shared/usePropertiesByBuilding';
import { formatFileSize } from '@/utils/file-validation';
import { createModuleLogger } from '@/lib/telemetry';

import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';
import {
  publishFloorplanToProperty,
  type FloorplanPublishOutcome,
} from '../../../io/floorplan-publish/publish-floorplan-to-property';
import type { ExportDeps } from '../../../export/types';
import { Field, PropertyPicker } from '../publish-shared/publish-dialog-fields';
import { floorplanOutcomeMessageOf, type FloorplanOutcomeMessage } from './floorplan-publish-messages';
import { usePublishFloorplanPreview, type FloorplanPreview } from './usePublishFloorplanPreview';

const logger = createModuleLogger('DXF_PUBLISH_FLOORPLAN');

const FURNITURE_SWITCH_ID = 'publish-floorplan-furniture';

export interface PublishFloorplanDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** Το κτήριο του ενεργού επιπέδου — ορίζει **ποια** ακίνητα προσφέρονται. */
  readonly activeBuildingId: string | null;
  /** Συλλέγει τα ζωντανά υλικά τη **στιγμή** της λήψης (`useExportDeps`). */
  readonly collectDeps: () => ExportDeps;
}

export function PublishFloorplanDialog({
  open,
  onOpenChange,
  activeBuildingId,
  collectDeps,
}: PublishFloorplanDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { properties } = usePropertiesByBuilding(activeBuildingId, { enabled: open });
  const [propertyId, setPropertyId] = React.useState('');
  const [furniture, setFurniture] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<FloorplanPublishOutcome | null>(null);
  const preview = usePublishFloorplanPreview(collectDeps, furniture);

  const published = outcome !== null && outcome.ok;
  const prepared = preview.status === 'ready' ? preview.prepared : null;

  const handleSubmit = React.useCallback(async () => {
    if (prepared === null || propertyId === '') return;
    setBusy(true);
    setOutcome(null);
    try {
      const result = await publishFloorplanToProperty(propertyId, prepared);
      setOutcome(result);
      if (!result.ok) logger.warn('Floorplan publish refused', { refusal: result.refusal });
    } finally {
      setBusy(false);
    }
  }, [prepared, propertyId]);

  // 🔴 ADR-364 §10.2 — ο ανοιχτός διάλογος ΟΦΕΙΛΕΙ slot στον bus (ίδιο σκαλί με το «Δημοσίευση 3D»).
  useEscapeHandler({
    id: 'publish-floorplan/dialog',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => open,
    handle: () => { onOpenChange(false); return true; },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('publishFloorplan.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('publishFloorplan.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('publishFloorplan.property')}>
            <PropertyPicker properties={properties} value={propertyId} onChange={setPropertyId} />
          </Field>

          <fieldset className="flex flex-col gap-1.5 text-sm" disabled={busy || published}>
            <label htmlFor={FURNITURE_SWITCH_ID} className="flex items-center gap-2 font-medium">
              <Switch id={FURNITURE_SWITCH_ID} checked={furniture} onCheckedChange={setFurniture} />
              {t('publishFloorplan.furniture')}
            </label>
            <p className="text-xs text-muted-foreground">{t('publishFloorplan.furnitureHint')}</p>
          </fieldset>
        </section>

        <FloorplanPreviewFigure preview={preview} />

        {outcome !== null && <OutcomeMessage outcome={outcome} />}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t(published ? 'publishFloorplan.close' : 'publishFloorplan.cancel')}
          </Button>
          {!published && (
            <Button onClick={handleSubmit} disabled={busy || prepared === null || propertyId === ''}>
              {t(busy ? 'publishFloorplan.publishing' : 'publishFloorplan.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Η εικόνα που θα φύγει — ή ο λόγος που δεν υπάρχει.
 *
 * 🔑 `object-contain`: ο άνθρωπος βλέπει **ολόκληρο** το κάδρο, όχι κομμένο *(το λευκό είναι μέσα στα ίδια τα
 * bytes — καμία κλάση φόντου εδώ)*. Τα pixels και το μέγεθος γράφονται από κάτω — είναι τα ίδια που θα
 * ελέγξει η πόρτα πάνω στα bytes.
 */
function FloorplanPreviewFigure({ preview }: { readonly preview: FloorplanPreview }): React.JSX.Element {
  const { t, currentLanguage } = useTranslation('dxf-viewer-shell');

  if (preview.status === 'preparing') {
    return <p role="status" className="text-sm text-muted-foreground">{t('publishFloorplan.preparing')}</p>;
  }
  if (preview.status === 'refused') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t(`publishFloorplan.refusals.${preview.refusal}`)}
      </p>
    );
  }

  const { recipe, blob, unruledTypes } = preview.prepared;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-muted-foreground">{t('publishFloorplan.preview')}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element -- object URL των bytes που θα σταλούν, όχι στατικό asset */}
      <img
        src={preview.url}
        alt={t('publishFloorplan.previewAlt')}
        className="max-h-[50vh] w-full rounded-md border object-contain"
      />
      <p className="text-xs text-muted-foreground">
        {t('publishFloorplan.previewMeta', {
          width: recipe.widthPx,
          height: recipe.heightPx,
          size: formatFileSize(blob.size, currentLanguage),
        })}
      </p>
      {unruledTypes.length > 0 && (
        <p role="alert" className="text-xs text-destructive">
          {t('publishFloorplan.unruled', { types: unruledTypes.join(', ') })}
        </p>
      )}
    </figure>
  );
}

/** Η έκβαση με λόγια: άρνηση με το όνομά της, ή τι έγινε **πράγματι** στην αγγελία. */
function OutcomeMessage({ outcome }: { readonly outcome: FloorplanPublishOutcome }): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');

  if (!outcome.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t(`publishFloorplan.refusals.${outcome.refusal}`)}
      </p>
    );
  }

  const message = floorplanOutcomeMessageOf(outcome.declared, outcome.listing);
  return (
    <p role="status" className={OUTCOME_TONE[message]}>
      {t(`publishFloorplan.outcomes.${message}`)}
    </p>
  );
}

/**
 * Ο τόνος ακολουθεί το **τι βλέπει το κοινό**: δημοσιεύτηκε · αποθηκεύτηκε αλλά η αγγελία είναι κλειστή
 * *(ουδέτερο — τίποτα δεν πήγε στραβά)* · αποθηκεύτηκε και **δεν** φαίνεται ενώ θα έπρεπε *(προσοχή)*.
 */
const OUTCOME_TONE: Readonly<Record<FloorplanOutcomeMessage, string>> = {
  published: 'text-sm font-medium',
  'uploaded-not-listed': 'text-sm text-muted-foreground',
  'declared-full': 'text-sm text-destructive',
  'declared-failed': 'text-sm text-destructive',
  'listing-failed': 'text-sm text-destructive',
};
