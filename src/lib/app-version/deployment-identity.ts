/**
 * @fileoverview **Η ταυτότητα της έκδοσης που τρέχει** — ΜΙΑ πηγή, για server και browser.
 * @related ADR-860 §Ε0
 * @module lib/app-version/deployment-identity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΑΠΑΝΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * «Ο κώδικας που τρέχει **σε αυτή την καρτέλα** είναι η ίδια έκδοση με αυτόν που σερβίρει
 * **τώρα** ο server;» Αν όχι, μια αποτυχία φόρτωσης chunk δεν είναι δίκτυο — είναι
 * **αλλαγή έκδοσης** (deploy skew), και η σωστή απάντηση είναι ανανέωση, όχι επανάληψη.
 *
 * Η τιμή είναι το git SHA του commit που χτίστηκε (`docker-build.yml` →
 * `NEXT_PUBLIC_DEPLOYMENT_ID: ${{ github.sha }}`). Το Next την **ψήνει** στο build και στα δύο
 * bundles (server και client), άρα οι δύο πλευρές της ίδιας εικόνας δίνουν **ταυτόσημη** τιμή
 * — η σύγκριση έχει νόημα μόνο ανάμεσα σε **διαφορετικές** εικόνες.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ ΟΧΙ ΤΟ `deploymentId` ΤΟΥ ΙΔΙΟΥ ΤΟΥ NEXT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `next.config.js` `deploymentId` προσθέτει `?dpl=<id>` σε **κάθε** URL asset. Σε κάθε
 * deploy άλλαζε λοιπόν το URL και των chunks που **δεν** άλλαξαν ⇒ κάθε χρήστης ξανακατέβαζε
 * **όλο** τον κώδικα μετά από κάθε deploy. Στη Vercel το query υπάρχει για να **δρομολογήσει**
 * το αίτημα στην παλιά έκδοση· εδώ τα παλιά assets μένουν στον ίδιο server (ADR-860 §Ε1), άρα
 * η δρομολόγηση δεν χρειάζεται και το κόστος θα ήταν καθαρή απώλεια cache.
 *
 * ⚠️ **Τοπικά / dev / tests η τιμή λείπει** (`null`). Κάθε καταναλωτής πρέπει να το χειρίζεται
 * ως «άγνωστο», **ποτέ** ως «διαφορετικό» — αλλιώς κάθε dev server θα έβλεπε skew παντού.
 *
 * ⚠️ Η ανάγνωση πρέπει να μείνει **κυριολεκτικά** `process.env.NEXT_PUBLIC_DEPLOYMENT_ID`:
 * το Next αντικαθιστά μόνο αυτή τη μορφή κατά το build. Δυναμικό κλειδί (`process.env[x]`)
 * θα έδινε `undefined` στον browser — σιωπηλά.
 */

/** Ποτέ κενό string: είτε πραγματικό SHA είτε `null` («δεν ξέρω»). */
export type DeploymentId = string;

function normalize(raw: string | undefined): DeploymentId | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Η έκδοση **αυτού** του bundle. Ίδια συνάρτηση στον server (route handlers) και στον browser.
 * `null` ⇒ build χωρίς ταυτότητα (τοπικό / dev / test).
 */
export function getDeploymentId(): DeploymentId | null {
  return normalize(process.env.NEXT_PUBLIC_DEPLOYMENT_ID);
}

/** Σύντομη μορφή για ανθρώπους (logs, διαλόγους). Ποτέ για σύγκριση. */
export function formatDeploymentId(id: DeploymentId | null): string | null {
  return id === null ? null : id.slice(0, 7);
}
