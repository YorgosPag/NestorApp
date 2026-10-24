/**
 * @fileoverview **Η ΕΙΚΟΝΑ ΔΗΜΟΣΙΕΥΣΗΣ ΕΝΟΣ DXF** — η κατάσταση του παραγώγου και ο ΕΝΑΣ κριτής «υπάρχει;» (ADR-922).
 * @module services/floorplans/dxf-publish-raster
 * @see services/floorplans/dxf-publish-raster.service — ο ΕΝΑΣ γραφέας (διακομιστής)
 * @see services/property-dossier/dossier-media-publication — ο καταναλωτής (ο επιλογέας της βιτρίνας)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΠΡΟΤΥΠΟ: «DERIVATIVE MANIFEST» (Autodesk APS · Box Representations · Google Drive)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα DXF **δεν** μπαίνει σε `<img>` (ADR-841 Α17.7.1). Οι μεγάλοι δεν «δημοσιεύουν το DXF» — δημοσιεύουν
 * ένα **παράγωγο** του, φτιαγμένο από τον διακομιστή, με **καταγεγραμμένη κατάσταση** δίπλα στο πρωτότυπο:
 *
 * | κατάσταση | σημαίνει | τι βλέπει ο άνθρωπος |
 * |---|---|---|
 * | *(απόν)* | δεν ζητήθηκε ακόμη | «Ετοιμάζεται εικόνα…» — ο πελάτης το ζητά μόνος του |
 * | `ready` | το PNG κάθεται δίπλα στο DXF | κουτάκι «Δημοσίευση», όπως κάθε εικόνα |
 * | `failed` | τα bytes **δεν** δίνουν σχέδιο | ονομασμένη αιτία — ποτέ σιωπηλή απουσία |
 *
 * 🔴 **ΤΗΝ ΚΑΤΑΣΤΑΣΗ ΤΗ ΓΡΑΦΕΙ ΜΟΝΟ Ο ΔΙΑΚΟΜΙΣΤΗΣ** (`firestore.rules` → `measuredKeys()`): ένα `ready` γραμμένο από
 * πελάτη θα έστελνε τη βιτρίνα να διαβάσει PNG που δεν έφτιαξε ποτέ κανείς.
 *
 * 🔑 **Η διαδρομή του PNG ΔΕΝ αποθηκεύεται** — βγαίνει από το μητρώο συνοδευτικών (`fileCompanionPath`), όπως το
 * εξώφυλλο βίντεο (ADR-907 §10.8). Δείκτης στην εγγραφή θα ήταν δεύτερη αλήθεια για το ίδιο όνομα.
 *
 * **Layering**: leaf — κανένα `server-only`, καμία ανάγνωση. Το εισάγουν διακομιστής και πελάτης.
 */

import { fileCompanionPath } from '@/lib/files/file-companion-objects';

import { floorplanProcessKindOf } from './floorplan-processability';

/**
 * Γιατί **δεν** βγήκε εικόνα — μόνο αιτίες που ανήκουν στα **bytes**. ⚠️ Βλάβη δικτύου/αποθήκευσης **δεν** γράφεται
 * ποτέ ως `failed`: θα «καταδίκαζε» για πάντα ένα σωστό σχέδιο για μια παροδική στιγμή.
 */
export const DXF_PUBLISH_RASTER_FAILURES = ['unreadable', 'empty-drawing', 'render-failed'] as const;
export type DxfPublishRasterFailure = (typeof DXF_PUBLISH_RASTER_FAILURES)[number];

/** Η καταγεγραμμένη κατάσταση του παραγώγου — πεδίο `publishRaster` της εγγραφής αρχείου. */
export type DxfPublishRaster =
  | {
      readonly status: 'ready';
      /** Διαστάσεις του PNG σε εικονοστοιχεία — η αναλογία **του σχεδίου**, όχι σταθερό πλαίσιο. */
      readonly width: number;
      readonly height: number;
      readonly renderedAt: string;
    }
  | {
      readonly status: 'failed';
      readonly failure: DxfPublishRasterFailure;
      readonly failedAt: string;
    };

/** Ό,τι χρειάζεται η κρίση από ένα `FileRecord` — τίποτα παραπάνω. */
export interface DxfPublishRasterCandidate {
  readonly ext?: string;
  readonly storagePath?: string;
  readonly publishRaster?: DxfPublishRaster;
}

/** Είναι DXF; — από τον **ίδιο** κατάλογο ειδών με τον αγωγό κάτοψης (`floorplanProcessKindOf`). */
export function isDxfFile(file: Pick<DxfPublishRasterCandidate, 'ext'>): boolean {
  return floorplanProcessKindOf(file.ext) === 'dxf';
}

/**
 * **Η διαδρομή του PNG δημοσίευσης — ΜΟΝΟ όταν είναι έτοιμο**, αλλιώς `null`.
 * Ο ένας κριτής για τη φόρμα **και** τον γραφέα της βιτρίνας ⇒ ό,τι υπόσχεται η οθόνη είναι ό,τι φεύγει.
 */
export function dxfPublishRasterPathOf(file: DxfPublishRasterCandidate): string | null {
  if (!isDxfFile(file) || file.publishRaster?.status !== 'ready') return null;
  const storagePath = file.storagePath?.trim() ?? '';
  return storagePath === '' ? null : fileCompanionPath(storagePath, 'dxfPublishRaster');
}

/** Τι λέει η οθόνη για ένα DXF που **δεν** μπορεί ακόμη να δημοσιευτεί. */
export type DxfPublishRasterProgress = 'preparing' | 'failed';

/** `null` για ό,τι δεν είναι DXF ή είναι ήδη έτοιμο. */
export function dxfPublishRasterProgressOf(file: DxfPublishRasterCandidate): DxfPublishRasterProgress | null {
  if (!isDxfFile(file)) return null;
  const status = file.publishRaster?.status;
  if (status === 'ready') return null;
  return status === 'failed' ? 'failed' : 'preparing';
}

/** Πρέπει ο πελάτης να **ζητήσει** το παράγωγο; — μόνο όταν δεν ζητήθηκε ποτέ (καμία καταγεγραμμένη έκβαση). */
export function needsDxfPublishRaster(file: DxfPublishRasterCandidate): boolean {
  return isDxfFile(file) && file.publishRaster === undefined;
}
