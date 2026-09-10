/**
 * @fileoverview **Η τιμή ενός δυναμικού τμήματος διαδρομής, αποκωδικοποιημένη** (ADR-848).
 * @module lib/routes/route-param
 *
 * 🔴 **`decodeURIComponent` ΠΕΤΑ σε χαλασμένη κωδικοποίηση** (`%E0%A4%A` ⇒ `URIError`).
 * Οι σελίδες με εισιτήριο (`mandate/[token]`, `n/[notificationId]`,
 * `email/preferences/[token]`) το έκαναν ωμό — άρα ένας κομμένος σύνδεσμος από
 * πρόγραμμα email που «έσπασε» τη γραμμή γινόταν **500**, όχι «ο σύνδεσμος δεν ισχύει».
 *
 * ⚠️ **Ποτέ δεν πετά**: χαλασμένη τιμή επιστρέφεται **αυτούσια**, και ο καταναλωτής
 * την απορρίπτει με τον δικό του κριτή (υπογραφή token · ιδιοκτησία ειδοποίησης) —
 * εκεί όπου η άρνηση έχει ήδη όνομα και οθόνη.
 */
export function decodeRouteParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
