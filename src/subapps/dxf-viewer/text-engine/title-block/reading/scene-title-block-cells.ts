/**
 * @fileoverview Ζωντανή σκηνή → είσοδος του Λ1 αναγνώστη πινακίδας (ADR-745 Φ3β)
 *
 * Ο Λ1 (`readTitleBlocks`) δέχεται `TitleBlockSourceCell` με **ωμό MTEXT, κωδικοί άθικτοι**.
 * Η σκηνή όμως **δεν το κουβαλά**: ο `convertMText` γράφει `text: extractFlatText(textNode)`
 * — σκέτο κείμενο — και το ωμό `data['1']` πετιέται στη μετατροπή. Ρητό σχόλιο στον converter:
 * *«Flat `.text` = PLAIN text … NOT the raw inline-code string»*, γιατί αλλιώς οι κωδικοί θα
 * φαίνονταν στην οθόνη.
 *
 * 🔑 **Δεν γράφουμε δεύτερο αναγνώστη — κλείνουμε τον κύκλο.** Το `textNode` είναι ακριβώς το
 * *αποτέλεσμα του parse* του ωμού, και ο `serializeDxfTextNode` (ADR-344) είναι η **υπάρχουσα**
 * αντίστροφη συνάρτηση. Άρα: `textNode → serialize → ο ΙΔΙΟΣ mtextToSegments`. Μία μηχανή
 * ύψους/γραμμών, όχι δίδυμη (N.18) — και κάθε διόρθωση στον Λ1 ωφελεί **και** τη ζωντανή
 * διαδρομή, χωρίς να χρειάζεται να θυμηθεί κανείς δύο σημεία.
 *
 * ⚠️ Ο γυρισμός **δεν είναι δωρεάν**: ο serializer εκπέμπει **απόλυτα** `\H`, ενώ ο Λ1 μιλά σε
 * **λόγους**. Γι' αυτό ο `mtextToSegments` δέχεται πλέον το ύψος της οντότητας — δες την
 * κεφαλίδα του. Χωρίς εκείνη τη διόρθωση, αυτό το αρχείο θα διάβαζε **λάθος πρόσωπα σιωπηλά**.
 *
 * @module subapps/dxf-viewer/text-engine/title-block/reading/scene-title-block-cells
 */

import type { Entity, TextEntity } from '../../../types/entities';
import { isTextEntity } from '../../../types/entities';
import { resolveTextHeight } from '../../../hooks/canvas/dxf-text-style-extractor';
import type { SceneLayer } from '../../../types/scene-types';
import type { TitleBlockReading, TitleBlockSourceCell } from '@/types/title-block-reading';
import { serializeDxfTextNode } from '../../serializer/mtext-serializer';
import { DxfDocumentVersion } from '../../types/text-toolbar.types';
import { readTitleBlocks } from './title-block-reading';
import type { TitleBlockProfile } from './title-block-vocabulary';

/**
 * Η έκδοση με την οποία ξαναγράφουμε τους inline κωδικούς.
 *
 * **Ποτέ R12**: εκεί ο serializer υποβαθμίζει σε σκέτο TEXT (`entityType: 'TEXT'`) και **ρίχνει
 * κάθε μορφοποίηση** — δηλαδή ακριβώς την τυπογραφική ιεραρχία `\H` που είναι ο **μόνος** τρόπος
 * να ξεχωρίσει το όνομα του μελετητή από την ειδικότητά του (ADR-745 §2.2β). Δεν είναι επιλογή
 * συμβατότητας: είναι το σήμα μας.
 */
const SERIALIZE_VERSION = DxfDocumentVersion.R2018;

/**
 * Πάνω από αυτό το πλήθος κελιών, ένα layer **δεν εξετάζεται**.
 *
 * Η ομαδοποίηση του Λ1 είναι τετραγωνική (συγκρίνει κάθε ζεύγος κελιών για τη διάμεσο
 * πλησιέστερου γείτονα). Στα 800 κελιά αυτό είναι ~320.000 συγκρίσεις — αδιάφορο· σε ένα layer
 * με δεκάδες χιλιάδες ετικέτες θα πάγωνε η οθόνη. Το όριο **δηλώνεται στο αποτέλεσμα**
 * (`skipped`), ποτέ δεν εφαρμόζεται σιωπηλά: μια πινακίδα που δεν εξετάστηκε πρέπει να
 * ξεχωρίζει από μια πινακίδα που εξετάστηκε και δεν βρέθηκε (ADR-745 §8 κανόνας 3).
 */
const MAX_CELLS_PER_LAYER = 800;

/** Κάτω από δύο κελιά δεν υπάρχει ζεύγος ετικέτα→τιμή — δεν είναι απώλεια, είναι αριθμητική. */
const MIN_CELLS_PER_LAYER = 2;

/** Ένα layer που εξετάστηκε, με το τι απέδωσε. */
export interface TitleBlockLayerCandidate {
  readonly layerId: string;
  readonly layerName: string;
  readonly cells: readonly TitleBlockSourceCell[];
  /** Οι πινακίδες που βρέθηκαν — **πίνακας**: ένα layer μπορεί να φέρει πάνω από μία (Παγίδα Δ). */
  readonly readings: readonly TitleBlockReading[];
  readonly fieldCount: number;
  readonly personCount: number;
}

/** Layer που **δεν** εξετάστηκε — και ο λόγος. Ορατή παράλειψη, όχι σιωπηλή. */
export interface TitleBlockLayerSkip {
  readonly layerId: string;
  readonly layerName: string;
  readonly reason: 'too-many-cells';
  readonly cellCount: number;
}

export interface TitleBlockLayerScan {
  /** Ταξινομημένοι — ο πρώτος είναι ο πιθανότερος. Κενός πίνακας = δεν βρέθηκε πινακίδα. */
  readonly candidates: readonly TitleBlockLayerCandidate[];
  readonly skipped: readonly TitleBlockLayerSkip[];
}

/**
 * Μία οντότητα κειμένου → κελί πινακίδας. `null` όταν δεν φέρει περιεχόμενο.
 *
 * Η ταυτότητα του κελιού είναι το **`entity.id`** (`mtext_12`), **όχι** το DXF handle (κωδ. 5):
 * το handle **δεν φτάνει ποτέ** στη σκηνή — ο converter δεν το διαβάζει καν. Και είναι το σωστό
 * αναγνωριστικό ούτως ή άλλως, γιατί το overlay της Φ4 δουλεύει πάνω σε **οντότητες σκηνής**.
 * Ο `id` παράγεται μόνο κατά την εισαγωγή και επιβιώνει αυτούσιος στη σειριοποίηση, άρα είναι
 * σταθερός για όσο ζει το σχέδιο.
 */
export function sceneCellFromTextEntity(entity: TextEntity): TitleBlockSourceCell | null {
  const raw = rawContentOf(entity);
  if (raw.trim().length === 0) return null;

  return {
    handle: entity.id,
    x: entity.position.x,
    y: entity.position.y,
    // 🔑 **Η μονάδα των απόλυτων `\H`** που εκπέμπει ο serializer — και ο SSoT της είναι ο
    // `resolveTextHeight`, όχι το flat `entity.height` (και τα δύο flat πεδία είναι
    // **προαιρετικά** και το `fontSize` ρητά `@deprecated`). Ο resolver προτιμά το ζωντανό
    // ύψος του πρώτου run, που είναι ακριβώς η βάση από την οποία ο serializer ξεκινά να
    // μετρά διαφορές — δηλαδή η **σωστή** απάντηση, όχι απλώς μια διαθέσιμη.
    height: resolveTextHeight(entity),
    // 🔴 **ADR-762 — χωρίς αυτό το `y` παραπάνω δεν σημαίνει τίποτα.** Ο κωδ. 71 φτάνει ήδη στη
    // σκηνή ως `textNode.attachment` (`dxf-text-converters.ts`, `MTEXT_ATTACHMENT_MAP`) — απλώς
    // **δεν τον ζητούσε κανείς**. Οντότητα χωρίς AST (χειροποίητη, παλιό στιγμιότυπο, σκέτο
    // TEXT) δεν δηλώνει προσάρτηση· το `undefined` πέφτει στην προεπιλογή του DXF (`TL`), που
    // είναι ακριβώς ό,τι εννοεί.
    ...(entity.textNode ? { attachment: entity.textNode.attachment } : {}),
    raw,
  };
}

/**
 * Το ωμό MTEXT της οντότητας — ξαναγραμμένο από το AST όταν υπάρχει.
 *
 * Χωρίς `textNode` (χειροποίητες οντότητες, παλιά στιγμιότυπα) πέφτουμε στο flat `.text`. Αυτό
 * **δεν** είναι υποβάθμιση για τα δεδομένα μας: κείμενο χωρίς AST δεν έχει inline κωδικούς, άρα
 * το σκέτο string **είναι** το ωμό. Ο `mtextToSegments` θα δώσει ένα segment με συντελεστή 1 —
 * σωστό για μονόγραμμη ετικέτα ή τιμή, που είναι ακριβώς αυτό που είναι.
 */
function rawContentOf(entity: TextEntity): string {
  if (!entity.textNode) return entity.text ?? '';
  return serializeDxfTextNode(entity.textNode, { version: SERIALIZE_VERSION }).content;
}

/** Τα κελιά ενός συγκεκριμένου layer, με τη σειρά που τα φέρει η σκηνή. */
export function collectTitleBlockCells(
  entities: readonly Entity[],
  layerId: string,
): TitleBlockSourceCell[] {
  const cells: TitleBlockSourceCell[] = [];
  for (const entity of entities) {
    if (entity.layerId !== layerId) continue;
    // ⚠️ Το κριτήριο είναι `type:'text'`, **όχι** `dxfSourceType === 'mtext'`: ο importer
    // χαρτογραφεί ΚΑΙ τα TEXT ΚΑΙ τα MTEXT σε `type:'text'`, και στο δείγμα αναφοράς τα TEXT
    // είναι **περισσότερα** (308 έναντι 266). Πινακίδα με ετικέτες σε MTEXT και τιμές σε TEXT
    // θα έχανε **όλες** τις τιμές — και ο Λ1 δεν παράγει πεδίο για ετικέτα χωρίς τιμή, οπότε
    // το layer θα φαινόταν απλώς «άδειο».
    if (!isTextEntity(entity)) continue;
    const cell = sceneCellFromTextEntity(entity);
    if (cell) cells.push(cell);
  }
  return cells;
}

/**
 * Σαρώνει όλα τα layers της σκηνής και τα κατατάσσει κατά το πόσο μοιάζουν με πινακίδα.
 *
 * **Δεν μαντεύουμε από το όνομα.** Ένα σκληροκωδικοποιημένο `PINAKAKI` θα ήταν (α) ελληνικό
 * literal σε κώδικα (N.11) και (β) λάθος για κάθε άλλο τοπογραφικό γραφείο. Το ερώτημα που
 * απαντάμε είναι το μόνο που μετράει: **ποιο layer παράγει πινακίδα όταν το διαβάσεις;**
 *
 * Η κατάταξη είναι **πλήρως ντετερμινιστική** (πεδία → πρόσωπα → όνομα) ώστε δύο ανοίγματα του
 * ίδιου σχεδίου να δίνουν την ίδια πρόταση· η σειρά των οντοτήτων δεν επιτρέπεται να αλλάζει
 * ό,τι θα δει ο άνθρωπος.
 */
export function scanTitleBlockLayers(
  entities: readonly Entity[],
  layersById: Readonly<Record<string, SceneLayer>>,
  profile?: TitleBlockProfile,
): TitleBlockLayerScan {
  const candidates: TitleBlockLayerCandidate[] = [];
  const skipped: TitleBlockLayerSkip[] = [];

  for (const layer of Object.values(layersById)) {
    const cells = collectTitleBlockCells(entities, layer.id);
    if (cells.length < MIN_CELLS_PER_LAYER) continue;
    if (cells.length > MAX_CELLS_PER_LAYER) {
      skipped.push({
        layerId: layer.id,
        layerName: layer.name,
        reason: 'too-many-cells',
        cellCount: cells.length,
      });
      continue;
    }

    const readings = readTitleBlocks(layer.name, cells, profile);
    const fieldCount = readings.reduce((sum, r) => sum + r.fields.length, 0);
    const personCount = readings.reduce((sum, r) => sum + r.people.length, 0);
    if (fieldCount === 0 && personCount === 0) continue;

    candidates.push({
      layerId: layer.id,
      layerName: layer.name,
      cells,
      readings,
      fieldCount,
      personCount,
    });
  }

  candidates.sort(compareCandidates);
  skipped.sort((a, b) => a.layerName.localeCompare(b.layerName));
  return { candidates, skipped };
}

/** Περισσότερα πεδία κερδίζουν· μετά περισσότερα πρόσωπα· μετά το όνομα, για ρητή ισοπαλία. */
function compareCandidates(a: TitleBlockLayerCandidate, b: TitleBlockLayerCandidate): number {
  if (a.fieldCount !== b.fieldCount) return b.fieldCount - a.fieldCount;
  if (a.personCount !== b.personCount) return b.personCount - a.personCount;
  return a.layerName.localeCompare(b.layerName);
}
