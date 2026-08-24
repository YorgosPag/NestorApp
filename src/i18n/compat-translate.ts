/**
 * =============================================================================
 * 🏢 ΤΟ COMPAT REMAP ΩΣ **ΔΕΥΤΕΡΗ ΠΟΡΤΑ** — SSoT (ADR-798 §13)
 * =============================================================================
 *
 * Το `config.ts` αντικαθιστά **καθολικά** το `i18n.t` με τον τυλιγμένο μεταφραστή
 * που φτιάχνει η {@link createCompatibleTranslate}. Δεν είναι τοπική ευκολία: το
 * `getFixedT` του i18next τελειώνει σε `return this.t(resultKey, o)`
 * (`i18next/dist/cjs/i18next.js:2034`), οπότε **κάθε** `t` του react-i18next —
 * άρα ολόκληρη η εφαρμογή — περνά από εδώ.
 *
 * ## Το ελάττωμα που έλυσε: χάρτης ΡΙΖΑΣ πάνω σε διαχωρισμό ΚΛΕΙΔΙΟΥ
 *
 * Μέχρι τις 2026-08-24 ο μεταφραστής έκανε remap **άνευ όρων** και ρωτούσε
 * **μόνο** τον στόχο. Ο `LEGACY_NAMESPACE_ROOT_MAP` όμως δηλώνει μετακομίσεις σε
 * επίπεδο **ρίζας** (`contacts.esco → contacts-relationships`), ενώ ο πραγματικός
 * διαχωρισμός έγινε σε επίπεδο **κλειδιού**: τα `esco.searchResults`/`noResults`/
 * `useFreeText` όντως έφυγαν, το `esco.badge` **έμεινε πίσω**. Μια εγγραφή ρίζας
 * δεν μπορεί να πει «μερικά ναι, μερικά όχι» ⇒ το ερώτημα πήγαινε σε namespace
 * που **δεν έχει** το κλειδί, και το μόνο ερώτημα που θα απαντούσε — το αρχικό —
 * ήταν **δομικά αδύνατο να τεθεί**.
 *
 * **Μετρημένο με δύο ανεξάρτητα όργανα που συμφώνησαν** (στατική απογραφή των
 * locale JSON · εκτέλεση της **πραγματικής** μηχανής σε ζωντανό στιγμιότυπο):
 * **172 κλειδιά ανά γλώσσα** υπήρχαν και ήταν απρόσιτα· **135** από αυτά
 * καλούνται όντως από τον κώδικα.
 *
 * ## Γιατί ΑΥΤΗ η σειρά
 *
 * ⚠️ **ΜΗΝ το γυρίσεις σε «αρχικό πρώτα, remap ως εφεδρεία»**. Δοκιμάστηκε και
 * απορρίφθηκε **με μέτρηση**: **404** κλειδιά υπάρχουν **και στα δύο** σημεία,
 * **149** με **διαφορετική τιμή**, και σε κάθε δείγμα ο **στόχος** κρατά τη
 * νεότερη γραφή. Η αντιστροφή θα άλλαζε σιωπηλά 149 ορατά κείμενα.
 *
 * Άρα ο στόχος **διατηρεί την προτεραιότητά του** και το αρχικό ρωτιέται **μόνο**
 * σε αστοχία ⇒ **αυστηρά προσθετικό εκ κατασκευής**: δεν μπορεί να αλλάξει καμία
 * συμβολοσειρά που επιλύεται σήμερα, μόνο να μετατρέψει ωμό κλειδί σε μετάφραση.
 *
 * @module i18n/compat-translate
 */

import { remapLegacyTranslationKey } from './namespace-compat';
import { isUnresolvedTranslation } from './unresolved-key';

/**
 * Ο ωμός μεταφραστής του i18next, χωρίς τύπους — ο μόνος τρόπος να τυλιχθεί η
 * υπερφορτωμένη υπογραφή του `t` χωρίς `any` (N.2).
 */
export type TranslateAdapter = (...args: readonly unknown[]) => unknown;

/**
 * Τυλίγει τον ωμό μεταφραστή με τη **δίπορτη** αναζήτηση του ADR-798 §13.
 *
 * @param translate ο **ανέπαφος** `translator.translate` — ποτέ το ήδη
 *   τυλιγμένο `i18n.t`, αλλιώς η δεύτερη πόρτα θα ξαναέκανε remap αναδρομικά.
 */
export function createCompatibleTranslate(translate: TranslateAdapter): TranslateAdapter {
  return (...args: readonly unknown[]) => {
    const [key, arg2, arg3] = args;

    // Κλειδί που δεν είναι συμβολοσειρά (πίνακας κλειδιών, selector) δεν έχει
    // «ρίζα» για να χαρτογραφηθεί — περνά ανέπαφο.
    if (typeof key !== 'string') {
      return arg3 === undefined ? translate(key, arg2) : translate(key, arg2, arg3);
    }

    const remapped = remapLegacyTranslationKey(key, arg2);
    const viaCompat = arg3 === undefined
      ? translate(remapped.key, remapped.options)
      : translate(remapped.key, remapped.options, arg3);

    // Κανένα remap δεν εφαρμόστηκε ⇒ το `viaCompat` **ΕΙΝΑΙ** ήδη το αρχικό
    // ερώτημα. Δεύτερη αναζήτηση θα ήταν κυριολεκτικά η ίδια κλήση.
    if (remapped.key === key) return viaCompat;

    if (!isUnresolvedTranslation(viaCompat, remapped.key)) return viaCompat;

    // Η πόρτα που έλειπε: το κλειδί μπορεί να **έμεινε πίσω** στο αρχικό namespace.
    const viaOriginal = arg3 === undefined
      ? translate(key, arg2)
      : translate(key, arg2, arg3);
    if (!isUnresolvedTranslation(viaOriginal, key)) return viaOriginal;

    // Ούτε εκεί. Επιστρέφεται ό,τι θα επέστρεφε και πριν — **ίδια σημασιολογία
    // αστοχίας**, ίδιο ίχνος για όποιον διαγιγνώσκει.
    return viaCompat;
  };
}
