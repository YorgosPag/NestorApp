'use client';

/**
 * ADR-652 M2 — Block Library SSoT writer/reader (cloud persistence).
 *
 * Root collection `block_library/{blockId}` (id = enterprise `blklib_*`) με scope
 * discrimination: `user` (η ιδιωτική μου βιβλιοθήκη) / `company` / `project` / `system`.
 * Η ΓΕΩΜΕΤΡΙΑ δεν είναι inline: ζει ως blob στο Storage (ADR-652 — Revit `.rfa` /
 * ArchiCAD `.gsm` μοντέλο: κατάλογος με metadata → αρχείο ανά αντικείμενο).
 *
 * ΚΑΜΙΑ νέα μηχανή: το multi-scope list/subscribe/CRUD + cache + builtin guard έρχεται
 * από τον κοινό {@link ScopedLibraryService} (ίδιος πυρήνας με τον `MaterialLibraryService`).
 * Εδώ ζει ΜΟΝΟ ό,τι είναι block-specific: validation, το ανέβασμα της γεωμετρίας, και το
 * **νομικό gate**.
 *
 * ⚖️ Νομικό gate (ADR-652 §Νομική ασφάλεια): προαγωγή σε ΚΟΙΝΟΧΡΗΣΤΟ scope
 * (`company`/`project`) απαιτεί `license.redistributable === true`. Ό,τι ανεβάζει ο
 * χρήστης από ξένο DXF είναι by default `unknown` / `redistributable:false`
 * ({@link DEFAULT_USER_IMPORT_LICENSE}) → μένει στην ΙΔΙΩΤΙΚΗ του βιβλιοθήκη (`user`).
 *
 * SOS N.6: setDoc + enterprise ID only (no addDoc, no inline UUID).
 *
 * @see ./scoped-library-service.ts — ο κοινός πυρήνας βιβλιοθηκών
 * @see ../block-library/block-geometry-storage.ts — geometry blob IO
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md
 */

import { deleteObject, ref as makeStorageRef } from 'firebase/storage';
import { type Unsubscribe } from 'firebase/firestore';

import { storage } from '@/lib/firebase';
import { generateBlockLibraryItemId } from '@/services/enterprise-id.service';
import { buildBlockLibraryGeometryPath } from '@/services/upload/utils/storage-path';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import {
  BLOCK_LIBRARY_ERRORS,
  type BlockLibraryItem,
  type PromoteBlockLibraryItemInput,
  type SaveBlockLibraryItemInput,
  type UpdateBlockLibraryItemInput,
} from '../block-library/block-library-types';
import { assertBlockScopeAllowed } from '../block-library/block-scope-guard';
import { buildBlockThumbnail } from '../block-library/block-thumbnail';
import { uploadBlockGeometry } from '../block-library/block-geometry-storage';
import {
  ScopedLibraryService,
  companyScopeBucket,
  optionalProjectScopeBucket,
  systemScopeBucket,
  userScopeBucket,
} from './scoped-library-service';

// ============================================================================
// CONFIG
// ============================================================================

export interface BlockLibraryServiceConfig {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class BlockLibraryService {
  private readonly library: ScopedLibraryService<BlockLibraryItem>;

  constructor(private readonly config: BlockLibraryServiceConfig) {
    this.library = new ScopedLibraryService<BlockLibraryItem>({
      collectionKey: 'BLOCK_LIBRARY',
      companyId: config.companyId,
      userId: config.userId,
      // Blocks: system (seeded/partner) + «τα δικά ΜΟΥ» (το επιπλέον σκαλί σε σχέση με
      // τα υλικά — ιδιωτική βιβλιοθήκη) + εταιρείας + (προαιρετικά) έργου.
      buckets: [
        systemScopeBucket(),
        userScopeBucket(config.userId),
        companyScopeBucket(),
        ...optionalProjectScopeBucket(config.projectId),
      ],
      errors: {
        notFound: BLOCK_LIBRARY_ERRORS.NOT_FOUND,
        builtinNotMutable: BLOCK_LIBRARY_ERRORS.BUILTIN_NOT_MUTABLE,
      },
    });
  }

  /** Τα blocks που βλέπει ο actor: system + δικά μου + εταιρείας + (optional) έργου. */
  listBlocks(): Promise<readonly BlockLibraryItem[]> {
    return this.library.list();
  }

  /** Live merge subscriber για το palette. */
  subscribeBlocks(
    cb: (items: readonly BlockLibraryItem[]) => void,
    onError: (error: Error) => void = () => {},
  ): Unsubscribe {
    return this.library.subscribe(cb, onError);
  }

  /**
   * «Αποθήκευση στη βιβλιοθήκη» (Revit «Save Family» / AutoCAD `WBLOCK`): ανεβάζει τη
   * γεωμετρία ως blob και γράφει το metadata doc. Δύο βήματα, ΜΕ ΤΗ ΣΩΣΤΗ ΣΕΙΡΑ — πρώτα
   * το blob, μετά το doc: ένα doc χωρίς γεωμετρία θα ήταν σπασμένη κάρτα στο palette,
   * ενώ ένα ορφανό blob είναι απλώς αόρατο (idempotent overwrite στην επόμενη προσπάθεια).
   */
  async saveBlock(input: SaveBlockLibraryItemInput): Promise<BlockLibraryItem> {
    if (!input.name.trim()) {
      throw new Error(BLOCK_LIBRARY_ERRORS.NAME_REQUIRED);
    }
    if (input.localMembers.length === 0) {
      throw new Error(BLOCK_LIBRARY_ERRORS.GEOMETRY_REQUIRED);
    }
    // ⚖️ Το νομικό GATE — ΕΝΑΣ έλεγχος, κοινός με το promoteBlock (block-scope-guard.ts).
    assertBlockScopeAllowed({
      scope: input.scope,
      license: input.license,
      hasProjectId: Boolean(this.config.projectId),
    });

    const id = generateBlockLibraryItemId();
    const { downloadUrl } = await uploadBlockGeometry(
      { companyId: this.config.companyId, blockId: id },
      { name: input.name.trim(), boundsMm: input.boundsMm, localMembers: input.localMembers },
    );

    // M4 — το preview υπολογίζεται ΜΙΑ φορά, τη στιγμή της εγγραφής (Revit/ArchiCAD lifecycle:
    // preview μέσα στον κατάλογο), ώστε το palette να μη χρειάζεται ΠΟΤΕ τη γεωμετρία για μια
    // κάρτα. Block χωρίς γραμμική γεωμετρία (π.χ. μόνο κείμενο) → κανένα πεδίο (fallback bounds).
    const { thumbnail } = buildBlockThumbnail(input.localMembers);

    const created = await this.library.create(id, {
      scope: input.scope,
      name: input.name.trim(),
      category: input.category,
      boundsMm: input.boundsMm,
      geometryUrl: downloadUrl,
      ...(thumbnail ? { thumbnail } : {}),
      // Οι φωλιασμένοι χάρτες καθαρίζονται βαθιά — το Firestore απορρίπτει `undefined`
      // (τα optional πεδία άδειας/προέλευσης μένουν απλώς εκτός εγγράφου).
      provenance: stripUndefinedDeep(input.provenance),
      license: stripUndefinedDeep(input.license),
      projectId: input.scope === 'project' ? (this.config.projectId ?? null) : null,
    });

    return created as unknown as BlockLibraryItem;
  }

  /**
   * «Δημοσίευση» ιδιωτικού block σε κοινόχρηστη βιβλιοθήκη (εταιρείας/έργου) — ADR-652 M3.
   *
   * Πρακτική μεγάλων παικτών: ArchiCAD «publish to office library» / Figma «publish to team
   * library» = ρητή ενέργεια πάνω σε ΥΠΑΡΧΟΝ αντικείμενο, ΟΧΙ δεύτερο αντίγραφο. Άρα εδώ
   * αλλάζει ΜΟΝΟ το `scope` του ίδιου doc: το geometry blob μένει εκεί που είναι (ίδιο
   * `geometryUrl`, ίδιο id) — καμία διπλή γεωμετρία, καμία δεύτερη κάρτα.
   *
   * Ο χρήστης μπορεί να διορθώσει την άδεια στην ίδια κίνηση (`input.license`)· το GATE
   * τρέχει πάνω στην ΤΕΛΙΚΗ άδεια — τον ΙΔΙΟ έλεγχο με το `saveBlock` (κοινός guard).
   */
  async promoteBlock(input: PromoteBlockLibraryItemInput): Promise<void> {
    // Υπάρχει + δεν είναι builtin (system seed → immutable) — ο πυρήνας το φυλά.
    const current = await this.library.requireMutable(input.blockId);
    const license = input.license ?? current.license;

    assertBlockScopeAllowed({
      scope: input.scope,
      license,
      hasProjectId: Boolean(this.config.projectId),
    });

    await this.library.patch(input.blockId, {
      scope: input.scope,
      projectId: input.scope === 'project' ? (this.config.projectId ?? null) : null,
      license: stripUndefinedDeep(license),
    });
  }

  /**
   * «Επεξεργασία» metadata ενός ΗΔΗ αποθηκευμένου block (ADR-652 M4): μετονομασία, αλλαγή
   * κατηγορίας, διόρθωση άδειας — **χωρίς** να αγγίξει γεωμετρία, scope ή ιδιοκτησία.
   *
   * Πρακτική μεγάλων παικτών: Revit «Family Properties» / ArchiCAD «Object Settings» —
   * το metadata ενός αντικειμένου διορθώνεται επί τόπου, ΧΩΡΙΣ να ξαναχτιστεί το αρχείο του
   * (το `.rfa`/`.gsm` μένει ως έχει). Εδώ: ίδιο doc, ίδιο `geometryUrl`, ίδιο blob, ίδιο id.
   *
   * ⚖️ Το νομικό gate ΞΑΝΑΤΡΕΧΕΙ πάνω στο **τρέχον scope** με τη **νέα άδεια**: ένα ήδη
   * δημοσιευμένο block δεν επιτρέπεται να «υποβαθμίσει» την άδειά του σε μη-αναδιανεμήσιμη
   * και να παραμείνει κοινόχρηστο — αλλιώς η επεξεργασία θα ήταν πίσω πόρτα του gate
   * (ΑΚΡΙΒΩΣ ο λόγος που ο έλεγχος ζει στον κοινό `block-scope-guard`).
   *
   * Το `thumbnail` ΔΕΝ ξαναϋπολογίζεται: η γεωμετρία δεν άλλαξε.
   */
  async updateBlock(input: UpdateBlockLibraryItemInput): Promise<void> {
    const name = input.name.trim();
    if (!name) {
      throw new Error(BLOCK_LIBRARY_ERRORS.NAME_REQUIRED);
    }

    // Υπάρχει + δεν είναι builtin (seeded content = read-only) — ο πυρήνας το φυλά.
    const current = await this.library.requireMutable(input.blockId);

    assertBlockScopeAllowed({
      scope: current.scope,
      license: input.license,
      hasProjectId: Boolean(this.config.projectId),
    });

    await this.library.patch(input.blockId, {
      name,
      category: input.category,
      license: stripUndefinedDeep(input.license),
    });
  }

  /**
   * Διαγράφει ένα ΜΗ-builtin block της βιβλιοθήκης (doc + geometry blob). Το doc φεύγει
   * πρώτο: αν το Storage delete αποτύχει, το αντικείμενο έχει ήδη εξαφανιστεί από το
   * palette και το blob μένει απλώς ορφανό (αόρατο), αντί για κάρτα χωρίς γεωμετρία.
   */
  async deleteBlock(blockId: string): Promise<void> {
    await this.library.remove(blockId);
    try {
      const path = buildBlockLibraryGeometryPath({
        companyId: this.config.companyId,
        blockId,
      });
      await deleteObject(makeStorageRef(storage, path));
    } catch {
      // Ορφανό blob — καλόπιστη προσπάθεια, δεν αποτυγχάνει η διαγραφή για αυτό.
    }
  }

  getBlockById(blockId: string): Promise<BlockLibraryItem | null> {
    return this.library.getById(blockId);
  }

  invalidateCache(): void {
    this.library.invalidateCache();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBlockLibraryService(
  config: BlockLibraryServiceConfig,
): BlockLibraryService {
  return new BlockLibraryService(config);
}
