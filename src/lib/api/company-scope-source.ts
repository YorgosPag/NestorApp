/**
 * @fileoverview **Η ΥΠΟΔΟΧΗ: από πού μαθαίνει η κεφαλίδα HTTP ποια εταιρεία ζητείται.**
 * @related ADR-787 §5.3 ζ · ADR-849 Β1 · `services/firestore/super-admin-active-company`
 * @module lib/api/company-scope-source
 *
 * 🔑 **Πηγή, όχι τιμή.** Ο `enterprise-api-client` κρατούσε **πεδίο** που «έσπρωχνε» ένα
 * effect του React — δεύτερο αντίγραφο της απάντησης, που **έμενε πίσω** από τη διεύθυνση:
 * η οθόνη έλεγε μία εταιρεία, το αίτημα ζητούσε άλλη. Τώρα η κεφαλίδα **ρωτά** τη ΜΙΑ
 * απάντηση (`requestedWorkspace`) τη στιγμή του αιτήματος.
 *
 * ⚠️ **Γιατί υποδοχή και όχι απευθείας εισαγωγή**: το `lib/` δεν εισάγει από το `services/`
 * — ανάποδο στρώμα, που μετρημένα έσπασε τρεις σουίτες (βλ. `services/firestore/auth-context.ts`).
 * Το store **εγγράφεται** εδώ (σωστή κατεύθυνση). Χωρίς εγγραφή ⇒ καμία κεφαλίδα ⇒ ο
 * διακομιστής κρίνει με το claim: **ασφαλής** προεπιλογή, όχι σιωπηλή άδεια.
 *
 * **Layering**: leaf — καμία εξάρτηση.
 */

let source: () => string | null = () => null;

/** Εγγράφει την πηγή — **μία** φορά, από το store του ενεργού χώρου. */
export function registerCompanyScopeSource(next: () => string | null): void {
  source = next;
}

/** Η εταιρεία που ζητείται **τώρα** — `null` ⇒ καμία κεφαλίδα. */
export function requestedCompanyScope(): string | null {
  return source();
}
