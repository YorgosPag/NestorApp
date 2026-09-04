'use client';

/**
 * **Ο ΔΙΑΚΟΠΤΗΣ ΤΗΣ ΡΙΖΑΣ** — «μία είσοδος, τέσσερα κουμπιά» (ADR-841 §7 Α4).
 *
 * @related ADR-841 §7 Α4 · Α5 · §4 (έρευνα 9 πλατφορμών) · §4.2 (το αντι-παράδειγμα)
 *          · ADR-777 §8.10 · §8.49 · lib/landing/landing-modes
 * @module components/search/LandingModeSwitch
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΡΗΤΟΣ ΔΙΑΚΟΠΤΗΣ — ΚΑΙ ΤΟ «ΕΞΥΠΝΟΤΕΡΟ» ΕΧΕΙ ΗΔΗ ΔΟΚΙΜΑΣΤΕΙ ΚΑΙ ΑΝΑΙΡΕΘΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Airbnb** αντικατέστησε τον ρητό διακόπτη με «έξυπνες» Categories το 2022 και
 * **τις κατάργησε τον Σεπτέμβριο 2025**: hosts κατέγραψαν λιγότερες κρατήσεις, χρήστες
 * ζήτησαν δημόσια επιστροφή, η δομή γύρισε σε **σκέτα tabs** *(ADR-841 §4.2)*. Τρία
 * χρόνια δεδομένων από τον μεγαλύτερο παίκτη. **Μην το ξαναδοκιμάσεις εδώ.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ **Radix Tabs** ΚΑΙ ΟΧΙ ΧΕΙΡΟΓΡΑΦΑ ΚΟΥΜΠΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το μοτίβο **tablist** του WAI-ARIA δεν είναι `role="tab"` σε μερικά `<button>`:
 * απαιτεί **βέλη** για μετακίνηση, `Home`/`End`, **έναν** διακόπτη στη σειρά tab
 * *(roving tabindex)*, και σωστό `aria-controls` προς το πάνελ. Μια χειρόγραφη εκδοχή
 * θα ήταν **έβδομο** ημιτελές tablist στο δέντρο — ο κανόνας N.0.2. Το
 * `@/components/ui/tabs` τα δίνει όλα, και **το χρησιμοποιεί ήδη η εφαρμογή**.
 *
 * ⚠️ **ΤΟ ΠΑΝΕΛ ΔΕΝ ΖΕΙ ΕΔΩ.** Αυτό το αρχείο αποδίδει **μόνο** τη σειρά των κουμπιών·
 * η φόρμα ζει στη σελίδα. Είναι ο ίδιος διαχωρισμός με το `priority` της κάρτας: το
 * *ποια* λειτουργία είναι ενεργή είναι γνώση **της σελίδας**, όχι του διακόπτη.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { landingSwitchIsVisible, type LandingMode } from '@/lib/landing/landing-modes';

/**
 * **Κλειδί i18n ανά λειτουργία** — `Record` πάνω στο union, ποτέ συνάρτηση με `switch`.
 *
 * 🔑 Ο τύπος **απαιτεί** και τα τέσσερα: μια νέα λειτουργία στο `LANDING_MODES` **δεν
 * μεταγλωττίζεται** μέχρι να αποκτήσει όνομα. Ένα `switch` με `default` θα την άφηνε να
 * περάσει σιωπηλά με ωμό κλειδί στην οθόνη *(το σχήμα της CHECK 3.51)*.
 *
 * ⚠️ **«Επαγγελματίες», ΟΧΙ «Μαστόροι»** *(απόφαση Giorgio 2026-09-04)*. Η Α4 είχε
 * καταγράψει τη λαϊκή ονομασία· απορρίφθηκε — και η αντικατάσταση **δεν επιλέχθηκε με
 * γούστο**: είναι ο **τίτλος της ίδιας της σελίδας στην οποία οδηγεί το κουμπί**
 * *(`property-market:mandate.directory.title` = «Επαγγελματίες» / «Professionals»)*.
 * Κουμπί και προορισμός που λένε **διαφορετικό όνομα** είναι δύο ονόματα για ένα
 * πράγμα, και ο επισκέπτης δεν μπορεί να ξέρει ότι έφτασε εκεί που πήγαινε.
 * *(Το xe.gr χρησιμοποιεί την ίδια λέξη στην ίδια θέση.)*
 */
const MODE_LABEL_KEYS: Record<LandingMode, string> = {
  buy: 'search-results:landing.modes.buy',
  rent: 'search-results:landing.modes.rent',
  stay: 'search-results:landing.modes.stay',
  pros: 'search-results:landing.modes.pros',
};

interface LandingModeSwitchProps {
  /** **Μόνο** όσες μπορούν να τηρήσουν την υπόσχεσή τους — δες `availableLandingModes`. */
  readonly modes: readonly LandingMode[];
  readonly value: LandingMode;
  readonly onChange: (mode: LandingMode) => void;
}

/**
 * ⚠️ **ΣΙΩΠΑ ΜΕ ΜΙΑ ΜΟΝΟ ΛΕΙΤΟΥΡΓΙΑ.** Ένας διακόπτης με ένα κουμπί δεν είναι επιλογή —
 * είναι **ετικέτα που μοιάζει με επιλογή**, και ο επισκέπτης θα πατούσε περιμένοντας
 * αλλαγή. Η οθόνη τότε δείχνει απλώς τη φόρμα, όπως πριν την Α4.
 *
 * 🔴 **ΤΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΖΕΙ ΠΙΑ ΕΔΩ** *(Α4.3)*: το ρωτά και η **σελίδα**, για να ξέρει
 * αν επιτρέπεται να φιλτράρει τη βιτρίνα. Δύο `length < 2` σε δύο αρχεία θα ήταν δύο
 * απαντήσεις στο *«έχει ο άνθρωπος χειριστήριο;»* — δες {@link landingSwitchIsVisible}.
 */
export function LandingModeSwitch({ modes, value, onChange }: LandingModeSwitchProps) {
  const { t } = useTranslation(['search-results']);

  if (!landingSwitchIsVisible(modes)) return null;

  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as LandingMode)}>
      <TabsList aria-label={t('search-results:landing.modes.label')}>
        {modes.map((mode) => (
          <TabsTrigger key={mode} value={mode}>
            {t(MODE_LABEL_KEYS[mode])}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
