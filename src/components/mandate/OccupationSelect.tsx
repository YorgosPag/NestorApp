'use client';

/**
 * @fileoverview **ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΤΗΣ ΕΙΔΙΚΟΤΗΤΑΣ** — ένα, για δύο οθόνες.
 * @related ADR-841 §7 Α4.5 *(η ανατροπή)* · Α4.4.3 · ΚΑΝΟΝΑΣ Φ · lib/agency/showcase-filter
 * @module components/mandate/OccupationSelect
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ: Η **Α4.1.4** ΕΙΧΕ ΠΡΟΒΛΕΨΕΙ ΣΩΣΤΑ ΤΟΝ ΚΙΝΔΥΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Α4.1.4 απέρριψε το δεύτερο πεδίο της ρίζας γράφοντας: *«θα ήταν **διπλότυπο** του
 * `AgencyDirectoryFilters`»*. Ο Giorgio **ανέτρεψε την απόρριψη** *(Α4.5)* — αλλά ο
 * **κίνδυνος** που εκείνη ονόμασε **δεν αναιρέθηκε**: παραμένει ακριβώς σωστός.
 *
 * ⇒ Η θεραπεία είναι **EXTRACT**, ποτέ αντιγραφή *(N.0.2)*. Το `<Select>` που ζούσε
 * μέσα στο `AgencyDirectoryFilters` **μετακινήθηκε** εδώ και το ζητούν **δύο**:
 *
 * | Ποιος | Πού | Τι ρωτά |
 * |---|---|---|
 * | `AgencyDirectoryFilters` | `/pro` | *«ποιους από αυτούς κρατάω;»* — **φίλτρο** |
 * | `PlaceSearchBox` | η **ρίζα**, tab «Επαγγελματίες» | *«τι ψάχνω;»* — **πρόθεση** |
 *
 * 🔑 **Δύο ερωτήσεις, ΕΝΑ χειριστήριο — και είναι σωστό**, γιατί και οι δύο κόβουν πάνω
 * στον **ίδιο** άξονα *(`ShowcaseFilters.occupation`)*, με τις **ίδιες** επιλογές
 * *(`occupationOptions`)*, στο **ίδιο** λεξιλόγιο *(`DIRECTORY_KEYS`)*. Δύο αντίγραφα θα
 * σήμαιναν ότι η ρίζα μπορεί να προσφέρει ειδικότητα που ο κατάλογος δεν αναγνωρίζει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - ⛔ **Καμία απόφαση**: δεν φιλτράρει, δεν ταξινομεί, δεν χτίζει επιλογές. Το *τι κόβει*
 *   ζει στο `showcase-filter.ts`, όπου η άγκυρα μπορεί να το μεταλλάξει.
 * - ⛔ **Καμία διάταξη**: κανένα πλάτος, κανένα περιθώριο πέρα από το δικό του. Ο
 *   καταναλωτής κατέχει τη σειρά και το κενό — γι' αυτό δεν υπάρχει `className` prop.
 * - ⛔ **Καμία γνώση για το ESCO**. Δες το {@link EscoOccupationPicker}: εκείνο ρωτά *«ποια
 *   είναι **η δική μου** ειδικότητα;»* πάνω στα **2.942** επαγγέλματα του `EscoService`,
 *   και είναι οθόνη **δήλωσης** πίσω από σύνδεση. Εδώ ο επισκέπτης είναι **ανώνυμος** και
 *   ο πληθυσμός είναι **όσοι γράφτηκαν**. Ίδιο κείμενο, **αντίθετη** σωστή συμπεριφορά για
 *   το «υδραυλικός»: εκεί οφείλει να τον βρίσκει, εδώ οφείλει να **μην** τον προσφέρει
 *   *(Α4.4.3 — «δεν έχει γραφτεί ακόμη κανείς»)*.
 */

import React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ALL_OCCUPATIONS, type OccupationOption } from '@/lib/agency/showcase-filter';
import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';

export interface OccupationSelectProps {
  /**
   * ESCO URI, ή `null` = **ΟΛΕΣ**.
   *
   * 🔑 Το sentinel `'all'` **δεν διαρρέει ποτέ** έξω από αυτό το αρχείο — ο καταναλωτής
   * μιλά μόνο σε `string | null`, όπως και το {@link ShowcaseFilters}. Δύο αναπαραστάσεις
   * του «όλα» σε δύο επίπεδα θα ήταν κάτι που κάθε αναγνώστης πρέπει να θυμάται να
   * μεταφράσει.
   */
  readonly value: string | null;
  /**
   * ⚠️ **Παράγονται από τον ΠΛΗΘΥΣΜΟ** *(`occupationOptions`)* — καμία λίστα, πουθενά.
   * Έτσι **καμία επιλογή δεν οδηγεί σε κενό αποτέλεσμα, εξ ορισμού**: Houzz και Thumbtack
   * προσφέρουν υπηρεσίες με **μηδέν** επαγγελματίες στην περιοχή σου.
   */
  readonly options: readonly OccupationOption[];
  /** Η γλώσσα της ετικέτας — από το {@link showcaseLocale}, ποτέ γραμμένη στο χέρι. */
  readonly locale: 'el' | 'en';
  readonly onChange: (occupation: string | null) => void;
}

export function OccupationSelect({
  value,
  options,
  locale,
  onChange,
}: OccupationSelectProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-foreground">
        {t(DIRECTORY_KEYS.occupationFilterLabel)}
      </span>
      <Select
        // 🔴 **Sentinel `'all'`, ΠΟΤΕ `''`** (CHECK 3.48): το Radix δεσμεύει την κενή
        //    συμβολοσειρά — ένα `<SelectItem value="">` πετά σε χρόνο εκτέλεσης και
        //    **ρίχνει ΟΛΟΚΛΗΡΗ την επιφάνεια**.
        value={value ?? ALL_OCCUPATIONS}
        // ⚠️ Η μετάφραση του sentinel γίνεται **εδώ ή στο `parseShowcaseFilters`**, ποτέ
        //    και στα δύο: δύο σημεία μετάφρασης είναι δύο ευκαιρίες να ξεχαστεί.
        onValueChange={(next) => onChange(next === ALL_OCCUPATIONS ? null : next)}
      >
        {/*
          🔴 **ΤΟ ΤΑΒΑΝΙ ΠΛΑΤΟΥΣ ΤΟ ΒΡΗΚΕ ΤΟ ΠΕΡΠΑΤΗΜΑ, ΟΧΙ ΤΟ TEST** *(2026-09-04)*.
          Ήταν σκέτο `min-w-56`. Οι ετικέτες ESCO κουβαλούν **και τα δύο γένη** —
          *«ελαιοχρωματιστής οικοδομών/ελαιοχρωματίστρια οικοδομών»*, **54 χαρακτήρες** —
          και ο πυροδότης μεγάλωσε όσο το κείμενο: στη ρίζα **έσπρωξε το κουμπί
          «Αναζήτηση» σε δεύτερη γραμμή**, τη στιγμή ακριβώς που ο επισκέπτης έπρεπε να
          το πατήσει. Καμία πύλη δεν ρωτά *«χωράει;»*.

          🔑 Το `[&>span]:line-clamp-1` του `SelectTrigger` **ήδη** κόβει τη γραμμή — του
          έλειπε **όριο** για να το κάνει. Το πλήρες κείμενο μένει ορατό στην ανοιχτή
          λίστα: ο πυροδότης είναι **περίληψη**, ο κατάλογος είναι η αλήθεια.
        */}
        <SelectTrigger className="min-w-56 max-w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* 🔑 **Φ2 — η προεπιλογή είναι ΟΛΑ, και είναι γραμμένη πρώτη.** */}
          <SelectItem value={ALL_OCCUPATIONS}>{t(DIRECTORY_KEYS.occupationAll)}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.escoUri} value={option.escoUri}>
              {option.label[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
