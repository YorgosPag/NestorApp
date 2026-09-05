/**
 * @fileoverview **ΤΙ ΔΙΑΒΑΖΕΙ Ο ΑΝΘΡΩΠΟΣ ΣΤΗΝ ΚΑΡΤΑ** — καθαρή απόφαση, ελέγξιμη.
 * @related ADR-841 §7 Α18.10 · i18n/unresolved-key (ADR-798 §13) · ADR-716 Φ5
 * @module components/notifications/notification-display-title
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΖΕΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ DRAWER
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ήταν κλειστή συνάρτηση μέσα σε `.map()`, σε αρχείο **474 γραμμών** — δηλαδή σε
 * σημείο όπου **καμία** άγκυρα δεν μπορεί να τη ρωτήσει χωρίς να στήσει ολόκληρο
 * τον drawer. Ίδιο σκεπτικό με το `property-page-state.ts`: *μια απόφαση που
 * μπορεί να είναι **σιωπηλά λάθος** οφείλει να είναι **καλέσιμη**.*
 *
 * Και **ήταν** σιωπηλά λάθος: ο τίτλος που έβλεπε ο άνθρωπος **δεν έβγαινε από το
 * κλειδί** — έβγαινε από το παγωμένο κείμενο της παραγωγής (ADR-841 §7 Α18.10).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΜΗΧΑΝΙΣΜΟΣ, ΜΕΤΡΗΜΕΝΟΣ — ΤΟ `defaultValue` ΔΕΝ ΕΚΡΥΒΕ ΜΟΝΟ, **ΕΜΠΟΔΙΖΕ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η παλιά γραμμή ήταν `t(titleKey, { ...params, defaultValue: n.title ?? '' })`.
 *
 * Το `useTranslation` αυτού του repo κρατά **δίχτυ τελευταίας γραμμής**
 * (`resolveAcrossNamespaces`, ADR-716 Φ5): όταν το κλειδί δεν λύνεται στο
 * **πρωτεύον** namespace, ρωτά ρητά τα υπόλοιπα φορτωμένα. Ο φύλακας εισόδου του
 * είναι το {@link isUnresolvedTranslation} — *«γύρισε το i18next το ίδιο το
 * κλειδί;»*.
 *
 * 🔑 **Με `defaultValue`, το i18next ΔΕΝ γυρίζει ποτέ το κλειδί.** Γυρίζει το
 * `defaultValue`. Άρα ο φύλακας απαντούσε *«λύθηκε»*, η κλήση επέστρεφε αμέσως, και
 * το δίχτυ **δεν έτρεχε ΠΟΤΕ** — για κλειδί που **υπάρχει, σωστό, και στις δύο
 * γλώσσες**.
 *
 * **Μετρημένο σε πραγματικό i18next + πραγματικά locales** (δες τη σουίτα δίπλα):
 * `t(key, {count:1, title:'X'})` → **το κλειδί** · `t(key, {…, defaultValue: F})`
 * → **`F`**.
 *
 * ⇒ Η θεραπεία δεν είναι *«βγάλε την εφεδρεία»* — είναι *«**άλλαξέ της σειρά**»*:
 * ο αποδότης δοκιμάζεται **πρώτος**, η εφεδρεία μένει για όποιο κλειδί όντως
 * αστοχεί.
 *
 * ⚠️ **ΜΗΝ ξαναβάλεις `defaultValue` σε αυτή την κλήση.** Ο κώδικας θα δείχνει
 * σωστός και θα ξανακλείσει το δίχτυ — σιωπηλά, για **επτά** παραγωγούς.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, καμία εξάρτηση από React.
 */

import { isUnresolvedTranslation } from '@/i18n/unresolved-key';

/**
 * Ό,τι χρειάζεται η απόφαση από την ειδοποίηση — **και τίποτα άλλο**.
 *
 * ⚠️ `Pick`-άκι αντί για ολόκληρο το `Notification`: η συνάρτηση δεν επιτρέπεται να
 * αποκτήσει γνώμη για `severity`, `delivery` ή `actions`. Ό,τι δεν βλέπει, δεν
 * μπορεί να το διαβάσει λάθος.
 */
export interface DisplayTitleSource {
  readonly title?: string;
  readonly titleKey?: string;
  readonly titleParams?: Record<string, string>;
}

/**
 * Ο αποδότης, όπως τον δίνει το `useTranslation` — **παράμετρος**, ώστε η απόφαση
 * να δοκιμάζεται χωρίς React.
 */
export type TranslateForTitle = (
  key: string,
  params?: Record<string, string>,
) => string;

/** Το κλειδί της «άγνωστης» αποστολής, ένα σημείο. */
const UNKNOWN_SENDER_KEY = 'notifications.unknownSender';

/** Το κλειδί της κληρονομημένης ευρετικής για εισερχόμενο email. */
const EMAIL_FROM_KEY = 'notifications.email.newFrom';

/**
 * 🔑 **Ο αποστολέας συμπληρώνεται, γιατί το κλειδί τον ζητά και το έγγραφο μπορεί
 * να μην τον έχει.** Η αλυσίδα είναι γραμμένη ώστε να μη μαντεύει: `titleParams` →
 * το ίδιο το αποθηκευμένο κείμενο → ονομασμένο «άγνωστος».
 *
 * ⚠️ **Το `from (.+)$` είναι ΑΓΓΛΙΚΟ και είναι κληρονομιά** — πιάνει μόνο τίτλους
 * που έγραψε ο αγγλόφωνος παραγωγός email. Δεν επεκτείνεται εδώ: μια δεύτερη,
 * ελληνική ευρετική θα ήταν **τρίτη μαντεψιά** δίπλα στις δύο που η **Α18.3** έχει
 * ήδη απορρίψει.
 */
function withSender(
  t: TranslateForTitle,
  params: Record<string, string>,
  storedTitle: string | undefined,
): Record<string, string> {
  if (params.sender) return params;

  const fromMatch = storedTitle?.match(/from (.+)$/i);
  return { ...params, sender: fromMatch ? fromMatch[1] : t(UNKNOWN_SENDER_KEY) };
}

/**
 * **Ο τίτλος που ζωγραφίζεται στην κάρτα.**
 *
 * Η σειρά είναι το συμβόλαιο:
 * 1. Υπάρχει `titleKey` ⇒ **δοκιμάζεται ο αποδότης, χωρίς `defaultValue`**. Μόνο αν
 *    το i18next γυρίσει το ίδιο το κλειδί πέφτουμε στο αποθηκευμένο κείμενο.
 * 2. Δεν υπάρχει `titleKey` ⇒ η κληρονομημένη ευρετική για εισερχόμενο email.
 * 3. Τίποτα από τα δύο ⇒ το αποθηκευμένο κείμενο, ή κενό.
 *
 * 🔴 **Το κενό string ΔΕΝ είναι αποτυχία**: είναι ό,τι έδειχνε και πριν η γραμμή με
 * `defaultValue: n.title ?? ''`. Η αλλαγή προσθέτει αναλύσεις, δεν αφαιρεί καμία.
 */
export function notificationDisplayTitle(
  t: TranslateForTitle,
  notification: DisplayTitleSource,
): string {
  const { title, titleKey, titleParams } = notification;

  if (titleKey) {
    const params = withSender(t, { ...titleParams }, title);
    const rendered = t(titleKey, params);

    // 🔴 Ο έλεγχος ζει στο SSoT (ADR-798 §13) — ποτέ `rendered !== titleKey`: όταν
    //    αστοχεί κλειδί **με πρόθεμα** (`quotes:…`), το i18next γυρίζει το κλειδί
    //    **χωρίς** το πρόθεμα, και η αφελής σύγκριση το κρίνει επιτυχία.
    return isUnresolvedTranslation(rendered, titleKey) ? title ?? '' : rendered;
  }

  if (title) {
    const emailFromMatch = title.match(/^New (?:Email|message) from (.+)$/i);
    if (emailFromMatch) {
      const rendered = t(EMAIL_FROM_KEY, { sender: emailFromMatch[1] });
      return isUnresolvedTranslation(rendered, EMAIL_FROM_KEY) ? title : rendered;
    }
  }

  return title ?? '';
}
