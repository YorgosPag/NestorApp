/**
 * =============================================================================
 * Ο ΦΟΡΤΩΤΗΣ ΕΠΑΛΗΘΕΥΜΕΝΩΝ ΠΟΡΩΝ ΤΟΥ OCR (ADR-929 Φ0.4)
 * =============================================================================
 *
 * **Ένας δρόμος** για τον εκτελεστή WASM και για κάθε μοντέλο: λήψη από τον δικό μας διακομιστή → **sha256** απέναντι στο
 * μητρώο → Cache Storage → bytes. Πρότυπο transformers.js / MediaPipe (self-host, cache στον browser)· ο έλεγχος
 * αποτυπώματος είναι το fail-closed του YuNet (`TOUR_FACE_MODEL_SHA256`).
 *
 * 🔑 **Στο cache μπαίνει ΜΟΝΟ ό,τι επαληθεύτηκε**, και ό,τι βγαίνει από το cache **ξαναελέγχεται** (λίγα δέκατα του
 *   δευτερολέπτου για ~53 MB): ένα αλλοιωμένο ή παλιό αντίγραφο σβήνεται και ξανακατεβαίνει, ποτέ δεν φτάνει στο ORT.
 * 🔑 **Cache Storage, όχι HTTP cache**: κανένας κανόνας `immutable` για `/models/` (ADR-860 §Ε2 — θα σφράγιζε και την
 *   απουσία)· το URL είναι ήδη εκδομένο (`…@<revision>/`, `ort/<έκδοση>/`), άρα ένα κλειδί σημαίνει για πάντα τα ίδια bytes.
 * ⚠️ Χωρίς Cache Storage (ιδιωτικό παράθυρο, opaque origin, γεμάτο όριο) η ανάγνωση **δουλεύει** — απλώς ξανακατεβάζει.
 * ⚠️ Το `public/sw.js` σβήνει **όλα** τα caches στο `activate` (no-op SW για καθαρισμό): μια νέα έκδοσή του θα έσβηνε και
 *   αυτό ⇒ μία λήψη ακόμα, όχι σφάλμα.
 *
 * @module bim/plan-recognition/ocr/ocr-asset-loader
 */

import { sha256Hex } from '@/lib/hash/sha256';
import type { OcrAsset } from './ocr-model-assets';

/** Το όνομα του δικού μας cache — εκδομένο: αλλαγή σχήματος = νέο όνομα. */
export const OCR_MODEL_CACHE = 'nestor-models-v1';

export type OcrAssetErrorCode = 'http' | 'integrity';

/** Ο πόρος δεν είναι αυτός που δηλώνει το μητρώο (ή δεν ήρθε) ⇒ η ανάγνωση **δεν** ξεκινά. */
export class OcrAssetError extends Error {
  constructor(readonly code: OcrAssetErrorCode, detail: string) {
    super(`ocr-asset/${code}: ${detail}`);
    this.name = 'OcrAssetError';
  }
}

async function isVerified(bytes: ArrayBuffer, asset: OcrAsset): Promise<boolean> {
  return bytes.byteLength === asset.bytes && (await sha256Hex(bytes)) === asset.sha256;
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(OCR_MODEL_CACHE);
  } catch {
    return null;
  }
}

async function fromCache(cache: Cache, url: string, asset: OcrAsset): Promise<ArrayBuffer | null> {
  const hit = await cache.match(url);
  if (hit === undefined) return null;
  const bytes = await hit.arrayBuffer();
  if (await isVerified(bytes, asset)) return bytes;
  await cache.delete(url);
  return null;
}

async function fromNetwork(url: string, asset: OcrAsset, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new OcrAssetError('http', `${response.status} ${url}`);
  const bytes = await response.arrayBuffer();
  if (!(await isVerified(bytes, asset))) throw new OcrAssetError('integrity', url);
  return bytes;
}

async function storeQuietly(cache: Cache | null, url: string, bytes: ArrayBuffer): Promise<void> {
  if (cache === null) return;
  try {
    await cache.put(url, new Response(bytes));
  } catch {
    // Γεμάτο όριο / απαγόρευση: η ανάγνωση συνεχίζει, η επόμενη απλώς ξανακατεβάζει.
  }
}

/**
 * Τα bytes ενός πόρου, **επαληθευμένα**. `base` = απόλυτη βάση της σελίδας (ο worker του Turbopack γεννιέται από `blob:`
 * URL, όπου ένα σχετικό `/models/…` δεν έχει βάση — `absoluteWorkerUrl`).
 */
export async function loadVerifiedAsset(asset: OcrAsset, base: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const url = new URL(asset.path, base).href;
  const cache = await openCache();
  const cached = cache === null ? null : await fromCache(cache, url, asset);
  if (cached !== null) return cached;
  signal?.throwIfAborted();
  const bytes = await fromNetwork(url, asset, signal);
  await storeQuietly(cache, url, bytes);
  return bytes;
}
