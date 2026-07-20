'use client';

/**
 * ImportedMeshBoqDialog — ADR-683 **Φ3.1β** (§10.2): ο χρήστης δηλώνει **πώς κοστολογείται** ένα
 * εισαγόμενο πλέγμα.
 *
 * **Η μία χειροκίνητη πληροφορία ολόκληρης της φάσης.** Το ίδιο κάγκελο κοστίζει 288 € ως αλουμίνιο
 * και 832 € ως inox, και η μονάδα είναι σημασιολογική (κάγκελο σε τρέχοντα μέτρα, τζάμι σε
 * τετραγωνικά). Καμία από τις δύο πληροφορίες δεν υπάρχει στα ψημένα τρίγωνα — γι' αυτό ρωτιέται.
 * Ό,τι ακολουθεί (ποσότητα, σύνολο, γραμμή προμέτρησης) βγαίνει αυτόματα.
 *
 * ## Τι κάνει αυτό το dialog διαφορετικό από έναν απλό editor
 *
 * **Δεν προσφέρει επιλογές που δεν μπορεί να τιμήσει.** Οι μονάδες βγαίνουν από το
 * `assignableBoqUnits` — τομή του τι μετρά η γεωμετρία (m³ μόνο σε κλειστό κέλυφος) με το τι
 * επιτρέπει το άρθρο ΑΤΟΕ. Ανοιχτό πλέγμα δεν βλέπει καν m³, με εξήγηση μιας γραμμής, ακριβώς όπως
 * το Revit αφήνει κενή την παράμετρο Volume σε εισαγόμενο DirectShape που δεν είναι έγκυρο στερεό.
 * Κενή τομή → το dialog το λέει και δεν αφήνει αποθήκευση, αντί να γράψει νούμερο σε λάθος διάσταση.
 *
 * **Η προεπιλογή είναι πρόταση, όχι απόφαση**: `suggestImportedMeshIdentity` προσυμπληρώνει από το
 * όνομα κόμβου (τι είναι) + το όνομα υλικού (από τι είναι, άρα και τιμή), και το λέει ρητά ώστε ο
 * χρήστης να ξέρει τι κοιτά. Ό,τι δεν αναγνωρίζεται μένει κενό — ποτέ αυθαίρετη προεπιλογή.
 *
 * @see ../../../bim/entities/imported-mesh/imported-mesh-boq — `assignableBoqUnits` (το gating)
 * @see ../../../bim/entities/imported-mesh/imported-mesh-identity-suggest — η πρόταση
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { subCategoriesFor } from '@/config/boq-subcategories';
import type { BimMaterial } from '../../../bim/types/bim-material-types';
import { assignableBoqUnits } from '../../../bim/entities/imported-mesh/imported-mesh-boq';
import type {
  ImportedMeshBoqIdentity,
  ImportedMeshBoqUnit,
  ImportedMeshParams,
} from '../../../bim/entities/imported-mesh/imported-mesh-types';
import type { IdentitySuggestionSource } from '../../../bim/entities/imported-mesh/imported-mesh-identity-suggest';
import { ImportedMeshMeasuredSummary } from './ImportedMeshMeasuredSummary';

const K = 'importedMeshBoq';

export interface ImportedMeshBoqDialogProps {
  readonly open: boolean;
  readonly params: ImportedMeshParams | null;
  /**
   * Η αρχική τιμή του εντύπου: η **υπάρχουσα** ταυτότητα σε ανατεθειμένο πλέγμα, αλλιώς η πρόταση.
   * `null` → κενό έντυπο (καμία πηγή δεν αναγνώρισε το αντικείμενο· §3: ποτέ αυθαίρετη προεπιλογή).
   */
  readonly initial: ImportedMeshBoqIdentity | null;
  /**
   * Από πού ήρθε η αρχική τιμή — **μόνο** όταν είναι πρόταση. Σε ήδη ανατεθειμένο πλέγμα είναι
   * `null`: η δική του ταυτότητα δεν χρειάζεται εξήγηση, και μια θα ήταν ψευδής.
   */
  readonly suggestionSource: IdentitySuggestionSource | null;
  /** Η ζωντανή βιβλιοθήκη υλικών — μόνο για τον προαιρετικό δείκτη τιμής. */
  readonly materials: readonly BimMaterial[];
  /**
   * Πόσα **άλλα** εισαγόμενα πλέγματα μένουν ανανάθετα. Δείχνεται γιατί η δουλειά είναι κατά φύση
   * επαναληπτική (ένα `.glb` φέρνει δεκάδες κόμβους) και η απουσία ανάθεσης δεν παράγει γραμμή BOQ:
   * χωρίς αυτόν τον αριθμό, ο χρήστης παραδίδει προϋπολογισμό με αντικείμενα αόρατα (§10.2).
   */
  readonly remainingUnassigned: number;
  readonly onSave: (identity: ImportedMeshBoqIdentity) => void;
  /** Αφαίρεση ανάθεσης → η γραμμή προμέτρησης διαγράφεται. */
  readonly onClear: () => void;
  readonly onCancel: () => void;
}

/** Η κατάσταση του εντύπου — ξεχωριστά ομάδα/υποκατηγορία, όπως το `BOQItemEditor`. */
interface DraftIdentity {
  readonly groupCode: string;
  readonly subCategoryCode: string;
  readonly unit: string;
  readonly titleEL: string;
  readonly materialId: string;
}

const EMPTY_DRAFT: DraftIdentity = {
  groupCode: '', subCategoryCode: '', unit: '', titleEL: '', materialId: '',
};

/** Ο κωδικός που τελικά αποθηκεύεται: η υποκατηγορία όταν επιλέχθηκε, αλλιώς η ομάδα. */
function effectiveCode(draft: DraftIdentity): string {
  return draft.subCategoryCode || draft.groupCode;
}

/** Ταυτότητα → αρχική κατάσταση εντύπου. Η υποκατηγορία αναγνωρίζεται από τη μορφή `OIK-x.y`. */
function draftFromIdentity(identity: ImportedMeshBoqIdentity | null): DraftIdentity {
  if (!identity) return EMPTY_DRAFT;
  const isSub = identity.categoryCode.includes('.');
  return {
    groupCode: isSub ? identity.categoryCode.split('.')[0] : identity.categoryCode,
    subCategoryCode: isSub ? identity.categoryCode : '',
    unit: identity.unit,
    titleEL: identity.titleEL,
    materialId: identity.materialId ?? '',
  };
}

export function ImportedMeshBoqDialog({
  open, params, initial, suggestionSource, materials, remainingUnassigned,
  onSave, onClear, onCancel,
}: ImportedMeshBoqDialogProps) {
  const { t } = useTranslation('dxf-viewer-shell');
  const [draft, setDraft] = useState<DraftIdentity>(EMPTY_DRAFT);

  // Το έντυπο ξαναγεμίζει σε κάθε άνοιγμα: το dialog ανοίγει για ΑΛΛΟ πλέγμα κάθε φορά, οπότε ένα
  // διατηρημένο draft θα μετέφερε σιωπηλά την ταυτότητα του προηγούμενου αντικειμένου.
  useEffect(() => {
    if (open) setDraft(draftFromIdentity(initial));
  }, [open, initial]);

  const code = effectiveCode(draft);
  const subCategories = useMemo(() => subCategoriesFor(draft.groupCode), [draft.groupCode]);
  const units = useMemo(
    () => (params && code ? assignableBoqUnits(params, code) : []),
    [params, code],
  );

  // Αλλαγή άρθρου μπορεί να ακυρώσει την επιλεγμένη μονάδα (άλλο άρθρο, άλλες επιτρεπτές μονάδες).
  // Καθαρίζεται ΕΔΩ, αλλιώς θα αποθηκευόταν μονάδα που η ίδια η λίστα δεν προσφέρει πλέον.
  useEffect(() => {
    setDraft((prev) =>
      prev.unit && !units.includes(prev.unit as ImportedMeshBoqUnit) ? { ...prev, unit: '' } : prev,
    );
  }, [units]);

  const update = useCallback(<K extends keyof DraftIdentity>(key: K, value: DraftIdentity[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGroupChange = useCallback((groupCode: string) => {
    // Η υποκατηγορία ανήκει στην παλιά ομάδα — κρατώντας την θα έγραφε ασύμβατο ζεύγος κωδικών.
    setDraft((prev) => ({ ...prev, groupCode, subCategoryCode: '' }));
  }, []);

  const canSave = Boolean(code) && Boolean(draft.unit) && draft.titleEL.trim().length > 0;
  const noUnits = Boolean(code) && units.length === 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave({
      categoryCode: code,
      unit: draft.unit as ImportedMeshBoqUnit,
      titleEL: draft.titleEL.trim(),
      ...(draft.materialId ? { materialId: draft.materialId } : {}),
    });
  }, [canSave, code, draft, onSave]);

  const isAssigned = params?.importedMeshIdentity !== undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(`${K}.title`)}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{t(`${K}.description`)}</p>
        </DialogHeader>

        {params && <ImportedMeshMeasuredSummary params={params} />}

        {remainingUnassigned > 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            {t(`${K}.remainingUnassigned`, { count: remainingUnassigned })}
          </p>
        )}

        {suggestionSource && (
          <p className="px-2 text-xs text-muted-foreground">
            {t(`${K}.suggestion.${suggestionSource}`)}
          </p>
        )}

        <section className="flex flex-col gap-3 py-1">
          <article className="space-y-1.5">
            <Label>{t(`${K}.fields.group`)}</Label>
            <Select value={draft.groupCode} onValueChange={handleGroupChange}>
              <SelectTrigger><SelectValue placeholder={t(`${K}.fields.groupPlaceholder`)} /></SelectTrigger>
              <SelectContent>
                {ATOE_MASTER_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.code} value={cat.code}>{cat.code} — {cat.nameEL}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </article>

          {subCategories.length > 0 && (
            <article className="space-y-1.5">
              <Label>{t(`${K}.fields.subCategory`)}</Label>
              <Select
                value={draft.subCategoryCode || SELECT_CLEAR_VALUE}
                onValueChange={(v) => update('subCategoryCode', v === SELECT_CLEAR_VALUE ? '' : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_CLEAR_VALUE}>{t(`${K}.fields.subCategoryNone`)}</SelectItem>
                  {subCategories.map((sc) => (
                    <SelectItem key={sc.code} value={sc.code}>{sc.nameEL}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </article>
          )}

          <article className="space-y-1.5">
            <Label>{t(`${K}.fields.unit`)}</Label>
            <Select value={draft.unit} onValueChange={(v) => update('unit', v)} disabled={units.length === 0}>
              <SelectTrigger><SelectValue placeholder={t(`${K}.fields.unitPlaceholder`)} /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>{t(`${K}.units.${u}`)} ({u})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Η απουσία μονάδας ΕΞΗΓΕΙΤΑΙ πάντα: «λείπει» ≠ «ξεχάστηκε». */}
            {noUnits && <p className="text-xs text-destructive">{t(`${K}.noUnitsForArticle`)}</p>}
            {!noUnits && params?.measuredVolumeM3 === null && (
              <p className="text-xs text-muted-foreground">{t(`${K}.openMeshNote`)}</p>
            )}
          </article>

          <article className="space-y-1.5">
            <Label>{t(`${K}.fields.title`)}</Label>
            <Input
              value={draft.titleEL}
              onChange={(e) => update('titleEL', e.target.value)}
              placeholder={t(`${K}.fields.titlePlaceholder`)}
            />
          </article>

          <article className="space-y-1.5">
            <Label>{t(`${K}.fields.material`)}</Label>
            <Select
              value={draft.materialId || SELECT_CLEAR_VALUE}
              onValueChange={(v) => update('materialId', v === SELECT_CLEAR_VALUE ? '' : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_CLEAR_VALUE}>{t(`${K}.fields.materialNone`)}</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nameEl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(`${K}.materialNote`)}</p>
          </article>
        </section>

        <DialogFooter>
          {isAssigned && (
            <button
              type="button"
              onClick={onClear}
              className="mr-auto px-3 py-1.5 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            >
              {t(`${K}.clear`)}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            {t(`${K}.cancel`)}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Tag size={13} />
            {t(`${K}.save`)}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
