/**
 * @fileoverview **Πού ζει η τοπική βάση GeoIP** — μία φορά, για τον γραφέα (`scripts/fetch-geoip-db.ts`) και τον
 * αναγνώστη (`ip-geolocation.ts`). ADR-894.
 * @module lib/geo/ip-geolocation-paths
 *
 * ⚠️ **Φύλλο χωρίς εισαγωγές από `@/`**: το διαβάζει ο γεννήτορας με `tsx`, όπου το `server-only` του αναγνώστη πετά.
 * Εκτός `public/`, επίτηδες: 130 MB δεν σερβίρονται σε κανέναν.
 */

/** Σχετικά με τη ρίζα του έργου (στο image: `/app`). Μακροπρόθεσμα υπερισχύει το `GEOIP_DB_PATH`. */
export const DEFAULT_GEOIP_DB_RELATIVE_PATH = 'data/geoip/dbip-city-lite.mmdb';
