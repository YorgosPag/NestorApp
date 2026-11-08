/**
 * =============================================================================
 * PDF Canvas Config — Types, constants, and PDF.js loader
 * =============================================================================
 *
 * Extracted from PdfCanvasViewer.tsx to satisfy the 500-line file size rule.
 * Contains: interfaces, zoom constants, and the lazy PDF.js loader.
 *
 * @module components/file-manager/pdf-canvas-config
 * @enterprise ADR-031 - Canonical File Storage System
 */

import type { PDFDataRangeTransport, PageViewport, TextLayer } from 'pdfjs-dist';
import type { RefProxy, TextContent } from 'pdfjs-dist/types/src/display/api';

import type { PreviewUrlDelivery } from './pdf-fetch-target';
import type { IssuePdfLicense } from './pdf-range-transport';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ADR-923 §5.15.2 — **Έντυπο με άδεια**: τα bytes έρχονται κομμάτι-κομμάτι με βραχύβια άδεια που ο θεατής ανανεώνει μόνος του
 * (`pdf-range-transport`). Ο καλών **δηλώνει** τον εκδότη της άδειας — ο viewer δεν μαντεύει (ίδια αρχή με το `urlDelivery`).
 */
export interface PdfLicensedSource {
  /** Σταθερή ταυτότητα του αμετάβλητου αρχείου (π.χ. `editionId`): αλλάζει ⇒ νέο έγγραφο. Η άδεια αλλάζει, το κλειδί όχι. */
  readonly key: string;
  readonly issue: IssuePdfLicense;
}

/** Οι δύο τρόποι να φτάσει το έγγραφο — **αμοιβαία αποκλειόμενοι** στον τύπο. */
export type PdfDocumentSource =
  | { readonly kind: 'file'; readonly url: string; readonly fileId?: string; readonly urlDelivery?: PreviewUrlDelivery }
  | { readonly kind: 'licensed'; readonly license: PdfLicensedSource };

interface PdfFileSourceProps {
  /** PDF download URL (Firebase Storage) */
  url: string;
  /**
   * 🔑 **Το id του αρχείου, όταν υπάρχει** — η **προτιμώμενη** διαδρομή προς τα
   * bytes (ADR-862 Φ0 Β8).
   *
   * Όταν δίνεται, ο viewer ζητά `/api/download?fileId=…`: ο διακομιστής βρίσκει
   * **μόνος του** το αντικείμενο και περνά από τον φρουρό ορατότητας δοχείου. Όταν
   * λείπει, πέφτει στο `?url=`, που φυλάει **μισθωτή** αλλά όχι **δοχείο**.
   *
   * ⚠️ **Ο `FilePreviewRenderer` το είχε ΗΔΗ και δεν το προωθούσε** (μετρημένο
   * 2026-09-16): το κενό ήταν **μία γραμμή**, όχι έλλειψη δεδομένου.
   */
  fileId?: string;
  /**
   * Πώς παραδίδεται το `url` — `'direct'` όταν είναι **βραχύβια υπογεγραμμένη άδεια**
   * που ο διακομιστής έδωσε αφού έκρινε (ADR-901 §14.9). Απών ⇒ `'proxied'`.
   */
  urlDelivery?: PreviewUrlDelivery;
  license?: never;
}

interface PdfLicensedSourceProps {
  /** Έντυπο με ανανεώσιμη άδεια (ADR-923 §5.15.2) — αντί για `url`/`fileId`/`urlDelivery`. */
  license: PdfLicensedSource;
  url?: never;
  fileId?: never;
  urlDelivery?: never;
}

/**
 * ADR-923 §5.15.2 (Θ.2α-2) — οι **στρώσεις αναγνώστη εντύπου**, ρητά ανά καλούντα. Απούσες ⇒ η σημερινή συμπεριφορά
 * (file manager · εισαγωγή καταλόγου αμετάβλητα): ο viewer δεν αποφασίζει μόνος του ότι ένα αρχείο είναι «έντυπο».
 */
export interface PdfViewerFeatures {
  /** Στρώση κειμένου πάνω από το canvas: επιλογή, αντιγραφή, αναγνώστης οθόνης. */
  readonly textSelection?: boolean;
  /** Ενεργοί σύνδεσμοι της σελίδας (εσωτερικοί ⇒ σελίδα · εξωτερικοί μόνο http/https/mailto). */
  readonly links?: boolean;
  /** Η σελίδα ζει στη διεύθυνση ως `#page=N` (Adobe open parameters): βαθύς σύνδεσμος, ανανέωση, QR. */
  readonly pageInUrl?: boolean;
  /** Λήψη των bytes του **ίδιου** εγγράφου — ο καλών ονομάζει το αρχείο, ο viewer δεν μαντεύει. */
  readonly download?: { readonly fileName: string };
  /**
   * Πλευρικό πάνελ (Θ.2α-3): μικρογραφίες από το **ίδιο** φορτωμένο έγγραφο + περιεχόμενα από τους σελιδοδείκτες του.
   * Σε έντυπο με άδεια κάθε μικρογραφία που δεν έχει ήδη ζωγραφιστεί κοστίζει κομμάτια — γι' αυτό είναι opt-in.
   */
  readonly sidebar?: boolean;
}

interface PdfViewerCommonProps {
  /** Accessible title */
  title: string;
  /** Optional className */
  className?: string;
  /** Η σελίδα που ζητά ο καλών (έλεγχος δίπλα-δίπλα, ADR-923 §5.5.1). Απούσα ⇒ ο viewer κρατά δική του πλοήγηση. */
  page?: number;
  /** Περιοχές επισήμανσης σε κλάσματα σελίδας (0..1), αρχή πάνω-αριστερά: ακολουθούν ζουμ και ανάλυση. */
  highlights?: readonly PdfHighlightRegion[];
  /** Στρώσεις αναγνώστη εντύπου (ADR-923 §5.15.2) — απούσες ⇒ σημερινή συμπεριφορά. */
  features?: PdfViewerFeatures;
}

export type PdfCanvasViewerProps = PdfViewerCommonProps & (PdfFileSourceProps | PdfLicensedSourceProps);

/** Τα props του καλούντα → η πηγή του εγγράφου (ένα σημείο, ώστε ο viewer να μη διαβάζει ποτέ `url` μιας πηγής με άδεια). */
export function pdfDocumentSourceOf(props: PdfFileSourceProps | PdfLicensedSourceProps): PdfDocumentSource {
  if (props.license) return { kind: 'licensed', license: props.license };
  return { kind: 'file', url: props.url, fileId: props.fileId, urlDelivery: props.urlDelivery };
}

export interface PdfHighlightRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PdfState {
  numPages: number;
  currentPage: number;
  /** Το ζουμ ΔΕΝ ζει εδώ: έχει έναν κάτοχο, το `usePdfViewport` (ADR-928 §5.25.2). */
  rotation: number;
  loading: boolean;
  error: string | null;
}

// PDF.js types (minimal interface — μόνο ό,τι χρησιμοποιεί ο θεατής· οι σύνθετοι τύποι από τη βιβλιοθήκη)

/** Ρητός προορισμός PDF (`[ref | δείκτης σελίδας, /XYZ, …]`) — ο πρώτος όρος δείχνει τη σελίδα. */
export type PdfExplicitDest = readonly unknown[];

export interface PdfDocProxy {
  numPages: number;
  getPage(num: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
  /** Τα bytes ολόκληρου του εγγράφου — σε έντυπο με άδεια ζητά τα κομμάτια που λείπουν από το **ίδιο** transport. */
  getData(): Promise<Uint8Array<ArrayBuffer>>;
  getDestination(id: string): Promise<PdfExplicitDest | null>;
  getPageIndex(ref: RefProxy): Promise<number>;
  /** Οι σελιδοδείκτες (Θ.2α-3) — `null` ⇒ το έγγραφο δεν έχει. */
  getOutline(): Promise<readonly PdfRawOutlineItem[] | null>;
  /** Οι ετικέτες σελίδων (`/PageLabels`, π.χ. «iv», «85») — `null` ⇒ οι αριθμοί σελίδας είναι οι ετικέτες. */
  getPageLabels(): Promise<readonly string[] | null>;
  /** Τι ζητά το ίδιο το έγγραφο να δείχνει ο αναγνώστης στο άνοιγμα (`UseOutlines` · `UseThumbs` · …). */
  getPageMode(): Promise<string>;
}

/** Ένας σελιδοδείκτης όπως τον δίνει το `getOutline()` του pdf.js — μόνο ό,τι διαβάζει ο θεατής. */
export interface PdfRawOutlineItem {
  readonly title: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly dest: string | PdfExplicitDest | null;
  /** Ήδη απολυμασμένο από το pdf.js — ξαναελέγχεται από τον κριτή συνδέσμων. */
  readonly url: string | null;
  /** > 0 ⇒ ανοιχτός στο άνοιγμα (σύμβαση PDF `/Count`). */
  readonly count?: number;
  readonly items: readonly PdfRawOutlineItem[];
}

/** Ό,τι διαβάζει ο θεατής από μια σημείωση του `getAnnotations()` (ADR-923 §5.15.2 — μόνο σύνδεσμοι). */
export interface PdfAnnotationData {
  readonly subtype?: string;
  /** `[x1, y1, x2, y2]` σε μονάδες PDF (αρχή κάτω-αριστερά). */
  readonly rect?: readonly number[];
  /** Ήδη απολυμασμένο από το pdf.js (`createValidAbsoluteUrl`) — ξαναελέγχεται εδώ. */
  readonly url?: string;
  readonly dest?: string | PdfExplicitDest | null;
}

export interface PdfPageProxy {
  getViewport(opts: { scale: number; rotation?: number }): PageViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PageViewport;
  }): { promise: Promise<void>; cancel(): void };
  streamTextContent(params?: { includeMarkedContent?: boolean }): ReadableStream<TextContent>;
  getAnnotations(params?: { intent?: 'display' }): Promise<PdfAnnotationData[]>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 5;
export const WORKER_URL = '/pdf.worker.min.mjs';

/**
 * Πόσο «ηρεμεί» ένα ζουμ πριν ξαναζωγραφιστεί ό,τι δεν κλιμακώνεται με CSS (pdf.js): το bitmap του canvas και η
 * μέτρηση πλάτους της στρώσης κειμένου. Ως τότε τεντώνεται το παλιό. ΜΙΑ τιμή για όλες τις στρώσεις — αλλιώς στη
 * διάρκεια του ζουμ το κείμενο θα «γλιστρούσε» ως προς το bitmap.
 */
export const PDF_RENDER_SETTLE_MS = 120;

// ============================================================================
// PDF.JS LOADER (lazy, avoids SSR issues)
// ============================================================================

export interface PdfGetDocumentParams {
  url?: string;
  data?: Uint8Array;
  /** Δικό μας transport κομματιών (ADR-923 §5.15.2) — πρέπει να είναι υποκλάση του `PDFDataRangeTransport` ΑΥΤΗΣ της βιβλιοθήκης. */
  range?: PDFDataRangeTransport;
  rangeChunkSize?: number;
  disableAutoFetch?: boolean;
  disableStream?: boolean;
  cMapUrl?: string;
  cMapPacked?: boolean;
}

export type PdfjsLib = {
  getDocument(params: PdfGetDocumentParams): {
    promise: Promise<PdfDocProxy>;
    destroy(): Promise<void>;
  };
  GlobalWorkerOptions: { workerSrc: string };
  PDFDataRangeTransport: typeof PDFDataRangeTransport;
  /** Η στρώση κειμένου της **ίδιας** βιβλιοθήκης (ADR-923 §5.15.2 Θ.2α-2). */
  TextLayer: typeof TextLayer;
};

let pdfjsLib: PdfjsLib | null = null;

export async function loadPdfJs(): Promise<PdfjsLib> {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
  pdfjsLib = lib as unknown as PdfjsLib;
  return pdfjsLib;
}
