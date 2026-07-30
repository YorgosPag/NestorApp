/**
 * SHA-256 (σύγχρονο, Node) — τοπικό primitive του VQE
 *
 * @server-only Χρησιμοποιεί το Node.js `crypto`. ΜΗΝ το εισάγεις σε client
 * bundle. Το στρώμα δυνατοτήτων πράκτορα (MCP / REST adapters, ADR-734 §5.1)
 * εκτελείται εξ ολοκλήρου server-side, όπως και ο Revit Public MCP Server.
 *
 * ⚠️ SSoT: ΔΕΝ υπάρχει σήμερα κοινό `sha256` util στο repo. Υπάρχουν ~10
 * ανεξάρτητα σημεία και **εκκρεμεί** ήδη ratchet για global *ασύγχρονο*
 * `sha256Hex(bytes)` σε `src/lib/hash/` (browser, `crypto.subtle`, βλ.
 * `.claude-rules/pending-ratchet-work.md`). Αυτό εδώ είναι το **σύγχρονο,
 * Node** αντίστοιχο: διαφορετική υπογραφή, διαφορετικό περιβάλλον, μη
 * συγχωνεύσιμο με το ασύγχρονο. Ο λόγος που πρέπει να είναι σύγχρονο:
 * το `buildEnvelope()` είναι **pure function** — ένα `Promise` θα το μόλυνε
 * και θα ανάγκαζε κάθε καλούντα σε `await` για έναν καθαρά CPU υπολογισμό.
 * Όταν φτιαχτεί το global SSoT, αυτό το αρχείο καταναλώνει από εκεί.
 *
 * @module services/agent-capability/vqe/hashing
 * @see ADR-734 §6.2 (IntegrityRecord)
 */

import { createHash } from 'crypto';

/** SHA-256 μιας συμβολοσειράς σε πεζό hex (64 χαρακτήρες). */
export function sha256HexSync(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
