'use client';

/**
 * **Ζ7 — «η φόρμα μικραίνει όσο δίνεις περισσότερα»** (Α14 §17.2 κανόνας 3).
 *
 * @related ADR-777 §7 (Α14 κανόνας 3 · Α9) · lib/demand/demand-life-presets.ts
 * @module components/demand/form/DemandLifeContextField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΛΑΙΣΙΟ ΖΩΗΣ **ΠΡΟΤΕΙΝΕΙ**· ΔΕΝ ΚΡΙΝΕΙ, ΚΑΙ ΔΕΝ ΓΡΑΦΕΙ ΑΠΟ ΠΑΝΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Απορρίφθηκε ως **πέμπτος άξονας** με γραμμένο επιχείρημα: είναι *«συμπίεση με
 * απώλειες των άλλων τεσσάρων»*, και ως κριτήριο θα γεννούσε **δεύτερη αρχή** που
 * απαντά «ταιριάζει;» — μία ρητή (τα πεδία) και μία υπονοούμενη (η ετικέτα) — που θα
 * διαφωνούσαν *«στην πρώτη οικογένεια που θέλει γκαρσονιέρα»*.
 *
 * Ο επιτρεπτός του ρόλος είναι **αυτός**: γεμίζει **κενά**, ο άνθρωπος **βλέπει τι
 * γέμισε**, και ό,τι μείνει είναι **ρητό** — δηλαδή αποθηκεύεται ως `bedroomsMin: 2`,
 * όχι ως «η οικογένεια εννοεί δύο».
 *
 * ⚠️ **Και δεν σβήνει ποτέ ανθρώπινη τιμή.** Ο άνθρωπος που έγραψε «ως 250.000» και
 * μετά διάλεξε «φοιτητής» **δεν** βλέπει τον προϋπολογισμό του να αλλάζει. Το
 * κλασικό ελάττωμα των «έξυπνων» φορμών είναι ακριβώς αυτό: ο χρήστης χάνει δουλειά
 * που έκανε, και **μαθαίνει να μην αγγίζει τα χειριστήρια**.
 *
 * 🔑 **Η επιβεβαίωση είναι μέρος του συμβολαίου.** Η οθόνη λέει **πόσα** πεδία
 * γέμισαν — και λέει ρητά όταν **δεν γέμισε κανένα** επειδή ο άνθρωπος τα είχε ήδη
 * απαντήσει. Χωρίς αυτό, μια πρόταση που δεν έκανε τίποτα θα ήταν αδιάκριτη από
 * χαλασμένο κουμπί.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DEMAND_LIFE_CONTEXTS, type DemandLifeContext } from '@/types/property-demand';
import { applyLifePreset, type SuggestibleField } from '@/lib/demand/demand-life-presets';
import type { DemandFormValues } from '@/lib/demand/demand-form-values';
import { DemandFieldset } from './demand-field-primitives';

const NS = 'property-market';

/** Τι έγινε στην τελευταία εφαρμογή — `null` = δεν έχει διαλέξει ακόμη. */
type LastApplied = { readonly filled: readonly SuggestibleField[] } | null;

export function DemandLifeContextField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<DemandFormValues>();
  const [applied, setApplied] = React.useState<LastApplied>(null);
  const K = `${NS}:demand.form.lifeContext`;

  const current = form.watch('lifeContext');

  /**
   * ⚠️ **`getValues`, όχι `watch`** — η πρόταση κρίνει τι είναι κενό **τη στιγμή του
   * κλικ**, όχι στην τελευταία απόδοση. Με `watch` η συνάρτηση θα κουβαλούσε
   * στιγμιότυπο που μπορεί να έχει παλιώσει μέσα στο ίδιο καρέ.
   */
  function choose(next: DemandLifeContext | null): void {
    if (next === null) {
      form.setValue('lifeContext', null, { shouldDirty: true });
      setApplied(null);
      return;
    }

    const outcome = applyLifePreset(form.getValues(), next);
    // `reset` με τις νέες τιμές: μία εγγραφή, ένα re-render — αντί για έξι διαδοχικά
    // `setValue` που θα ζωγράφιζαν τη φόρμα να γεμίζει πεδίο-πεδίο.
    form.reset(outcome.values, { keepDefaultValues: true });
    setApplied({ filled: outcome.filled });
  }

  return (
    <DemandFieldset legend={t(`${K}.legend`)} help={t(`${K}.help`)}>
      <div role="radiogroup" className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="radio"
            name="lifeContext"
            checked={current === null}
            onChange={() => choose(null)}
            className="accent-foreground"
          />
          {t(`${K}.none`)}
        </label>

        {DEMAND_LIFE_CONTEXTS.map((context) => (
          <label key={context} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="lifeContext"
              checked={current === context}
              onChange={() => choose(context)}
              className="accent-foreground"
            />
            {t(`${K}.${context}`)}
          </label>
        ))}
      </div>

      {applied !== null && (
        <p className="text-sm text-muted-foreground">
          {applied.filled.length === 0
            ? t(`${K}.filledNone`)
            : t(`${K}.filled`, { count: applied.filled.length })}
        </p>
      )}
    </DemandFieldset>
  );
}
