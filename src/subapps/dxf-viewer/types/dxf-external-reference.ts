/**
 * ADR-736 — **Εξωτερικές αναφορές (συνημμένα) ενός DXF**: το μοντέλο.
 *
 * 🔴 **Η μία πρόταση που πρέπει να καταλάβει όποιος αγγίξει αυτό το αρχείο:**
 * **το DXF κρατά ΔΙΑΔΡΟΜΕΣ, όχι ΠΕΡΙΕΧΟΜΕΝΟ.** Με μοναδική εξαίρεση το `OLE2FRAME` (που
 * ενσωματώνει δυαδικά δεδομένα), κάθε «συνημμένο» είναι μια **αναφορά σε εξωτερικό αρχείο** —
 * αποθηκεύεται το μονοπάτι, ποτέ τα bytes.
 *
 * Άρα η λειτουργία είναι **δύο πράγματα, όχι ένα**:
 *   1. **ΑΝΙΧΝΕΥΣΗ** — τι δηλώνει το αρχείο ότι έχει. Γίνεται offline, από το ίδιο το DXF,
 *      και **πετυχαίνει πάντα**.
 *   2. **ΕΠΙΛΥΣΗ** — να βρεθούν τα πραγματικά αρχεία. **Συνήθως αποτυγχάνει μερικώς, και αυτό
 *      είναι ΦΥΣΙΟΛΟΓΙΚΗ ΚΑΤΑΣΤΑΣΗ, όχι σφάλμα.**
 *
 * Γι' αυτό το `status` είναι πεδίο πρώτης τάξεως και το `'missing'` **δεν μπλοκάρει ποτέ** την
 * εισαγωγή — ίδια απόφαση με Revit *Manage Links*, ArchiCAD *Hotlink Manager* και AutoCAD
 * *External References* palette, όπου ένας χαμένος σύνδεσμος ξεφορτώνεται και το σχέδιο ανοίγει.
 *
 * **Μετρημένο στο πραγματικό δείγμα** (τοπογραφικό Ι. Νικολάου, 70.391 ζεύγη κωδικού/τιμής):
 * 10 `IMAGE` + 10 `IMAGEDEF`, **0 xref**, **0 underlay**, **0 OLE**, **0 data link**. Και οι 10
 * διαδρομές είναι απόλυτες στον δίσκο `Z:` του τοπογράφου ⇒ **100% ανεπίλυτες στον ΝΕΣΤΩΡΑ**.
 * Το συμπέρασμα σχεδιασμού: η αξία δεν είναι στην ανάγνωση της διαδρομής — είναι στο **να
 * ξαναβρεθούν τα αρχεία** από αυτά που δίνει ο χρήστης.
 *
 * @see utils/dxf-external-reference-reader.ts — η ανίχνευση (parser, ΚΑΙ οι δύο πόρτες import)
 * @see docs/centralized-systems/reference/adrs/ADR-736-dxf-external-references.md
 */

/**
 * Τα είδη «συνημμένου» που αναγνωρίζει το AutoCAD. **Είναι έξι διαφορετικά πράγματα κάτω από
 * μία λέξη** — αν υλοποιηθεί μόνο ένα, η λειτουργία φαίνεται σπασμένη στο επόμενο αρχείο.
 *
 * | Είδος | Οντότητα (ENTITIES) | Ορισμός (OBJECTS/BLOCKS) | Πού είναι η διαδρομή |
 * |---|---|---|---|
 * | `raster`        | `IMAGE`         | `IMAGEDEF`                  | `IMAGEDEF` group **1** |
 * | `xref`          | `INSERT`        | `BLOCK` flag **70** bit 4/8 | `BLOCK` group **1** |
 * | `pdf-underlay`  | `PDFUNDERLAY`   | `PDFDEFINITION`             | group **1** (+**2** = σελίδα) |
 * | `dwf-underlay`  | `DWFUNDERLAY`   | `DWFDEFINITION`             | ομοίως |
 * | `dgn-underlay`  | `DGNUNDERLAY`   | `DGNDEFINITION`             | ομοίως |
 * | `ole-embedded`  | `OLE2FRAME`     | —                           | 🔴 **δεν υπάρχει — τα bytes είναι ΜΕΣΑ** |
 * | `data-link`     | —               | `DATALINK`                  | διαδρομή/σύνδεσμος |
 */
export type DxfExternalReferenceKind =
  | 'raster'
  | 'xref'
  | 'pdf-underlay'
  | 'dwf-underlay'
  | 'dgn-underlay'
  | 'ole-embedded'
  | 'data-link';

/**
 * Η κατάσταση ενός συνδέσμου — **η ίδια τριάδα που δείχνει η στήλη «Status» του Revit**.
 *
 * - `resolved`    — βρέθηκε το αρχείο· το `url` δείχνει σε ανεβασμένο asset.
 * - `missing`     — το DXF το δηλώνει, ο ΝΕΣΤΩΡ δεν το έχει. **Φυσιολογικό, όχι σφάλμα.**
 * - `unsupported` — ανιχνεύτηκε αλλά ο ΝΕΣΤΩΡ δεν το αποδίδει ακόμη (xref/underlay/OLE/data link).
 *   Ρητά **ορατό** στο μητρώο: «ξέρω ότι είσαι εδώ, δεν σε ζωγραφίζω» είναι ειλικρινές·
 *   το να μη φαίνεται καθόλου είναι το σημερινό σφάλμα σε άλλη μορφή.
 */
export type DxfExternalReferenceStatus = 'resolved' | 'missing' | 'unsupported';

/** Διαστάσεις σε pixels (`IMAGEDEF` group 10/20) ή μέγεθος pixel σε μονάδες σχεδίου (group 11/21). */
export interface DxfReferenceVec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Μία εξωτερική αναφορά, όπως τη **δηλώνει** το DXF.
 *
 * ⚠️ **Immutable.** Η επίλυση δεν μεταλλάσσει — παράγει **νέο** αντικείμενο με `status:'resolved'`
 * και `url`. Έτσι το «τι δήλωνε το αρχείο» δεν χάνεται ποτέ, και ο κύκλος
 * ανίχνευση → επίλυση είναι **idempotent**: ξανατρέχει χωρίς να συσσωρεύει κατάσταση.
 *
 * ⚠️ **ΔΕΝ είναι Firestore document** — ζει μέσα στο `SceneModel`, άρα δεν του χρειάζεται
 * enterprise ID (ο N.6 αφορά έγγραφα Firestore). Το *ανεβασμένο αρχείο* όμως είναι, και παίρνει
 * `generateDeterministicFileId(contentHash)`.
 */
export interface DxfExternalReference {
  /**
   * Σταθερό κλειδί αναζήτησης **μέσα στο σχέδιο**. Είναι το DXF handle (group 5) του ορισμού
   * όταν υπάρχει — γιατί **έτσι ακριβώς το δείχνει η οντότητα**: το `IMAGE` group 340 κρατά το
   * handle του `IMAGEDEF` του. Χωρίς handle (π.χ. `BLOCK` xref) πέφτει στο όνομα του block.
   * Ντετερμινιστικό ⇒ επανεισαγωγή του ίδιου αρχείου δίνει τα ίδια ids.
   */
  readonly id: string;
  readonly kind: DxfExternalReferenceKind;
  readonly status: DxfExternalReferenceStatus;
  /** Η διαδρομή **ακριβώς όπως τη γράφει το DXF** (`Z:\Jobs\…`). Μόνο για εμφάνιση/διάγνωση. */
  readonly rawPath: string;
  /** Το τελευταίο segment της `rawPath` — το **μόνο** κομμάτι που χρησιμεύει σε ταύτιση. */
  readonly basename: string;
  /** Το DXF handle (group 5) του ορισμού· απουσιάζει σε είδη χωρίς object ορισμό. */
  readonly sourceHandle?: string;
  /** `IMAGEDEF` group 10/20 — εγγενές μέγεθος του raster σε pixels. Κλειδί ταύτισης 4ου περάσματος. */
  readonly imageSizePx?: DxfReferenceVec2;
  /** `IMAGEDEF` group 11/21 — μέγεθος ενός pixel σε μονάδες σχεδίου. */
  readonly pixelSizeUnits?: DxfReferenceVec2;
  /** `IMAGEDEF` group 280 — το AutoCAD το είχε φορτωμένο όταν σώθηκε το αρχείο. */
  readonly loadedInSource?: boolean;
  /** Όνομα block (xref) ή σελίδα (PDF underlay, group 2) — ό,τι προσδιορίζει τον σύνδεσμο πέρα από τη διαδρομή. */
  readonly detail?: string;
  /** `BLOCK` flag 70 bit 8 — overlay αντί για attachment (δεν αλυσιδώνεται σε nested xref). */
  readonly isOverlay?: boolean;
  /** Το URL του ανεβασμένου asset. Υπάρχει **μόνο** όταν `status === 'resolved'`. */
  readonly url?: string;
}

/** Σύνοψη για τοast/μητρώο — «10 συνημμένα: 9 βρέθηκαν, 1 λείπει». */
export interface DxfExternalReferenceSummary {
  readonly total: number;
  readonly resolved: number;
  readonly missing: number;
  readonly unsupported: number;
}

/** Μετρά τις καταστάσεις μιας λίστας αναφορών. Pure — ίδια είσοδος, ίδια έξοδος. */
export function summarizeExternalReferences(
  refs: readonly DxfExternalReference[],
): DxfExternalReferenceSummary {
  let resolved = 0;
  let missing = 0;
  let unsupported = 0;
  for (const ref of refs) {
    if (ref.status === 'resolved') resolved++;
    else if (ref.status === 'missing') missing++;
    else unsupported++;
  }
  return { total: refs.length, resolved, missing, unsupported };
}
