/**
 * @fileoverview Το μανιφέστο διατήρησης — `.next/static/.retention.json`.
 * @related ADR-860 §Ε1
 *
 * Ζει **μέσα** στον φάκελο που περιγράφει: ταξιδεύει με την εικόνα Docker, άρα το επόμενο
 * deploy το βρίσκει στην προηγούμενη εικόνα χωρίς καμία εξωτερική αποθήκη.
 *
 * 🔑 **ΔΕΝ σερβίρεται — μετρημένο στην παραγωγή 2026-09-14**: `GET /_next/static/.retention.json`
 * → `400`. Ο static server του Next αρνείται αρχεία που αρχίζουν με τελεία. Κανείς δεν το
 * χρειάζεται μέσω HTTP (το διαβάζει μόνο το επόμενο deploy από την εικόνα), άρα αυτό είναι το
 * σωστό. Η επαλήθευση γίνεται από τη γραμμή `ADR-860 §Ε1 — μεταφέρθηκαν …` στο log του Actions.
 * Ούτως ή άλλως περιέχει **μόνο** git SHA, ημερομηνίες και ονόματα hashed αρχείων.
 *
 * 🔑 **Ανεκτικό στην ανάγνωση, αυστηρό στο σχήμα**: λείπει ή είναι χαλασμένο ⇒ «κανένα γνωστό
 * deployment» + προειδοποίηση. Ποτέ σφάλμα: το μανιφέστο είναι δίχτυ ασφαλείας, όχι προϋπόθεση
 * για να βγει το deploy.
 */

'use strict';

const MANIFEST_FILE = '.retention.json';
const MANIFEST_VERSION = 1;

function isDeploymentRecord(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.deployedAt === 'string' &&
    !Number.isNaN(Date.parse(value.deployedAt)) &&
    Array.isArray(value.files) &&
    value.files.every((f) => typeof f === 'string')
  );
}

/**
 * @param {string | null} text — το περιεχόμενο, ή `null` αν το αρχείο δεν υπάρχει.
 * @returns {{ deployments: Array<{id: string, deployedAt: string, files: string[]}>, warning: string | null }}
 */
function parseManifest(text) {
  if (text === null) return { deployments: [], warning: null };
  try {
    const parsed = JSON.parse(text);
    if (parsed?.version !== MANIFEST_VERSION || !Array.isArray(parsed.deployments)) {
      return { deployments: [], warning: `άγνωστο σχήμα μανιφέστου (version=${parsed?.version})` };
    }
    const valid = parsed.deployments.filter(isDeploymentRecord);
    const dropped = parsed.deployments.length - valid.length;
    return { deployments: valid, warning: dropped > 0 ? `${dropped} άκυρες εγγραφές αγνοήθηκαν` : null };
  } catch (error) {
    return { deployments: [], warning: `μη αναγνώσιμο μανιφέστο: ${error.message}` };
  }
}

function serializeManifest(deployments) {
  return `${JSON.stringify({ version: MANIFEST_VERSION, deployments }, null, 2)}\n`;
}

module.exports = { MANIFEST_FILE, MANIFEST_VERSION, parseManifest, serializeManifest };
