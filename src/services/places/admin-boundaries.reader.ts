import 'server-only';

/**
 * @fileoverview **ΤΑ ΟΡΙΑ ΤΟΥ ADR-883, ΔΙΑΒΑΣΜΕΝΑ ΑΠΟ ΤΟΝ SERVER** — για την απόδοση περιοχής
 * κατά τη δημοσίευση αγγελίας (ADR-890 Φ0).
 * @related `lib/geo/admin-area-of-point.ts` (κριτής) · `admin-footprints.reader.ts` (ίδιο ιδίωμα)
 *
 * 🔑 **Τα ΙΔΙΑ αρχεία που κατεβάζει ο browser** (`public/data/admin-boundaries/*`), με τον ΙΔΙΟ
 * αναγνώστη σχήματος (`readAdminBoundary`) — μέσω `createServerJsonFile`, γιατί ο σχετικός
 * `fetch('/data/…')` δεν λύνεται στο Node. Το `public/` αντιγράφεται στην εικόνα Docker.
 *
 * ⚠️ **Όριο μνήμης (LRU)**: τα 7.432 όρια είναι ~22 MB JSON. Η κάθοδος ανοίγει ~40 ανά σημείο
 * και οι αγγελίες συγκεντρώνονται σε λίγες περιοχές, άρα ένα φραγμένο cache κρατά τα «ζεστά»
 * χωρίς να φορτώσει ποτέ ολόκληρη τη χώρα στη διεργασία.
 */

import { createServerJsonFile, type ServerJsonFile } from '@/lib/data/server-json-file';
import { ADMIN_AREA_INDEX_FILE, readAdminAreaIndex } from '@/lib/geo/admin-area-index-file';
import type { AdminAreaChild, AdminAreaLookup } from '@/lib/geo/admin-area-of-point';
import {
  ADMIN_BOUNDARIES_DIR,
  adminBoundaryFileName,
  adminBoundaryRegion,
  readAdminBoundary,
} from '@/lib/geo/admin-boundary-file';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoRegion } from '@/types/geo/coordinates';

const logger = createModuleLogger('admin-boundaries.reader');

/** Πόσα όρια κρατά η διεργασία. ~4 KB το καθένα (διάμεσος Δ.Ε./κοινότητας) ⇒ λίγα MB. */
const MAX_CACHED_BOUNDARIES = 1024;

const ROOT_KEY = '';

type ChildrenIndex = ReadonlyMap<string, readonly AdminAreaChild[]>;

/** Ευρετήριο → «παιδιά ανά γονέα». Ρίζα = γονέας εκτός ευρετηρίου (Αποκεντρωμένη, βαθμίδα 2). */
function buildChildrenIndex(payload: unknown): ChildrenIndex {
  const areas = readAdminAreaIndex(payload);
  const children = new Map<string, AdminAreaChild[]>();
  for (const area of areas.values()) {
    const key = area.parentId !== null && areas.has(area.parentId) ? area.parentId : ROOT_KEY;
    const siblings = children.get(key) ?? [];
    siblings.push({ id: area.id, level: area.level });
    children.set(key, siblings);
  }
  return children;
}

const INDEX_FILE = createServerJsonFile<ChildrenIndex>({
  publicPath: ADMIN_AREA_INDEX_FILE.split('/'),
  build: buildChildrenIndex,
  onFailure: (error) => {
    logger.error('Δεν διαβάστηκε το ευρετήριο περιοχών', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

const boundaries = new Map<string, ServerJsonFile<GeoRegion>>();

function boundaryFile(adminId: string): ServerJsonFile<GeoRegion> {
  const existing = boundaries.get(adminId);
  if (existing !== undefined) {
    // Ανανέωση θέσης στο LRU: ο Map κρατά σειρά εισαγωγής.
    boundaries.delete(adminId);
    boundaries.set(adminId, existing);
    return existing;
  }

  const file = createServerJsonFile<GeoRegion>({
    publicPath: [...ADMIN_BOUNDARIES_DIR.split('/'), adminBoundaryFileName(adminId)],
    build: (payload) => {
      const boundary = readAdminBoundary(payload, adminId);
      if (boundary === null) throw new TypeError(`Το όριο ${adminId} δεν έχει το αναμενόμενο σχήμα`);
      return adminBoundaryRegion(boundary);
    },
    onFailure: (error) => {
      logger.warn('Δεν διαβάστηκε όριο περιοχής', {
        adminId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  boundaries.set(adminId, file);
  if (boundaries.size > MAX_CACHED_BOUNDARIES) {
    const oldest = boundaries.keys().next().value;
    if (oldest !== undefined) boundaries.delete(oldest);
  }
  return file;
}

/**
 * Η πηγή του κριτή περιοχής — ή `null` όταν το ευρετήριο **δεν διαβάστηκε**.
 *
 * ⚠️ `null` = «δεν μπόρεσα να ρωτήσω». Ο καλών γράφει `adminArea: null` και **συνεχίζει** τη
 * δημοσίευση: μια αγγελία δεν χάνεται επειδή έλειψε ένα παράγωγο αρχείο.
 */
export async function readAdminAreaLookup(): Promise<AdminAreaLookup | null> {
  const children = await INDEX_FILE.read();
  if (children === null) return null;
  return {
    childrenOf: (parentId) => children.get(parentId ?? ROOT_KEY) ?? [],
    regionOf: (adminId) => boundaryFile(adminId).read(),
  };
}
