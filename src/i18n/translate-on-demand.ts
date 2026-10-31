/**
 * =============================================================================
 * ADR-280 §11.8 Β3 — ΜΕΤΑΦΡΑΣΗ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΓΕΓΟΝΟΤΟΣ, ΟΧΙ ΤΗ ΣΤΙΓΜΗ ΤΟΥ MOUNT
 * =============================================================================
 *
 * «Ένα κείμενο που εμφανίζεται **μόνο** μετά από ασύγχρονη πράξη (ειδοποίηση, toast) —
 * πρέπει να πληρώνει η οθόνη το namespace του από το πρώτο καρέ;»
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ (ADR-280 §11.7):** το `useDxfImportNotifications` δήλωνε
 * `useTranslation(['dxf-viewer'])` για **έναν** τίτλο ειδοποίησης. Ο hook επεκτείνει τον
 * γονέα σε **όλα** τα compat splits ⇒ κάθε οθόνη με καρτέλα αρχείων (Επαφές, Κτίρια, Έργα,
 * Ακίνητα…) ζητούσε **594,5 KB** για ένα μήνυμα που ίσως δεν εμφανιστεί ποτέ.
 *
 * 🔑 Εδώ το namespace **διαβάζεται από το ίδιο το κλειδί** (`ns:key`, μέσω του SSoT
 * `getExplicitNamespace`) και φορτώνεται **μόνο** αυτό — χωρίς compat splits — τη στιγμή που
 * το κείμενο χρειάζεται. Η μετάφραση περνά από το καθολικό `i18n.t` (ADR-798 §13: η δίπορτη
 * αναζήτηση του compat ισχύει και εδώ).
 *
 * ⚠️ **ΜΟΝΟ για κείμενο που ΔΕΝ ζωγραφίζεται στο πρώτο καρέ.** Για ό,τι αποδίδεται, ο δρόμος
 * είναι το `useTranslation` + η αναμονή της διαδρομής (`awaitedNamespaces`). Κλειδί χωρίς ρητό
 * namespace ⇒ καμία φόρτωση (δεν μαντεύουμε). Το `loadNamespace` **δεν απορρίπτει ποτέ**: σε
 * αποτυχία το i18next επιστρέφει το κλειδί — ορατή αστοχία, ποτέ σιωπηλή.
 *
 * @module i18n/translate-on-demand
 */

import i18n, { type TOptions } from 'i18next';
import { loadNamespace, isSupportedNamespace } from './lazy-config';
import { getExplicitNamespace } from './namespace-compat';

export async function translateOnDemand(key: string, options?: TOptions): Promise<string> {
  const { namespace } = getExplicitNamespace(key);
  if (namespace !== null && isSupportedNamespace(namespace)) await loadNamespace(namespace);
  return i18n.t(key, options ?? {});
}
