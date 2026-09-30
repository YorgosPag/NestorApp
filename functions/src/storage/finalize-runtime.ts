/**
 * =============================================================================
 * STORAGE FINALIZE RUNTIME — οι επιλογές runtime ανά handler (ADR-895 Α7 · Φ2)
 * =============================================================================
 *
 * Κάθε handler «νέο αντικείμενο στον κάδο» έχει **ένα** σώμα και ένα binding ανά κάδο: gen1 για τον
 * κανονικό (όπως πάντα), gen2 για κάθε περιφερειακό κάδο (`regional-storage-triggers.ts`). Οι επιλογές
 * runtime ζουν **εδώ, μία φορά** — δύο bindings με χωριστά γραμμένη μνήμη/timeout θα απέκλιναν σιωπηλά.
 *
 * **Leaf — μηδέν imports**: το εισάγουν και τα αρχεία των σωμάτων (για το gen1 `runWith`) και το αρχείο
 * των gen2 bindings (που εισάγει τα σώματα)· ένα import εδώ θα έκλεινε κύκλο (CHECK 3.80).
 *
 * 🔴 `concurrency` αφορά **μόνο** το gen2 (το gen1 εξυπηρετεί πάντα ένα γεγονός ανά instance). Η προεπιλογή
 * του gen2 είναι **80** ταυτόχρονα γεγονότα ανά instance (https://firebase.google.com/docs/functions/2nd-gen-upgrade):
 * για τη ραστεροποίηση DXF (resvg, όλη η σκηνή στη μνήμη) αυτό σημαίνει 80 σκηνές σε 512MiB ⇒ OOM. Άρα `1`,
 * ρητά — ίδια σημασιολογία με το gen1. Ο marker ορφανών είναι μικρό I/O ⇒ προεπιλογή.
 *
 * @module functions/storage/finalize-runtime
 */

/** Οι handlers «νέο αντικείμενο» — κλειστό σύνολο· καθένας έχει binding σε **κάθε** κάδο που ακούμε. */
export const FINALIZE_HANDLER_IDS = ['orphanMarker', 'dxfThumbnail'] as const;
export type FinalizeHandlerId = (typeof FINALIZE_HANDLER_IDS)[number];

export interface FinalizeRuntime {
  readonly timeoutSeconds: number;
  readonly memoryMiB: 256 | 512;
  /** Μόνο gen2· απόν ⇒ η προεπιλογή της πλατφόρμας. */
  readonly concurrency?: number;
}

export const FINALIZE_RUNTIME: Readonly<Record<FinalizeHandlerId, FinalizeRuntime>> = {
  orphanMarker: { timeoutSeconds: 60, memoryMiB: 256 },
  dxfThumbnail: { timeoutSeconds: 120, memoryMiB: 512, concurrency: 1 },
};

/** Η ίδια μνήμη στο λεξιλόγιο του gen1 (`runWith`). */
export function gen1Memory(runtime: FinalizeRuntime): '256MB' | '512MB' {
  return runtime.memoryMiB === 256 ? '256MB' : '512MB';
}

/** Η ίδια μνήμη στο λεξιλόγιο του gen2 (`memory`). */
export function gen2Memory(runtime: FinalizeRuntime): '256MiB' | '512MiB' {
  return runtime.memoryMiB === 256 ? '256MiB' : '512MiB';
}
