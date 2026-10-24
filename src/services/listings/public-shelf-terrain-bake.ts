/**
 * @fileoverview ⛰️ **Ο ΨΗΣΤΗΣ ΤΟΥ ΕΔΑΦΟΥΣ** — κανονική πηγή του τοπογράφου → δημοσιεύσιμο στιγμιότυπο (ADR-920 Β3β).
 * @related ADR-920 §10 (builder) · §11 (πηγή) · §12 · ./public-shelf-model-bake (ίδιος ρόλος για GLB)
 * @module services/listings/public-shelf-terrain-bake
 *
 * 🔴 **Ο SERVER ΞΑΝΑΧΤΙΖΕΙ ΤΑ ΠΑΝΤΑ, ΠΟΤΕ Ο BROWSER**: τα bytes που φεύγουν στον κόσμο είναι η έξοδος του **ίδιου**
 * `buildListingTerrainSnapshot` που έτρεξε η πόρτα ως ξηρή εκτέλεση — ποτέ η πηγή (Δ2: «δημοσιεύεται μόνο παράγωγο»).
 * Η ωμή πηγή δεν εμφανίζεται στην έξοδο ούτε ως πεδίο: το στιγμιότυπο είναι σε σχετικό πλαίσιο (Β2).
 *
 * 🔑 **Δύο μορφές των ίδιων bytes**: `json` (η διεύθυνση = sha256 του **περιεχομένου**) και `gzipped` (η μεταφορά).
 * Ο builder είναι ντετερμινιστικός (στρογγύλευση σε εκατοστό, σταθερή σειρά κλειδιών), άρα ίδια πηγή ⇒ ίδιο κλειδί.
 *
 * Καθαρό εκτός από το `zlib` (σύγχρονο, χωρίς I/O).
 */

import { gzipSync } from 'node:zlib';

import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import { parseListingTerrainSource, toListingTerrainInput } from '@/lib/terrain/publication/listing-terrain-source';
import { listingTerrainCardOf, type ListingTerrainCard } from '@/lib/terrain/publication/listing-terrain-card';
import type { ListingTerrainRejection } from '@/lib/terrain/publication/listing-terrain-types';
import type { TerrainSurveyDeclaration } from '@/lib/terrain/publication/terrain-survey-declaration';

/** Ο τύπος του **δημοσιευμένου** στιγμιοτύπου. */
export const PUBLIC_SHELF_TERRAIN_CONTENT_TYPE = 'application/json';

/**
 * Το custom metadata του δημόσιου αντικειμένου που κρατά την **κάρτα** — ώστε σε cache hit το ράφι να μη
 * ξανακατεβάσει ούτε να ξαναψήσει τίποτα. Το διαβάζει **μόνο** ο `readListingTerrainCard`.
 */
export const META_TERRAIN_CARD = 'shelfTerrainCard';

/** Γιατί μια πηγή δεν έγινε στιγμιότυπο — ένα όνομα ανά αιτία, ποτέ σιωπηλή περικοπή. */
export type TerrainBakeFailure = 'malformed-source' | ListingTerrainRejection;

export type TerrainBake =
  | { readonly ok: true; readonly json: Buffer; readonly gzipped: Buffer; readonly card: ListingTerrainCard }
  | { readonly ok: false; readonly failure: TerrainBakeFailure };

function parseJson(raw: Buffer): unknown {
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return undefined;
  }
}

/** **Bytes πηγής + δήλωση Δ2 → στιγμιότυπο + κάρτα**, ή ονομασμένη άρνηση. */
export function bakeListingTerrain(raw: Buffer, declaration: TerrainSurveyDeclaration): TerrainBake {
  const source = parseListingTerrainSource(parseJson(raw));
  if (source === null) return { ok: false, failure: 'malformed-source' };

  const built = buildListingTerrainSnapshot(toListingTerrainInput(source));
  if (!built.ok) return { ok: false, failure: built.reason };

  const json = Buffer.from(JSON.stringify(built.snapshot), 'utf8');
  return { ok: true, json, gzipped: gzipSync(json, { level: 9 }), card: listingTerrainCardOf(built.snapshot, declaration) };
}
