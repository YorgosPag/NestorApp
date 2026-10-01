/**
 * =============================================================================
 * ΜΙΑ ΑΠΑΝΤΗΣΗ ΥΠΟΛΟΓΙΣΜΕΝΗ ΑΠΟ ΤΑ BYTES ΕΝΟΣ ΑΡΧΕΙΟΥ — ΧΩΡΙΣ ΝΑ ΦΥΓΟΥΝ ΤΑ BYTES
 * =============================================================================
 * `GET /api/files/{fileId}/<insight>` — η αλυσίδα **λήψης** (ταυτότητα → κάτοχος → ορατότητα δοχείου → bytes, όλα στο
 * `loadOwnedFileBytes`) και μετά **μία** καθαρή συνάρτηση πάνω στα bytes. Η απάντηση είναι το αποτέλεσμα, ποτέ τα bytes.
 *
 * @module api/files/_shared/owned-file-insight-route
 *
 * 🔑 **Εξήχθη τη μέρα που ήρθε ο ΔΕΥΤΕΡΟΣ** (ADR-897 Φ5, `capture-facts`, μετά το `focal-point` του ADR-880): ίδιος
 *   σκελετός, ίδια σειρά φρουρών, ίδια 404/503 — διαφέρει **μόνο** το «τι υπολογίζω» και το σχήμα της απάντησης.
 * 🔴 **ΜΟΝΟ Ο ΧΕΙΡΙΣΤΗΣ, ΠΟΤΕ ΟΙ ΦΡΟΥΡΟΙ**: κάθε `route.ts` γράφει **ρητά** `withHeavyRateLimit(withFileCustodyAuth(…))`.
 *   Οι πύλες (CHECK 3.78 · 3.92 · …) διαβάζουν το `route.ts` **στατικά** — ένα εργοστάσιο που έκρυβε τους φρουρούς θα
 *   έκανε τη διαδρομή να φαίνεται «αδήλωτη» ενώ προστατεύεται, δηλαδή θα τύφλωνε την πύλη.
 * 🔒 **Κάθε άρνηση είναι το ίδιο 404** (όχι μαντείο ύπαρξης) — ίδιο συμβόλαιο με τη `download`.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getErrorMessage } from '@/lib/error-utils';

import { authorityUnavailableResponse, fileNotFoundResponse, type FileSegment } from './container-route-responses';
import type { FileCustodyCaller } from './file-custody-route';
import { loadOwnedFileBytes } from './owned-file-bytes';

/** Ίδια ικανότητα με τη `download`: για να υπολογίσεις κάτι από τα bytes, **βλέπεις** τα bytes. */
export const OWNED_FILE_VIEW_ACTION = 'dxf:files:view';

export interface OwnedFileInsight<T> {
  /** Το όνομα της πράξης στο ίχνος της αλυσίδας (π.χ. `'focal-point'`). */
  readonly action: string;
  /** Η συνάρτηση πάνω στα bytes — αν πετάξει, 500. */
  readonly compute: (bytes: Buffer) => Promise<T>;
  /** Πώς τυλίγεται το αποτέλεσμα στο σώμα της απάντησης — το συμβόλαιο του κάθε καταναλωτή. */
  readonly toBody: (result: T) => Record<string, unknown>;
}

/** Ο χειριστής `GET` — ο καλών τον τυλίγει **ρητά** με όριο ρυθμού και αλυσίδα κατοχής. */
export function ownedFileInsightHandler<T>(insight: OwnedFileInsight<T>) {
  return async function handleGet(
    _request: NextRequest,
    caller: FileCustodyCaller,
    segment?: FileSegment,
  ): Promise<NextResponse> {
    const fileId = segment ? (await segment.params).fileId : undefined;
    if (!fileId) return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });

    try {
      const result = await loadOwnedFileBytes({ fileId, caller, action: insight.action, capability: OWNED_FILE_VIEW_ACTION });
      if (result.outcome === 'unavailable') return authorityUnavailableResponse();
      if (result.outcome === 'refused') return fileNotFoundResponse();
      const body = insight.toBody(await insight.compute(result.buffer));
      return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': 'private, max-age=3600' } });
    } catch (error) {
      return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
  };
}
