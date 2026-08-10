'use client';

/**
 * 🔴 ADR-739 §67 — **«κλείσε το μενού, εκτέλεσε, ξαναρώτα την κατάσταση»**: ο ΕΝΑΣ δρόμος
 * εκτέλεσης εντολής σε αγκυρωμένο μενού που **επιβιώνει** της εντολής του.
 *
 * ## Γιατί εξήχθη (CHECK 3.28, μετρημένο 2026-08-10)
 * Το `runOnRange` του {@link TableRangeContextMenu} και το `runOnText` του νέου μενού κειμένου
 * ήταν **το ίδιο σώμα** με άλλον τύπο στόχου — 26 γραμμές / 61 tokens, πιασμένα από το jscpd
 * **μέσα στο ίδιο commit**. Δεν είναι θέμα γραμμών: είναι **δύο ευκαιρίες** να μάθει κάποιο από
 * τα δύο διαφορετικό κανόνα για τη σειρά «κλείσιμο → εκτέλεση → ανανέωση», και η απόκλιση θα
 * ήταν αόρατη όσο κάθε πλευρά δουλεύει.
 *
 * ## 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΠΡΟΔΙΑΓΡΑΦΗ, ΚΑΙ ΓΙ' ΑΥΤΟ ΖΕΙ ΣΕ ΕΝΑ ΣΗΜΕΙΟ
 *
 *  1. **Κλείσιμο πρώτα.** Μια εντολή μπορεί να ανοίξει διάλογο (συγχώνευση που ρωτά·
 *     «Μορφοποίηση κελιών…»). Με το `role="menu"` ζωντανό, το `FocusScope` του Radix επαναφέρει
 *     **κάθε** εστίαση σε αυτό — δηλαδή ο χρήστης βλέπει πεδία που δεν συμπληρώνονται με
 *     πληκτρολόγιο.
 *  2. **Ο στόχος παγώνει πριν.** Η εντολή εκτελείται πάνω σε ό,τι είδε ο χρήστης όταν άνοιξε το
 *     μενού, ποτέ πάνω σε ό,τι τυχαίνει να ισχύει μετά το κλείσιμο.
 *  3. **Ανανέωση με updater και έλεγχο `prev`.** Η γραμμή εργαλείων επιβιώνει του μενού και
 *     οφείλει να δείξει «Β» πατημένο — αλλά μπορεί να έχει φύγει (`Escape`) όσο έτρεχε η
 *     ασύγχρονη πράξη. Χωρίς τον έλεγχο, η ανανέωση θα **ξαναγεννούσε** επιφάνεια που ο χρήστης
 *     έκλεισε.
 *
 * ⚠️ Ο **τύπος** του στόχου μένει γενικός (`T`): η γνώση «τι είναι στόχος» ανήκει σε κάθε μενού
 * χωριστά (όρια κελιών · μαρκαρισμένα γράμματα), και μια ένωση εδώ θα ανάγκαζε αυτό το module
 * να μάθει και τα δύο. Κοινός είναι μόνο ο **μηχανισμός**, ακριβώς όπως και στο
 * {@link useAnchoredContextMenu} δίπλα του.
 *
 * @module subapps/dxf-viewer/ui/components/dxf-context-menu/use-run-menu-command
 * @see ui/components/dxf-context-menu/use-anchored-context-menu.ts — ο κύκλος ζωής
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';

export interface RunMenuCommandParams<T> {
  /** Ο στόχος **αυτή τη στιγμή**· `null` ⇒ καμία εντολή δεν εκτελείται. */
  readonly target: T | null;
  /** Φεύγει μόνο το μενού· ο στόχος (άρα και η γραμμή εργαλείων) μένει ζωντανός. */
  readonly closeMenuKeepTarget: () => void;
  readonly setTarget: Dispatch<SetStateAction<T | null>>;
  /** Ξαναρωτά την κατάσταση για τον **ίδιο** στόχο· `null` ⇒ ο στόχος δεν επιβίωσε. */
  readonly refresh: (target: T) => T | null;
}

/**
 * Ο τυλιχτής που φορούν **όλες** οι εντολές ενός τέτοιου μενού.
 *
 * @returns συνάρτηση που δέχεται την πράξη· ασύγχρονη πράξη υποστηρίζεται (η ανανέωση περιμένει).
 */
export function useRunMenuCommand<T>(
  params: RunMenuCommandParams<T>,
): (action: (target: T) => void | Promise<void>) => void {
  const { target, closeMenuKeepTarget, setTarget, refresh } = params;

  return useCallback(
    (action: (target: T) => void | Promise<void>) => {
      if (!target) return;
      const frozen = target;
      closeMenuKeepTarget();
      void Promise.resolve(action(frozen)).then(() => {
        setTarget((prev) => (prev ? refresh(prev) ?? prev : prev));
      });
    },
    [target, closeMenuKeepTarget, setTarget, refresh],
  );
}
