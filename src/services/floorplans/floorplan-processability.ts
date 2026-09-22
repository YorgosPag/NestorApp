/**
 * @fileoverview **«Επεξεργάζεται ο διακομιστής αυτό το αρχείο κάτοψης;»** — ΜΙΑ απάντηση, για πελάτη **και** διακομιστή.
 * @module services/floorplans/floorplan-processability
 * @see app/api/floorplans/process/route.ts — ο διακομιστής (ADR-033 · ADR-240)
 * @see components/shared/files/hooks/useFloorplanAutoProcess.ts — ο πελάτης
 * @see ADR-866 §2.10.9 — η βλάβη που το γέννησε
 *
 * 🔴 **Γιατί υπάρχει** (ADR-866 §2.10.9, μετρημένο ζωντανά 2026-09-22): ο πελάτης έστελνε στο
 * `/api/floorplans/process` **κάθε** αρχείο `ready` χωρίς `processedData` — εικόνες PNG **και** αρχεία
 * προσωπικού φακέλου. Ο διακομιστής ξέρει **μόνο** `dxf`/`pdf` και διαβάζει **μόνο** το εταιρικό
 * διαμέρισμα (`fileResource` → `files`) ⇒ `404 File not found`, ξανά σε **κάθε** αλλαγή της λίστας.
 * Ο κανόνας ζούσε **μόνο** στον διακομιστή· ο πελάτης δεν είχε πού να ρωτήσει.
 *
 * **Layering**: leaf — κανένα `server-only`, καμία ανάγνωση. Το εισάγουν διακομιστής και πελάτης.
 */

import { FILE_STATUS, type FileStatus } from '@/config/domain-constants';
import { fileCustodyKindOf, type FileOwnerFields } from '@/lib/files/file-custody';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

/** Τα είδη που ξέρει να επεξεργαστεί ο αγωγός κάτοψης — **το μόνο** σημείο δήλωσής τους. */
export type FloorplanProcessKind = 'dxf' | 'pdf';

const PROCESS_KIND_BY_EXTENSION: Readonly<Record<string, FloorplanProcessKind>> = {
  dxf: 'dxf',
  pdf: 'pdf',
};

/**
 * Το διαμέρισμα που εξυπηρετεί ο αγωγός. Σήμερα **μόνο** εταιρικό: το προσωπικό αρχείο περνά μόνο
 * από την αλυσίδα bytes (ADR-866 §2.6.9 Α). Όταν ο αγωγός μάθει το `personalFileResource`, αλλάζει **εδώ**.
 */
const PROCESSING_CUSTODY: ReadonlySet<CustodyKind> = new Set<CustodyKind>(['company']);

/** `dxf` · `pdf` · `null` — δέχεται `'DXF'`, `'.pdf'`, κενό. */
export function floorplanProcessKindOf(ext: string | null | undefined): FloorplanProcessKind | null {
  const normalized = (ext ?? '').toLowerCase().replace(/^\./, '');
  return PROCESS_KIND_BY_EXTENSION[normalized] ?? null;
}

/** Ό,τι χρειάζεται η ερώτηση από ένα `FileRecord` — τίποτα παραπάνω. */
export interface FloorplanProcessCandidate extends FileOwnerFields {
  readonly ext?: string;
  readonly status?: FileStatus;
  readonly downloadUrl?: string;
  readonly processedData?: unknown;
}

/**
 * **Να ζητήσει ο πελάτης επεξεργασία γι' αυτό το αρχείο;** — ναι **μόνο** όταν ο διακομιστής **μπορεί**
 * να την κάνει (είδος + διαμέρισμα) **και** χρειάζεται (έτοιμο, με bytes, χωρίς αποτέλεσμα).
 */
export function isAutoProcessableFloorplan(file: FloorplanProcessCandidate): boolean {
  if (file.processedData || !file.downloadUrl || file.status !== FILE_STATUS.READY) return false;
  if (floorplanProcessKindOf(file.ext) === null) return false;
  const custody = fileCustodyKindOf(file);
  return custody !== null && PROCESSING_CUSTODY.has(custody);
}
