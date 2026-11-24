/**
 * @fileoverview **Η διεύθυνση του worker της MapLibre** — το μόνο `new URL(…, import.meta.url)` του συνόρου του χάρτη.
 * @related lib/maps/maplibre.ts · ADR-920 §14.12 (αναβάθμιση σε 6.x) · CHECK 3.75
 * @module lib/maps/maplibre-worker-url
 *
 * 🔑 **Γιατί υπάρχει (MapLibre 6):** η 6.x βγαίνει **μόνο** ως ES modules και ο worker είναι **χωριστό αρχείο**
 * (`dist/maplibre-gl-worker.mjs`). Από CDN η βιβλιοθήκη τον βρίσκει μόνη της από το `import.meta.url` της· μέσα σε
 * bundler **όχι** — η επίσημη οδηγία (Installation → webpack 5+ / Next.js) ζητά **μία** κλήση `setWorkerUrl()` με
 * ακριβώς αυτή την έκφραση. Ο bundler τη βλέπει, εκπέμπει τον worker ως δικό του αρχείο με hash, και επιστρέφει τη
 * διεύθυνσή του — ίδια προέλευση, άρα χωρίς `blob:` στο `worker-src`.
 *
 * 🔑 **Γιατί χωριστό αρχείο:** ίδιο σχήμα με τα `*-worker-spawn.ts` — το `import.meta.url` μένει σε **ένα** φύλλο που
 * ένα test αντικαθιστά χωρίς bundler, και το σύνορο δεν το κουβαλά.
 *
 * ⚠️ Το όρισμα είναι **διαδρομή αρχείου**, όχι εισαγωγή: δεν φέρνει τιμή της `maplibre-gl` στον περιηγητή.
 */

/** Η διεύθυνση του αρχείου worker, όπως το εξέπεμψε ο bundler. */
export function maplibreWorkerUrl(): string {
  return new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString();
}
