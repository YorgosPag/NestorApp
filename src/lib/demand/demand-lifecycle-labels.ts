/**
 * @fileoverview **ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΚΑΤΑΣΤΑΣΕΩΝ ΜΙΑΣ ΖΗΤΗΣΗΣ** — ένας πίνακας, όχι παρεμβολή.
 * @related ADR-886 · lib/demand/seek-kind-labels.ts (το ίδιο πρότυπο) · CHECK 3.8 · CHECK 3.34
 * @module lib/demand/demand-lifecycle-labels
 *
 * 🔴 **ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ `t(\`…lifecycle.${x}\`)`** — μετρημένο (2026-09-25): όταν το σήμα κατάστασης
 * μετακόμισε από την κάρτα στο `DemandSeekBadges`, η δυναμική παρεμβολή **έπαψε να επιλύεται** από τον
 * γεννήτορα των route slices ⇒ τα κλειδιά `demand.lifecycle.*` βγήκαν σιωπηλά από το slice της `/demands`,
 * δηλαδή **ωμό κλειδί στο πρώτο καρέ** (CHECK 3.51). Και η CHECK 3.8 δεν βλέπει ποτέ δυναμικό κλειδί. Ένας
 * πίνακας-σταθερά λύνεται **και** από τις δύο πύλες.
 *
 * ⚠️ `Record<DemandLifecycle, string>` ⇒ νέα κατάσταση **δεν μεταγλωττίζεται** χωρίς όνομα.
 */

import type { DemandLifecycle } from '@/types/property-demand';

/** Κατάσταση → κλειδί i18n. **Σταθερά module** — δες την κεφαλίδα. */
export const DEMAND_LIFECYCLE_I18N_KEYS: Readonly<Record<DemandLifecycle, string>> = {
  active: 'property-market:demand.lifecycle.active',
  paused: 'property-market:demand.lifecycle.paused',
  fulfilled: 'property-market:demand.lifecycle.fulfilled',
  withdrawn: 'property-market:demand.lifecycle.withdrawn',
};
