'use client';

/**
 * @fileoverview **ΠΟΥ ΔΟΥΛΕΥΩ** — η δήλωση εμβέλειας του επαγγελματία.
 * @related ADR-846 · ADR-772 · components/mandate/AreaCombobox
 * @module components/mandate/CoverageAreaPicker
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΛΙΣΤΑ ΚΑΙ ΟΧΙ ΕΝΑ ΠΕΔΙΟ — Η ΣΧΕΔΙΑΣΗ ΚΑΘΟΡΙΖΕΙ ΤΗΝ ΑΛΗΘΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο μπετατζής της **Θέρμης** δουλεύει και τη **Χαλκιδική**. Με **ένα** πεδίο θα
 * αναγκαζόταν να ανέβει στην **Περιφέρεια Κεντρικής Μακεδονίας** — δηλαδή θα δήλωνε
 * **38 δήμους** για να πει **δύο περιοχές**. 🔴 **Η ίδια η σχεδίαση θα παρήγαγε την
 * υπερδήλωση** που μετά θα καταγγέλλαμε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΚΑΙ ΓΙΑΤΙ ΚΑΝΕΝΑ ΠΛΑΦΟΝ — ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟ GOOGLE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **Google Business Profile** δίνει **20** περιοχές και βάζει από πάνω **ανιχνευτή
 * spam**. Χρειάζεται και τα δύο επειδή η λίστα του είναι **επίπεδη**: χωρίς ιεραρχία,
 * «όλη η Αττική» γράφεται μόνο ως 66 δήμοι.
 *
 * 🔑 Εδώ, όποιος προσθέσει δήμο που ήδη περιέχεται σε δηλωμένη περιφέρεια βλέπει τον
 * δήμο να **απορροφάται** — και **το μαθαίνει** *(`coverageAbsorbed`)*. Η λίστα μένει
 * μικρή **μόνη της**, χωρίς αυθαίρετη οροφή και χωρίς ανιχνευτή.
 *
 * ⚠️ **Η κανονικοποίηση τρέχει ΚΑΙ εδώ ΚΑΙ στον διακομιστή, και δεν είναι διπλότυπο**:
 * είναι η **ίδια** συνάρτηση *(`normalizeCoverageIds`)*, με δύο **διαφορετικούς**
 * σκοπούς — εδώ **ανάδραση** *(ο άνθρωπος βλέπει τι έγινε)*, εκεί **εγγύηση** *(ο
 * πελάτης δεν είναι αξιόπιστος)*. Δεύτερη υλοποίηση θα ήταν το δίδυμο· δεύτερη
 * **κλήση** είναι το πρότυπο «βελτίωση στον πελάτη, κανόνας στον διακομιστή».
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizeCoverageIds } from '@/lib/agency/coverage-match';
import { lineageIdsOf, useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isNationwide, isRadiusCoverage, type DeclaredCoverage } from '@/types/agency-coverage';
import type { GeoPoint } from '@/types/geo/coordinates';

import { AreaCombobox } from './AreaCombobox';
import { CoverageRadiusPicker } from './CoverageRadiusPicker';
import { SHOWCASE_KEYS, SHOWCASE_NS } from './agency-showcase-labels';

interface CoverageAreaPickerProps {
  readonly value: DeclaredCoverage | null;
  readonly onChange: (coverage: DeclaredCoverage | null) => void;
  /** Η δημοσιευμένη έδρα, για τη συντόμευση του κέντρου — δες `CoverageRadiusPicker`. */
  readonly home?: GeoPoint | null;
  readonly disabled?: boolean;
}

/** Οι δύο τρόποι να πει κανείς «πού δουλεύω», όταν δεν λέει «όλη η Ελλάδα». */
type CoverageMode = 'areas' | 'radius';

/** Τι απορροφήθηκε μόλις τώρα — για να το **πει** η οθόνη, όχι να συμβεί σιωπηλά. */
/**
 * 🔴 **ΤΟ `count` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ** *(ζωντανό περπάτημα 2026-09-08)*: με δηλωμένα
 * «ΔΗΜΟΣ ΘΕΡΜΗΣ» **και** «Π.Ε. ΧΑΛΚΙΔΙΚΗΣ», η προσθήκη της «ΠΕΡΙΦΕΡΕΙΑΣ ΚΕΝΤΡΙΚΗΣ
 * ΜΑΚΕΔΟΝΙΑΣ» κατάπιε **δύο** — και το μήνυμα ονόμαζε **ένα** *(`swallowed[0]`)*.
 * Δηλαδή ακριβώς η σιωπή που το σχόλιο του `add` ορκίζεται ότι αποφεύγει, μία γραμμή
 * πιο κάτω.
 *
 * ⚠️ **Γιατί ΠΛΗΘΟΣ και όχι ΛΙΣΤΑ ΟΝΟΜΑΤΩΝ**: μια λίστα απαιτεί συνένωση με στίξη
 * *(εισαγωγικά, «και»)* — δηλαδή **γλώσσα μέσα στον κώδικα**, που ο N.11 απαγορεύει και
 * που σπάει σε κάθε νέα γλώσσα. Το πλήθος μπαίνει σε **ένα** κλειδί ICU με `plural` και
 * είναι το ίδιο ιδίωμα που χρησιμοποιούν οι μεγάλοι *(«3 layers were merged»)*.
 * Ο άνθρωπος βλέπει ούτως ή άλλως **ποια** chips έφυγαν· αυτό που δεν έβλεπε ήταν
 * **πόσα**.
 */
interface Absorption {
  readonly narrow: string;
  readonly wide: string;
  readonly count: number;
}

export function CoverageAreaPicker({
  value,
  onChange,
  home = null,
  disabled = false,
}: CoverageAreaPickerProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { isLoading, findById } = useAdministrativeHierarchy();
  const [absorption, setAbsorption] = React.useState<Absorption | null>(null);
  /**
   * ⚠️ **Η προτίμηση είναι τοπική· η ΔΗΛΩΣΗ αποφασίζει όταν υπάρχει.**
   *
   * 🔴 Ένα σκέτο `useState(αρχική τιμή από το value)` θα ήταν **ακριβώς** το σφάλμα που
   * πληρώθηκε στον `AreaCombobox` *(§8.1)*: η δημοσιευμένη βιτρίνα φτάνει **μετά** το
   * πρώτο render, οπότε ο επαγγελματίας που είχε δηλώσει ακτίνα θα έβλεπε ανοιχτό το
   * **λάθος** χειριστήριο και θα νόμιζε ότι η δήλωσή του χάθηκε.
   */
  const [preferred, setPreferred] = React.useState<CoverageMode>('areas');

  const nationwide = value !== null && isNationwide(value);
  const radius = value !== null && !isNationwide(value) && isRadiusCoverage(value) ? value : null;
  const mode: CoverageMode = radius !== null ? 'radius' : preferred;
  const adminIds =
    value !== null && !isNationwide(value) && !isRadiusCoverage(value) ? value.adminIds : [];

  /**
   * ⚠️ **Η αλλαγή τρόπου ΣΒΗΝΕΙ την προηγούμενη δήλωση** — ίδιος κανόνας με το
   * ξεκλείδωμα του «όλη η Ελλάδα» λίγο πιο κάτω: μια κρυμμένη δήλωση που θα
   * «επέστρεφε» αν ο άνθρωπος άλλαζε ξανά γνώμη είναι κατάσταση που **δεν βλέπει και
   * δεν ζήτησε**. Ξαναδηλώνει ρητά.
   */
  const switchMode = (next: CoverageMode): void => {
    setAbsorption(null);
    setPreferred(next);
    onChange(null);
  };

  const nameOf = React.useCallback(
    (adminId: string): string => findById(adminId)?.name ?? adminId,
    [findById],
  );

  const add = (adminId: string): void => {
    if (adminId === '' || adminIds.includes(adminId)) return;

    const next = normalizeCoverageIds([...adminIds, adminId], lineageIdsOf);
    // 🔑 **Η απορρόφηση ανακοινώνεται.** Αν ο νέος έφυγε, τον κατάπιε πρόγονος· αν
    //    έφυγαν άλλοι, τους κατάπιε ο νέος. Και στις δύο περιπτώσεις ο άνθρωπος
    //    πάτησε κάτι και **κάτι άλλο** συνέβη — σιωπή εδώ διαβάζεται ως σφάλμα.
    if (!next.includes(adminId)) {
      const swallower = adminIds.find((id) => lineageIdsOf(adminId).includes(id));
      // Ο νέος καταπίνεται από **έναν** πρόγονο — το πλήθος είναι εξ ορισμού 1.
      setAbsorption({ narrow: nameOf(adminId), wide: nameOf(swallower ?? adminId), count: 1 });
    } else {
      const swallowed = adminIds.filter((id) => !next.includes(id));
      setAbsorption(
        swallowed.length === 0
          ? null
          : {
              narrow: nameOf(swallowed[0]),
              wide: nameOf(adminId),
              // 🔑 **Πόσα έφυγαν, όχι πόσα χωρούσαν σε μία πρόταση.**
              count: swallowed.length,
            },
      );
    }

    onChange(next.length === 0 ? null : { adminIds: next });
  };

  const remove = (adminId: string): void => {
    setAbsorption(null);
    const next = adminIds.filter((id) => id !== adminId);
    onChange(next.length === 0 ? null : { adminIds: next });
  };

  const toggleNationwide = (checked: boolean): void => {
    setAbsorption(null);
    // ⚠️ Το ξεκλείδωμα **δεν επαναφέρει** την παλιά λίστα: θα ήταν κατάσταση που ο
    //    άνθρωπος δεν βλέπει και δεν ζήτησε. Ξαναδηλώνει ρητά.
    onChange(checked ? { nationwide: true } : null);
  };

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">
        {t(SHOWCASE_KEYS.coverageLabel)}
      </legend>
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.coverageHint)}</p>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={nationwide}
          onCheckedChange={(checked) => toggleNationwide(checked === true)}
          disabled={disabled || isLoading}
        />
        {t(SHOWCASE_KEYS.coverageNationwide)}
      </label>

      {nationwide ? (
        <p className="m-0 text-sm text-muted-foreground">
          {t(SHOWCASE_KEYS.coverageNationwideHint)}
        </p>
      ) : (
        <>
          {/* 🔑 **Ραδιοπλήκτρα, ΟΧΙ δεύτερο checkbox**: οι δύο τρόποι είναι αμοιβαία
              αποκλειόμενοι στον **τύπο** (κλειστή ένωση), και δύο checkbox θα
              επέτρεπαν στην οθόνη να εκφράσει κατάσταση που τα δεδομένα δεν έχουν. */}
          <div role="radiogroup" className="flex flex-col gap-1">
            {(['areas', 'radius'] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="coverage-mode"
                  checked={mode === option}
                  disabled={disabled}
                  onChange={() => switchMode(option)}
                />
                {t(
                  option === 'areas'
                    ? SHOWCASE_KEYS.coverageModeAreas
                    : SHOWCASE_KEYS.coverageModeRadius,
                )}
              </label>
            ))}
          </div>
        </>
      )}

      {!nationwide && mode === 'radius' && (
        <CoverageRadiusPicker
          value={radius}
          home={home}
          onChange={onChange}
          disabled={disabled}
        />
      )}

      {!nationwide && mode === 'areas' && (
        <>
          {adminIds.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {adminIds.map((adminId) => (
                <li key={adminId}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => remove(adminId)}
                    aria-label={t(SHOWCASE_KEYS.coverageRemove, { area: nameOf(adminId) })}
                  >
                    {nameOf(adminId)} ✕
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <AreaCombobox
            value=""
            onValueChange={add}
            placeholder={t(SHOWCASE_KEYS.coverageAddPlaceholder)}
            emptyMessage={t(SHOWCASE_KEYS.coverageSearchEmpty)}
            disabled={disabled}
          />

          {/* ⚠️ **Η απουσία δηλώνεται** — «άγνωστο ≠ κενό». Χωρίς αυτό, ο επαγγελματίας
              που δεν δήλωσε νομίζει ότι απλώς δεν χρειαζόταν. */}
          {adminIds.length === 0 && (
            <p className="m-0 text-sm text-muted-foreground">
              {isLoading ? t(SHOWCASE_KEYS.coverageLoading) : t(SHOWCASE_KEYS.coverageEmpty)}
            </p>
          )}

          {absorption !== null && (
            <p role="status" className="m-0 text-sm text-muted-foreground">
              {t(SHOWCASE_KEYS.coverageAbsorbed, absorption)}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
