'use client';

/**
 * @fileoverview **Τοπογραφικό αγγελίας: αρχείο → σημεία → ετυμηγορία → δημοσίευση** (ADR-920 Β4.7) — όλη η κατάσταση, μηδέν markup.
 * @related lib/terrain/survey-import/survey-file-read (οι δρόμοι) · lib/terrain/survey-import/survey-points (μονάδα, mm) ·
 *   lib/terrain/survey-import/survey-upload-preparation (η ετυμηγορία της πόρτας, στον browser) ·
 *   lib/terrain/publication/terrain-publish-target (ποια πόρτα) · services/listings/publish-listing-terrain.client
 * @module hooks/listings/useTerrainSurveyImport
 *
 * ```
 * αρχείο ─→ readSurveyFile ─→ πίνακας (+ πρόταση στηλών) │ DXF │ άρνηση με όνομα
 *        ─→ αντιστοίχιση + μονάδα (δηλωμένη · προτεινόμενη · του ανθρώπου) ─→ σημεία mm
 *        ─→ prepareSurveyUpload ─→ ΙΔΙΑ ετυμηγορία με την πόρτα (προεπισκόπηση = απάντηση server)
 *        ─→ δήλωση Δ2 από τον ΙΔΙΟ κριτή με την πόρτα ─→ publishListingTerrain (ένα κλειδί ανά προετοιμασία)
 * ```
 *
 * ⚠️ **Μηδέν αγώνας δρόμου**: δεύτερο αρχείο πριν διαβαστεί το πρώτο ⇒ μετρά μόνο το τελευταίο (μετρητής, πρότυπο ΠΕΑ).
 * ⚠️ **Καμία μπαγιάτικη επιτυχία**: η έκβαση της δημοσίευσης ανήκει στα bytes που έφυγαν· αλλάζει στήλη ή μονάδα ⇒
 *    η οθόνη ξαναγυρίζει σε «δεν δημοσιεύτηκε» αντί να δείχνει «δημοσιεύτηκε» για σημεία που δεν στάλθηκαν ποτέ.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { judgeTerrainSurveyDeclaration } from '@/lib/terrain/publication/terrain-survey-declaration';
import type { TerrainPublishTarget } from '@/lib/terrain/publication/terrain-publish-target';
import { readSurveyFile, type SurveyFileRead } from '@/lib/terrain/survey-import/survey-file-read';
import {
  surveyPointsOf,
  surveyUnitDecision,
  type SurveyPoints,
  type SurveyUnitDecision,
} from '@/lib/terrain/survey-import/survey-points';
import { prepareSurveyUpload, type SurveyUploadPreparation } from '@/lib/terrain/survey-import/survey-upload-preparation';
import type { ColumnMapping, ColumnRole, TopoUnit } from '@/lib/terrain/survey-import/topo-import-types';
import { assignRole, padMapping } from '@/lib/terrain/survey-import/topo-mapping-edit';
import { getOrderPresetMapping } from '@/lib/terrain/survey-import/topo-order-presets';
import {
  publishListingTerrain,
  reuseTerrainPublication,
  type PreparedTerrainPublication,
  type TerrainListingOutcome,
  type TerrainPublishRefusal,
} from '@/services/listings/publish-listing-terrain.client';

/** Ό,τι γράφει ο άνθρωπος στη δήλωση Δ2 — ακατέργαστο· το κρίνει ο κριτής της πόρτας, όχι η φόρμα. */
export interface TerrainSurveyDraft {
  readonly surveyorName: string;
  readonly surveyedOn: string;
  readonly rightsAffirmed: boolean;
}

export type TerrainSurveyPublication =
  | { readonly kind: 'idle' }
  | { readonly kind: 'publishing' }
  | { readonly kind: 'published'; readonly fileId: string; readonly listing: TerrainListingOutcome }
  | { readonly kind: 'refused'; readonly refusal: TerrainPublishRefusal };

/** Ό,τι χρειάζεται από το αρχείο του browser — ελέγχεται χωρίς πραγματικό `File`. */
export type SurveyFileInput = Pick<File, 'name' | 'arrayBuffer'>;

export interface TerrainSurveyImportApi {
  readonly fileName: string | null;
  readonly reading: boolean;
  readonly read: SurveyFileRead | null;
  readonly mapping: ColumnMapping;
  readonly unit: TopoUnit | null;
  readonly unitDecision: SurveyUnitDecision | null;
  readonly points: SurveyPoints;
  /** Η ετυμηγορία της πόρτας πάνω στα τρέχοντα σημεία· `null` όσο δεν υπάρχουν σημεία. */
  readonly preparation: SurveyUploadPreparation | null;
  readonly publication: TerrainSurveyPublication;
  /** Υπάρχει πόρτα, πέρασαν τα σημεία την ετυμηγορία, και δεν φεύγει ήδη αίτημα. */
  readonly canPublish: boolean;
  readonly loadFile: (file: SurveyFileInput) => Promise<void>;
  readonly setRole: (columnIndex: number, role: ColumnRole) => void;
  readonly applyPreset: (presetId: string) => void;
  readonly setUnit: (unit: TopoUnit) => void;
  readonly publish: (draft: TerrainSurveyDraft) => Promise<void>;
  readonly reset: () => void;
}

const NO_POINTS: SurveyPoints = { points: [], skippedRows: [] };
const IDLE: TerrainSurveyPublication = { kind: 'idle' };

/** Η αρχική μονάδα: η πρόταση του αρχείου, αν υπάρχει — αλλιώς καμία (ποτέ σιωπηλή προεπιλογή). */
function initialUnitOf(read: SurveyFileRead, mapping: ColumnMapping): TopoUnit | null {
  const decision = surveyUnitDecision(read, mapping);
  return decision.kind === 'to-confirm' ? decision.suggestion?.unit ?? null : null;
}

interface SurveyFileState {
  readonly fileName: string | null;
  readonly reading: boolean;
  readonly read: SurveyFileRead | null;
}

const NO_FILE: SurveyFileState = { fileName: null, reading: false, read: null };

/** Τα bytes του αρχείου, ή άρνηση με όνομα — ένα αρχείο που ο browser δεν διαβάζει δεν κολλά την οθόνη σε «διαβάζεται». */
async function readInput(file: SurveyFileInput): Promise<SurveyFileRead> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { road: 'refused', refusal: 'unreadable' };
  }
  return readSurveyFile(file.name, bytes);
}

/** Το αρχείο και ο αναγνώστης του — μετρά μόνο η τελευταία επιλογή. */
function useSurveyFile(onRead: (read: SurveyFileRead) => void) {
  const [state, setState] = useState<SurveyFileState>(NO_FILE);
  const latest = useRef(0);
  useEffect(() => () => void (latest.current += 1), []);

  const load = useCallback(async (file: SurveyFileInput): Promise<void> => {
    const request = (latest.current += 1);
    setState({ fileName: file.name, reading: true, read: null });
    const read = await readInput(file);
    if (request !== latest.current) return;
    onRead(read);
    setState({ fileName: file.name, reading: false, read });
  }, [onRead]);

  const clear = useCallback(() => {
    latest.current += 1;
    setState(NO_FILE);
  }, []);

  return { ...state, load, clear };
}

interface PublicationState {
  /** Τα bytes στα οποία ανήκει η έκβαση — άλλα τρέχοντα bytes ⇒ η έκβαση δεν ισχύει πια. */
  readonly encoded: string;
  readonly view: TerrainSurveyPublication;
}

/** Η δημοσίευση: κριτής δήλωσης, ένα κλειδί ανά προετοιμασία, έκβαση δεμένη στα bytes της. */
function useSurveyPublication(target: TerrainPublishTarget | null, preparation: SurveyUploadPreparation | null) {
  const [state, setState] = useState<PublicationState | null>(null);
  const prepared = useRef<PreparedTerrainPublication | null>(null);
  const inFlight = useRef(false);
  const encoded = preparation?.ok ? preparation.encoded : null;

  const publish = useCallback(async (draft: TerrainSurveyDraft): Promise<void> => {
    if (target === null || encoded === null || inFlight.current) return;
    const verdict = judgeTerrainSurveyDeclaration(JSON.stringify(draft), new Date());
    if (!verdict.ok) return void setState({ encoded, view: { kind: 'refused', refusal: verdict.code } });

    prepared.current = reuseTerrainPublication(prepared.current, encoded, verdict.declaration);
    inFlight.current = true;
    setState({ encoded, view: { kind: 'publishing' } });
    try {
      const outcome = await publishListingTerrain(target, prepared.current);
      const view: TerrainSurveyPublication = outcome.ok
        ? { kind: 'published', fileId: outcome.fileId, listing: outcome.listing }
        : { kind: 'refused', refusal: outcome.refusal };
      setState({ encoded, view });
    } finally {
      inFlight.current = false;
    }
  }, [target, encoded]);

  const view = state !== null && state.encoded === encoded ? state.view : IDLE;
  const clear = useCallback(() => setState(null), []);
  return { view, publish, clear };
}

export function useTerrainSurveyImport(target: TerrainPublishTarget | null): TerrainSurveyImportApi {
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [unit, setUnit] = useState<TopoUnit | null>(null);

  const onRead = useCallback((read: SurveyFileRead) => {
    const proposed = read.road === 'table' ? read.proposedMapping : [];
    setMapping(proposed);
    setUnit(initialUnitOf(read, proposed));
  }, []);
  const file = useSurveyFile(onRead);
  const { read, clear: clearFile } = file;

  const unitDecision = useMemo(() => (read === null ? null : surveyUnitDecision(read, mapping)), [read, mapping]);
  const points = useMemo(() => (read === null ? NO_POINTS : surveyPointsOf(read, mapping, unit)), [read, mapping, unit]);
  const preparation = useMemo(() => (points.points.length === 0 ? null : prepareSurveyUpload(points.points)), [points]);
  const publication = useSurveyPublication(target, preparation);
  const { clear: clearPublication } = publication;

  const setRole = useCallback((columnIndex: number, role: ColumnRole) => {
    setMapping((previous) => assignRole(previous, columnIndex, role));
  }, []);
  const applyPreset = useCallback((presetId: string) => {
    const preset = getOrderPresetMapping(presetId);
    if (preset !== null) setMapping((previous) => padMapping(preset, previous.length));
  }, []);
  const reset = useCallback(() => {
    clearFile();
    clearPublication();
    setMapping([]);
    setUnit(null);
  }, [clearFile, clearPublication]);

  return {
    fileName: file.fileName, reading: file.reading, read, mapping, unit, unitDecision, points, preparation,
    publication: publication.view,
    canPublish: target !== null && preparation?.ok === true && publication.view.kind !== 'publishing',
    loadFile: file.load, setRole, applyPreset, setUnit, publish: publication.publish, reset,
  };
}
