'use client';

/**
 * @fileoverview 🏆 **ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΤΟΥ ΕΡΓΟΛΑΒΟΥ** — «σε ποιο ακίνητο, τι δείχνει, ποιος υπογράφει».
 * @related ADR-845 §7.5 (Φ4.2β/Βήμα Γ) · ADR-841 §7 Α2.7 (κηδεμονία = ανθρώπινη πράξη)
 * @module subapps/dxf-viewer/ui/components/publish-model/PublishModelDialog
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΡΩΤΑΕΙ «ΣΕ ΠΟΙΟ ΑΚΙΝΗΤΟ;» ΚΑΙ ΔΕΝ ΤΟ ΜΑΝΤΕΥΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο θεατής ξέρει **κτήριο**, όχι ακίνητο. Ένα μοντέλο **κτηρίου** αυτόματα σε **κάθε**
 * διαμέρισμα θα έκανε το *«< 5 MB ανά ακίνητο»* → *«5 MB × N»*, και θα ήταν απόφαση
 * **κηδεμονίας που κανένας άνθρωπος δεν πήρε**. Το γραμμένο ιδίωμα του έργου είναι **Α2.7
 * opt-in**: *«η κηδεμονία είναι ανθρώπινη πράξη»* — μία ρητή πράξη ανά ακίνητο, με το κόστος
 * **ορατό** αντί για σιωπηλό.
 *
 * ⚠️ **ADR-040**: μηδέν καμβάς, μηδέν `useSyncExternalStore`. Η μόνη ροή Firestore
 * *(`usePropertiesByBuilding`)* είναι σπάνια μεταβαλλόμενη λίστα και ζει **όσο ο διάλογος**.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePropertiesByBuilding } from '@/components/properties/shared/usePropertiesByBuilding';
import { MODEL_STATE_MARKS } from '@/lib/listings/listing-model-declaration';
import type { Property } from '@/types/property';
import { createModuleLogger } from '@/lib/telemetry';

import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';
import {
  publishModelToProperty,
  type ModelPublishOutcome,
  type ModelPublishScope,
} from '../../../io/model-publish/publish-model-to-property';
import type { ExportDeps } from '../../../export/types';
import { usePublishModelState } from './usePublishModelState';

const logger = createModuleLogger('DXF_PUBLISH_MODEL');

/**
 * ⛔ **Χωρίς `all-zip`** — δες {@link ModelPublishScope}: η αγγελία δέχεται **ένα** μοντέλο, και
 * μια σιωπηλή επιλογή «του πρώτου ορόφου» θα ήταν απόφαση που κανείς δεν πήρε.
 */
const SCOPE_OPTIONS: readonly ModelPublishScope[] = ['active', 'all-single'];

export interface PublishModelDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** Το κτήριο του ενεργού επιπέδου — ορίζει **ποια** ακίνητα προσφέρονται. */
  readonly activeBuildingId: string | null;
  /** Συλλέγει τα ζωντανά υλικά τη **στιγμή** της υποβολής (`useExportDeps`). */
  readonly collectDeps: () => ExportDeps;
}

export function PublishModelDialog({
  open,
  onOpenChange,
  activeBuildingId,
  collectDeps,
}: PublishModelDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const form = usePublishModelState();
  const { properties } = usePropertiesByBuilding(activeBuildingId, { enabled: open });
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<ModelPublishOutcome | null>(null);

  const handleSubmit = React.useCallback(async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await publishModelToProperty(form.buildRequest(), collectDeps());
      setOutcome(result);
      if (result.ok) onOpenChange(false);
      else logger.warn('Model publish refused', { refusal: result.refusal, detail: result.detail });
    } finally {
      setBusy(false);
    }
  }, [form, collectDeps, onOpenChange]);

  // 🔴 ADR-364 §10.2 — ο ανοιχτός διάλογος ΟΦΕΙΛΕΙ slot στον bus, αλλιώς το `Escape` το
  //    καταναλώνει το Radix **μετά** τον bus και ο καμβάς από κάτω αποεπιλέγεται σιωπηλά.
  //    Ίδιο σκαλί με τον διάλογο εξαγωγής (hard-modal), και **ένας** δρόμος κλεισίματος.
  useEscapeHandler({
    id: 'publish-model/dialog',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => open,
    handle: () => { onOpenChange(false); return true; },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('publishModel.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('publishModel.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('publishModel.property')}>
            <PropertyPicker
              properties={properties}
              value={form.propertyId}
              onChange={form.setPropertyId}
            />
          </Field>

          <Field label={t('publishModel.scope')}>
            <Select value={form.scope} onValueChange={(v) => form.setScope(v as ModelPublishScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`publishModel.scopes.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('publishModel.state')}>
            <Select value={form.state} onValueChange={(v) => form.setState(v as typeof form.state)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODEL_STATE_MARKS.map((mark) => (
                  <SelectItem key={mark} value={mark}>{t(`publishModel.states.${mark}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('publishModel.studiedAt')}>
            <Input
              type="date"
              value={form.studiedAt}
              onChange={(e) => form.setStudiedAt(e.target.value)}
            />
          </Field>

          <Field label={t('publishModel.signatoryName')}>
            <Input value={form.name} onChange={(e) => form.setName(e.target.value)} />
          </Field>

          <Field label={t('publishModel.signatoryDiscipline')}>
            <Input value={form.discipline} onChange={(e) => form.setDiscipline(e.target.value)} />
          </Field>
        </section>

        {/* 🔑 Η **επιστημική θέση** της υπογραφής λέγεται στην οθόνη, όχι μόνο στον κώδικα:
            μια **δηλωμένη** υπογραφή δεν επιτρέπεται να **μοιάζει** επαληθευμένη (Α9). */}
        <p className="text-xs text-muted-foreground">{t('publishModel.signatoryHint')}</p>

        {outcome !== null && !outcome.ok && (
          <p role="alert" className="text-sm text-destructive">
            {t(`publishModel.refusals.${outcome.refusal}`)}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('publishModel.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !form.complete}>
            {busy ? t('publishModel.publishing') : t('publishModel.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ο επιλογέας ακινήτου.
 *
 * ⛔ **ΚΑΝΕΝΑ `<SelectItem value="">`** *(CHECK 3.48)*: το Radix **δεσμεύει** το κενό string και
 * ένα τέτοιο στοιχείο ρίχνει **ολόκληρη** την επιφάνεια σε χρόνο εκτέλεσης. Το «τίποτα
 * επιλεγμένο» το λέει το `placeholder`, και το «τίποτα διαθέσιμο» ένα **μη επιλέξιμο** μήνυμα.
 */
function PropertyPicker({ properties, value, onChange }: {
  readonly properties: readonly Property[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <Select value={value === '' ? undefined : value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={t('publishModel.propertyPlaceholder')} /></SelectTrigger>
      <SelectContent>
        {properties.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t('publishModel.noProperties')}</p>
        ) : (
          properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>{propertyLabel(property)}</SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

/** «A-101 — Διαμέρισμα 2ου» ή σκέτο το όνομα: ο κωδικός είναι **προαιρετικός** στον τύπο. */
function propertyLabel(property: Property): string {
  return property.code ? `${property.code} — ${property.name}` : property.name;
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
