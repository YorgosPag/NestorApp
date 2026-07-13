/**
 * ADR-651 Φάση Γ — διάταξη πινακίδας **παραμετρική ανά φύλλο**, σε sheet-mm (`DetailPrimitive[]`).
 *
 * Φάση Β: μίνιμαλ κουτί σταθερού πλάτους 180mm. **Φάση Γ**: το κουτί παύει να είναι σταθερό —
 * θέση/πλάτος/ύψος **υπολογίζονται** από το μοντέλο φύλλου ISO 5457 (`sheet-frame.ts`) για
 * κάθε A4…A0 × όρθιο/πλαγιαστό, και προαιρετικά συνοδεύεται από την **πλήρη κορνίζα** του
 * φύλλου (περίγραμμα + περιθώριο αρχειοθέτησης).
 *
 * Καμία νέα μηχανή διάταξης (SSoT):
 *  - **ορθογώνια φύλλου/πινακίδας/σφραγίδας** → `sheet-frame.ts` (paper SSoT + ISO 5457),
 *  - **γραμμές `label : value`** → `buildFieldBlock` (ADR-622),
 *  - **αποστάσεις/ύψη** → `FIELD_BLOCK_METRICS` (ίδιο module — μηδέν διπλοί μαγικοί αριθμοί).
 *
 * Καθαρή συνάρτηση (N.7.2): ίδιο input ⇒ ίδιο output — το ghost και το commit παράγουν
 * byte-identical γεωμετρία.
 */

import {
  buildFieldBlock,
  FIELD_BLOCK_METRICS,
  type FieldRow,
} from '../../bim/structural/detail-sheet/detail-sheet-field-block';
import type {
  DetailPrimitive,
  RectMm,
  SheetStroke,
} from '../../bim/structural/detail-sheet/detail-sheet-types';
import type { PaperSpec } from '../../print/config/paper-types';
import {
  buildSheetFramePrimitives,
  computeSheetFrameMetrics,
  FRAME_STROKE,
  rectOutline,
  translateRect,
  type SheetFrameMetrics,
} from './sheet-frame';
import type { TitleBlockContent } from './title-block-rows';

/** Εσωτερικοί διαχωριστές (κεφαλίδα, κελί σφραγίδας) — λεπτοί, όπως ορίζει η πρακτική. */
const DIVIDER_STROKE: SheetStroke = { colorHex: '#111111', widthMm: 0.25 };

/** Ύψος κειμένου κεφαλίδας (mm χαρτιού) — μεγαλύτερο από το ύψος γραμμής πεδίου. */
const HEADING_TEXT_MM = 3.5;
const HEADING_HEX = '#111111';
/** Το κείμενο «ΣΦΡΑΓΙΔΑ» είναι υπότιτλος του κελιού, όχι πεδίο — μικρότερο. */
const STAMP_TEXT_MM = 2.2;
const STAMP_HEX = '#555555';

/**
 * ADR-651 Φάση Ε — η **εικόνα** σφραγίδας/υπογραφής, όπως τη ζητά το layout.
 *
 * Το `src` είναι ό,τι μορφή θέλει το backend του καλούντος — και τα δύο ζωγραφίζονται από το
 * ΙΔΙΟ `RasterPrimitive` (ADR-622):
 *  - **in-scene / canvas**: το https download URL (το σχέδιο κρατά αναφορά, ποτέ pixels),
 *  - **PDF**: data URL (ο jsPDF `addImage` δεν δέχεται remote URL).
 *
 * Οι εγγενείς διαστάσεις pixel επιτρέπουν **contain-fit** (διατήρηση αναλογίας) χωρίς decode
 * μέσα στον ζωγράφο — μια παραμορφωμένη σφραγίδα δεν είναι σφραγίδα.
 */
export interface TitleBlockStampImage {
  readonly src: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Το εξωτερικό μέγεθος αυτού που τοποθετείται (φύλλο με κορνίζα, ή σκέτη πινακίδα). */
export interface TitleBlockSizeMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface TitleBlockLayout {
  readonly primitives: readonly DetailPrimitive[];
  readonly sizeMm: TitleBlockSizeMm;
}

/** Τι σημαίνει το `(0,0)` της παραγόμενης γεωμετρίας. */
export type TitleBlockOrigin = 'sheet' | 'title-block';

export interface TitleBlockLayoutOptions {
  /** Μέγεθος + προσανατολισμός χαρτιού (paper SSoT· ορίζει ΟΛΗ τη γεωμετρία). */
  readonly paper: PaperSpec;
  /** Πλήρης κορνίζα φύλλου ISO 5457· `false` ⇒ μόνο το κουτί της πινακίδας (Φάση Β). */
  readonly withFrame: boolean;
  /** Κενό κελί σφραγίδας/υπογραφής αριστερά μέσα στην πινακίδα (preset «Άδεια δόμησης»). */
  readonly withStampBox: boolean;
  /** Το ΛΥΜΕΝΟ κείμενο του κελιού σφραγίδας (περιεχόμενο σχεδίου· `''` ⇒ χωρίς κείμενο). */
  readonly stampLabel: string;
  /**
   * ADR-651 Φάση Ε (Απόφαση #6α) — η ανεβασμένη σφραγίδα του μηχανικού. `null`/απόν ⇒ **κενό
   * κουτί** για σφράγιση με το χέρι (Απόφαση #6γ): τρεις τρόποι, ΕΝΑ κελί.
   */
  readonly stampImage?: TitleBlockStampImage | null;
  /**
   * Πού πέφτει η αρχή των συντεταγμένων. Default = ό,τι **τοποθετείται**: με κορνίζα η γωνία
   * του φύλλου, χωρίς κορνίζα η γωνία της πινακίδας (η συμπεριφορά της Φάσης Β/Γ — ο χρήστης
   * πιάνει αυτό που βλέπει).
   *
   * Η **εκτύπωση** (Φάση ΣΤ) περνά ρητά `'sheet'`: το (0,0) είναι πάντα η γωνία της σελίδας
   * PDF, ακόμη κι όταν δεν ζωγραφίζεται κορνίζα — αλλιώς η πινακίδα δεν θα έπεφτε στη θέση
   * που ορίζει το ISO 5457 (κάτω-δεξιά μέσα στα περιθώρια).
   */
  readonly origin?: TitleBlockOrigin;
}

/** Οριζόντιος διαχωριστής κάτω από τη ζώνη κεφαλίδας, στο πλάτος της ζώνης πεδίων. */
function headingDividerPrimitive(fields: RectMm): DetailPrimitive {
  const y = fields.y + FIELD_BLOCK_METRICS.topPadMm - FIELD_BLOCK_METRICS.sidePadMm;
  return {
    kind: 'line',
    a: { x: fields.x, y },
    b: { x: fields.x + fields.w, y },
    stroke: DIVIDER_STROKE,
  };
}

/** Το κείμενο της κεφαλίδας (επωνυμία γραφείου), αριστερά μέσα στη ζώνη κεφαλίδας. */
function headingPrimitive(fields: RectMm, heading: string): DetailPrimitive {
  return {
    kind: 'text',
    position: {
      x: fields.x + FIELD_BLOCK_METRICS.sidePadMm,
      y: fields.y + HEADING_TEXT_MM + FIELD_BLOCK_METRICS.sidePadMm,
    },
    text: heading,
    heightMm: HEADING_TEXT_MM,
    colorHex: HEADING_HEX,
    align: 'left',
    bold: true,
  };
}

/**
 * Η περιοχή της **εικόνας** μέσα στο κελί σφραγίδας: το κελί μείον τη ζώνη του υπότιτλου
 * (ώστε η εικόνα να μην πατά πάνω στη λέξη «ΣΦΡΑΓΙΔΑ») και μείον το περιθώριο του κελιού.
 */
function stampImageRect(stamp: RectMm, hasLabel: boolean): RectMm {
  const pad = FIELD_BLOCK_METRICS.sidePadMm;
  const labelBandMm = hasLabel ? STAMP_TEXT_MM + pad : 0;
  return {
    x: stamp.x + pad,
    y: stamp.y + pad + labelBandMm,
    w: stamp.w - pad * 2,
    h: stamp.h - pad * 2 - labelBandMm,
  };
}

/**
 * Το κελί σφραγίδας: περίγραμμα + υπότιτλος + (προαιρετικά) η **εικόνα** της σφραγίδας
 * (Απόφαση #6 — και τα τρία: εικόνα / κείμενο / κενό κουτί, ΕΝΑ κελί).
 *
 * Η εικόνα μπαίνει ως `RasterPrimitive` (ADR-622) ⇒ τα backends τη ζωγραφίζουν **δωρεάν**:
 * PDF (`drawRaster` + contain-fit) και canvas ήδη το υποστηρίζουν, το in-scene backend το
 * μετατρέπει σε `ImageEntity` (`detail-primitives-to-entities`).
 */
function stampPrimitives(
  stamp: RectMm,
  label: string,
  image: TitleBlockStampImage | null | undefined,
): DetailPrimitive[] {
  const out: DetailPrimitive[] = [rectOutline(stamp, DIVIDER_STROKE)];
  if (label) {
    out.push({
      kind: 'text',
      position: {
        x: stamp.x + stamp.w / 2,
        y: stamp.y + FIELD_BLOCK_METRICS.sidePadMm + STAMP_TEXT_MM,
      },
      text: label,
      heightMm: STAMP_TEXT_MM,
      colorHex: STAMP_HEX,
      align: 'center',
    });
  }
  if (image) {
    const rect = stampImageRect(stamp, Boolean(label));
    if (rect.w > 0 && rect.h > 0) {
      out.push({
        kind: 'raster',
        rect,
        dataUrl: image.src,
        widthPx: image.widthPx,
        heightPx: image.heightPx,
      });
    }
  }
  return out;
}

/** Οι μετρικές μετατοπισμένες ώστε η αρχή (0,0) να είναι αυτό που ορίζει το `origin`. */
function anchorMetrics(metrics: SheetFrameMetrics, origin: TitleBlockOrigin) {
  const sheetOrigin = origin === 'sheet';
  const dx = sheetOrigin ? 0 : -metrics.titleBlock.x;
  const dy = sheetOrigin ? 0 : -metrics.titleBlock.y;
  return {
    titleBlock: translateRect(metrics.titleBlock, dx, dy),
    fields: translateRect(metrics.fields, dx, dy),
    stamp: metrics.stamp ? translateRect(metrics.stamp, dx, dy) : null,
  };
}

/**
 * Χτίζει τα primitives σε sheet-mm (αρχή = πάνω-αριστερά, +y προς τα κάτω — σύμβαση ADR-622).
 * Με κορνίζα, η αρχή είναι η γωνία του **φύλλου**· χωρίς κορνίζα, η γωνία της **πινακίδας**.
 */
export function buildTitleBlockLayout(
  content: TitleBlockContent,
  options: TitleBlockLayoutOptions,
): TitleBlockLayout {
  const rows: readonly FieldRow[] = content.rows;
  const metrics = computeSheetFrameMetrics({
    paper: options.paper,
    rowCount: rows.length,
    withStampBox: options.withStampBox,
  });
  const origin: TitleBlockOrigin = options.origin ?? (options.withFrame ? 'sheet' : 'title-block');
  const { titleBlock, fields, stamp } = anchorMetrics(metrics, origin);

  const primitives: DetailPrimitive[] = [];
  if (options.withFrame) primitives.push(...buildSheetFramePrimitives(metrics));
  primitives.push(rectOutline(titleBlock, FRAME_STROKE));
  if (stamp) primitives.push(...stampPrimitives(stamp, options.stampLabel, options.stampImage));
  if (content.heading) {
    primitives.push(headingDividerPrimitive(fields), headingPrimitive(fields, content.heading));
  }
  primitives.push(...buildFieldBlock(fields, rows));

  return {
    primitives,
    sizeMm:
      origin === 'sheet'
        ? { widthMm: metrics.sheetWidthMm, heightMm: metrics.sheetHeightMm }
        : { widthMm: titleBlock.w, heightMm: titleBlock.h },
  };
}
