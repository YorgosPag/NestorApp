'use client';

/**
 * **Ζ6 — «σχολείο ≤ 500 μ.»** — απαιτήσεις γειτονιάς, με απόσταση.
 *
 * @related ADR-777 §7 (Α9) · SPEC-777B §12.5 (Ζ6) · types/property-demand.ts
 * @module components/demand/form/DemandProximityField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΚΑΤΑΓΡΑΦΕΤΑΙ ΚΑΤΙ ΠΟΥ ΔΕΝ ΚΡΙΝΕΤΑΙ ΑΚΟΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι αποστάσεις POI **δεν αντλούνται** σήμερα (λείπει το ερώτημα Overpass, §12.5),
 * οπότε η μηχανή απαντά `proximity-unknown` — **κατηγορικό** εμπόδιο, δηλαδή η
 * απαίτηση **αποκλείει** αντί να φιλτράρει.
 *
 * Και παρ' όλα αυτά ρωτάμε, για δύο ανεξάρτητους λόγους:
 *
 * 1. **Το §12.6 λέει ότι η ζήτηση αξίζει και όταν δεν ταιριάζει τίποτα.** Μια
 *    καταγεγραμμένη απαίτηση γειτονιάς είναι **ακριβώς** το είδος δεδομένου που κάνει
 *    τον θερμοχάρτη του **Ε2** να αξίζει: ο εργολάβος μαθαίνει ότι ο κόσμος ζητά
 *    «κοντά σε σχολείο» **πριν** αγοράσει οικόπεδο.
 * 2. **Η οθόνη το λέει.** Η βοήθεια του άξονα δηλώνει ρητά ότι δεν κρίνεται ακόμη —
 *    και η απάντηση του §12.6 το επαναλαμβάνει ονομαστικά (`proximity-unknown` στη
 *    λίστα «τι τις σταμάτησε»). Το ελάττωμα θα ήταν η **σιωπή**, όχι η ερώτηση.
 *
 * ⚠️ **Το ίδιο είδος δεν δηλώνεται δύο φορές** — το invariant `proximity-duplicated`
 * το απαγορεύει, και η οθόνη το κάνει **αδύνατο** αντί να το καταγγείλει: τα ήδη
 * επιλεγμένα είδη φεύγουν από τη λίστα προσθήκης. *Ένα σφάλμα που δεν μπορεί να
 * πληκτρολογηθεί δεν χρειάζεται μήνυμα.*
 */

import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DemandProximityKind } from '@/types/property-demand';
import type { DemandFormValues } from '@/lib/demand/demand-form-values';
import { TRANSIT_STOP_METRES } from '@/lib/demand/demand-life-presets';

const NS = 'search-results';

/** Μία απαίτηση, όπως ζει στη φόρμα. */
type Requirement = { kind: DemandProximityKind; maxMetres: number };

export function DemandProximityField({
  kinds,
  labelOf,
}: {
  kinds: readonly DemandProximityKind[];
  labelOf: (kind: DemandProximityKind) => string;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { control } = useFormContext<DemandFormValues>();
  const K = `${NS}:demand.form.proximity`;

  return (
    <Controller
      name="proximity"
      control={control}
      render={({ field }) => {
        const requirements: readonly Requirement[] = Array.isArray(field.value)
          ? (field.value as Requirement[])
          : [];
        const chosen = new Set(requirements.map((requirement) => requirement.kind));
        const available = kinds.filter((kind) => !chosen.has(kind));

        const replace = (next: readonly Requirement[]): void => field.onChange([...next]);

        return (
          <div className="flex flex-col gap-3">
            {requirements.map((requirement, index) => (
              <div key={requirement.kind} className="flex flex-wrap items-end gap-3">
                <p className="min-w-32 text-sm font-medium text-foreground">
                  {labelOf(requirement.kind)}
                </p>
                <MetresInput
                  label={t(`${K}.distanceLabel`)}
                  value={requirement.maxMetres}
                  onChange={(maxMetres) =>
                    replace(
                      requirements.map((entry, position) =>
                        position === index ? { ...entry, maxMetres } : entry,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    replace(requirements.filter((_, position) => position !== index))
                  }
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
                >
                  {t(`${K}.remove`)}
                </button>
              </div>
            ))}

            {available.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {available.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      // Η προεπιλογή είναι η **ίδια σταθερά** που χρησιμοποιεί το
                      // πλαίσιο ζωής — αλλιώς «κοντά σε στάση» θα σήμαινε άλλη
                      // απόσταση ανάλογα με το ποιο χειριστήριο πάτησε ο άνθρωπος.
                      replace([...requirements, { kind, maxMetres: TRANSIT_STOP_METRES }])
                    }
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                  >
                    + {labelOf(kind)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }}
    />
  );
}

/** Απόσταση σε μέτρα. **Πάντα > 0** — το 0 δεν είναι «δίπλα», είναι «πουθενά». */
function MetresInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (metres: number) => void;
}): React.ReactElement {
  const inputId = React.useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={1}
        step={50}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-32 rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
    </div>
  );
}
