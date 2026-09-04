'use client';

/**
 * @fileoverview **ΤΑ ΧΕΙΡΙΣΤΗΡΙΑ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — δύο άξονες, και οι δύο δηλώσεις του ίδιου.
 * @related ADR-841 Φ6-Β5 · ΚΑΝΟΝΑΣ Φ · lib/agency/showcase-filter.ts
 * @module components/mandate/AgencyDirectoryFilters
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΚΑΝΟΝΑΣ Φ — ΦΙΛΤΡΟ ≠ ΚΑΤΑΤΑΞΗ, ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΜΕΤΡΗΣΙΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το φίλτρο απαντά *«τι ψάχνω»* — **ο χρήστης** δηλώνει πρόθεση. Η ταξινόμηση
 * απαντά *«ποιος πρώτος»* — **η πλατφόρμα** δηλώνει προτίμηση. Το σχόλιο του
 * `pro/page.tsx` έλεγε *«ο κατάλογος δεν έχει φίλτρα επίτηδες»* με προκείμενη
 * που αφορούσε **ταξινόμηση**· το συμπέρασμα δεν έπεται.
 *
 * 🔴 **Και το πληρώναμε**: το `agency-directory-order.ts` έχει **ήδη μετρήσει**
 * ότι η αλφαβητική σειρά *«ευνοεί συστηματικά τα ονόματα σε Α/Β… ουδέτερη ως
 * προς εμάς αλλά **όχι ουδέτερη ως προς τα γραφεία**»*. Με μεικτό πληθυσμό, ο
 * κατάλογος **χωρίς** φίλτρο κάνει αυτή τη μεροληψία τον **μόνο** μηχανισμό
 * εύρεσης. Το φίλτρο είναι **θεραπεία**, όχι προσθήκη.
 *
 * ```
 * Φ1 — Ο ΑΞΟΝΑΣ ΕΙΝΑΙ ΔΗΛΩΣΗ ΤΟΥ ΙΔΙΟΥ, ποτέ μέτρηση της πλατφόρμας γι' αυτόν.
 *      ⛔ αγγελίες · χρόνος απόκρισης · βαθμολογία · «πληρότητα προφίλ» ·
 *      ΕΠΑΛΗΘΕΥΣΗ. Το τελευταίο είναι το πιο ύπουλο: άψογη διατύπωση πρόθεσης,
 *      και ΕΞΑΦΑΝΙΖΕΙ τον ελαιοχρωματιστή — κάνει την απουσία μητρώου ΠΟΙΝΗ (Α9.3).
 * Φ2 — Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΟΛΑ», ρητά (sentinel 'all', ⛔ ΠΟΤΕ value="" —
 *      CHECK 3.48: το Radix το δεσμεύει και η επιφάνεια ΠΕΦΤΕΙ ΟΛΟΚΛΗΡΗ).
 * Φ3 — Η ΣΕΙΡΑ ΜΕΣΑ ΣΤΟ ΑΠΟΤΕΛΕΣΜΑ ΔΕΝ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΤΟ ΦΙΛΤΡΟ.
 * Φ4 — Η ΑΦΑΙΡΕΣΗ ΕΙΝΑΙ ΟΡΑΤΗ ΚΑΙ ΑΝΑΣΤΡΕΨΙΜΗ: «7 από 34» + «Καθαρισμός».
 * ```
 *
 * ⛔ **ΚΑΜΙΑ ΑΠΟΦΑΣΗ ΕΔΩ.** Το τι κόβει ζει στο `showcase-filter.ts`, όπου η
 * άγκυρα μπορεί να το μεταλλάξει· εδώ ζει **μόνο** το χειριστήριο. Ένα
 * `.filter()` μέσα σε component είναι απόφαση **χωρίς διεύθυνση**.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import { OccupationSelect } from './OccupationSelect';
import type { OccupationOption, ShowcaseFilters } from '@/lib/agency/showcase-filter';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * Οι ακτίνες που προσφέρονται.
 *
 * ⚠️ **Δεν είναι λεξιλόγιο τομέα** — είναι κλίμακα χειριστηρίου, και γι' αυτό
 * δεν ζητά γραμμή στο `.domain-vocabulary.json`. Η **μονάδα** ζει στο κείμενο
 * (`radiusLabel`), όχι εδώ: ένας αριθμός με κρυμμένη μονάδα είναι το σχήμα που
 * το ADR-716 ονομάζει.
 */
const RADIUS_CHOICES_KM = [2, 5, 10, 25, 50] as const;

export interface AgencyDirectoryFiltersProps {
  readonly filters: ShowcaseFilters;
  readonly options: readonly OccupationOption[];
  readonly locale: 'el' | 'en';
  readonly onChange: (filters: ShowcaseFilters) => void;
  /** `null` όταν **κανένας** άξονας δεν είναι ενεργός — το «Καθαρισμός» κρύβεται. */
  readonly onClear: (() => void) | null;
}

export function AgencyDirectoryFilters({
  filters,
  options,
  locale,
  onChange,
  onClear,
}: AgencyDirectoryFiltersProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  return (
    <section className="flex flex-wrap items-end gap-3">
      {/*
        🔴 **ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΕΦΥΓΕ ΑΠΟ ΕΔΩ (ADR-841 §7 Α4.5)** — και δεν είναι
        αναδιοργάνωση: η **ρίζα** το ζήτησε ως **δεύτερος** αναγνώστης, όταν το tab
        «Επαγγελματίες» απέκτησε πεδίο ειδικότητας. Η **Α4.1.4** είχε προβλέψει σωστά
        ότι ένα δεύτερο `<Select>` θα ήταν **διπλότυπο** αυτού εδώ· ο Giorgio ανέτρεψε
        την απόρριψη του πεδίου, **όχι** την πρόβλεψη του κινδύνου.
        ⇒ **EXTRACT, ποτέ αντιγραφή** *(N.0.2)*. Δες {@link OccupationSelect}.
      */}
      <OccupationSelect
        value={filters.occupation}
        options={options}
        locale={locale}
        onChange={(occupation) => onChange({ ...filters, occupation })}
      />

      {/*
        🔴 **«ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ» — Η ΑΠΟΥΣΙΑ ΔΗΛΩΝΕΤΑΙ** (ADR-841 §7 Α4.4-Γ).
        ────────────────────────────────────────────────────────────────────────
        Ερώτημα Giorgio *(2026-09-04)*: *«όταν αναζητά ελαιοχρωματιστές ή
        **υδραυλικούς**, τι πρέπει να κάνει;»*. Μετρήθηκε στην οθόνη:
        «ελαιοχρωματιστής οικοδομών» **υπάρχει**· «υδραυλικός» **δεν υπάρχει ούτε
        ως λέξη** — κανείς δεν έχει γραφτεί. Ο επισκέπτης δεν το μάθαινε ποτέ:
        **έψαχνε επιλογή που δεν υπήρχε** και συμπέραινε μόνος του ό,τι ήθελε.

        🔑 **Η ΜΗΧΑΝΗ ΔΕΝ ΑΛΛΑΖΕΙ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Οι επιλογές μένουν
        παραγόμενες από τον **πληθυσμό** *(δες το σχόλιο παρακάτω)*: μια λίστα με
        τα **2.942** επαγγέλματα του ESCO θα πρόσφερε **2.900+ επιλογές που δίνουν
        μηδέν** — ακριβώς το ελάττωμα του Houzz, και το §8.10 ανάποδα.

        ⇒ Το κενό δεν ήταν στη λίστα· ήταν ότι **κανείς δεν έλεγε τι περιέχει**. Ο
        τίτλος «Όλες οι ειδικότητες» υπόσχεται **πληρότητα που δεν υπάρχει**.

        ⛔ **ΚΑΙ ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ ΤΟ «ΖΗΤΩ» ΩΣ ΔΙΕΞΟΔΟΣ**, όσο κι αν ταιριάζει το
        σχήμα: το `PropertyDemand` περιγράφει **ακίνητο** *(είδος · τιμή · τ.μ. ·
        υπνοδωμάτια)* — **δεν υπάρχει** ζήτηση επαγγελματία. Σύνδεσμος εκεί θα ήταν
        **ψεύτικη πόρτα**: ο άνθρωπος θα συμπλήρωνε φόρμα για διαμέρισμα νομίζοντας
        ότι ζητά υδραυλικό. Η πρόταση σταματά στην **αλήθεια**.

        ⚠️ **ICU με ΜΟΝΑ άγκιστρα** (CHECK 3.9) — `{count, plural, …}`, ποτέ `{{ }}`.
      */}
      <p className="m-0 basis-full text-sm text-muted-foreground">
        {t(DIRECTORY_KEYS.occupationScopeHint, { count: options.length })}
      </p>

      <RadiusControl filters={filters} onChange={onChange} />

      {/* 🔑 **Φ4 — η αφαίρεση είναι ΜΙΑ ενέργεια.** Φίλτρο που δεν ξεκλειδώνει με
          ένα πάτημα είναι φίλτρο που ο άνθρωπος **δεν** θα δοκιμάσει. */}
      {onClear !== null && (
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          {t(DIRECTORY_KEYS.clearFilters)}
        </Button>
      )}
    </section>
  );
}

/**
 * **Η ακτίνα — και ΜΟΝΟ όταν υπάρχει σημείο.**
 *
 * 🔑 **Ο άξονας του τόπου είναι «σημείο + ακτίνα», ΠΟΤΕ όνομα τόπου** — το
 * γράφει ήδη το `listing-filters.ts:38`: *«ένα φίλτρο “πόλη = Θεσσαλονίκη” θα
 * έπρεπε είτε να ψάξει στον **τίτλο**, είτε να γεννήσει νέο πεδίο»*. Το σημείο
 * έρχεται από τη **διεύθυνση** (`lat`·`lng`), λυμένο από τον υπάρχοντα
 * γεωκωδικοποιητή, και συγκρίνεται **γεωμετρία με γεωμετρία**.
 *
 * ⚠️ Χωρίς σημείο, μια ακτίνα δεν σημαίνει τίποτα: το χειριστήριο **λείπει**
 * και η οθόνη λέει ρητά *«όλη η Ελλάδα»* — σιωπή θα άφηνε τον επισκέπτη να
 * νομίζει ότι φιλτράρει ενώ δεν φιλτράρει.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΑΝΟΙΧΤΟ**: η οθόνη `/pro` δεν έχει ακόμη **δικό της** πεδίο
 * αναζήτησης τόπου. Ο άξονας δουλεύει ολόκληρος από τη διεύθυνση *(parse ·
 * apply · άγκυρες)*· λείπει **μόνο** ο τρόπος να τεθεί το σημείο **εδώ**. Η
 * θεραπεία είναι να δεχτεί προορισμό ο `PlaceSearchBox` — αρχείο που
 * επεξεργάζεται **άλλος πράκτορας** (ADR-842), και ένα δεύτερο κουτί
 * αναζήτησης θα ήταν ο κλώνος που το N.18 ονομάζει.
 */
function RadiusControl({
  filters,
  onChange,
}: {
  readonly filters: ShowcaseFilters;
  readonly onChange: (filters: ShowcaseFilters) => void;
}): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  // 🔑 **Ο ΑΞΟΝΑΣ ΟΝΟΜΑΖΕΤΑΙ ΚΑΙ ΣΤΙΣ ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ.** Χωρίς όνομα, το «όλη η
  //    Ελλάδα» θα ήταν ελεύθερη πρόταση που ο επισκέπτης δεν συνδέει με φίλτρο —
  //    και δεν θα καταλάβαινε ότι **υπάρχει** άξονας τόπου να τεθεί.
  if (filters.near === null) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">{t(DIRECTORY_KEYS.placeFilterLabel)}</span>
        <p className="m-0 text-sm text-muted-foreground">{t(DIRECTORY_KEYS.placeAll)}</p>
      </div>
    );
  }

  const near = filters.near;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-foreground">{t(DIRECTORY_KEYS.radiusLabel)}</span>
      <Select
        value={String(near.radiusKm)}
        onValueChange={(value) =>
          onChange({ ...filters, near: { ...near, radiusKm: Number(value) } })
        }
      >
        <SelectTrigger className="min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RADIUS_CHOICES_KM.map((km) => (
            <SelectItem key={km} value={String(km)}>
              {t(DIRECTORY_KEYS.radiusOption, { km })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
