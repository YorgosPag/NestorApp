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
import { AreaCombobox } from './AreaCombobox';
import { OccupationSelect } from './OccupationSelect';
import {
  isAdministrativeWhere,
  type OccupationOption,
  type ShowcaseFilters,
} from '@/lib/agency/showcase-filter';
import { whereVoiceParams, type ShowcaseWhereVoice } from '@/lib/agency/showcase-where-voice';
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
  /**
   * **Τι έχει να πει η οθόνη για τον άξονα του τόπου** — υπολογισμένο **μία φορά** από
   * τον γονέα *(ADR-846 §9 #12)*.
   *
   * 🔑 **ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Η φωνή χρειάζεται **μέτρηση** — μια
   * σάρωση 7.440 αποτυπωμάτων για το όνομα του τόπου *(`useCircleAnchorName`)* — και τη
   * χρειάζονται **δύο** οθόνες: αυτό το χειριστήριο και το αφαιρούμενο σημάδι δίπλα στα
   * αποτελέσματα. Δύο κλήσεις θα ήταν **δύο απαντήσεις στο ίδιο ερώτημα**, με δυνατότητα
   * να αποκλίνουν σε κάθε μελλοντική αλλαγή. Μία μέτρηση, δύο παρουσιάσεις.
   */
  readonly whereVoice: ShowcaseWhereVoice;
}

export function AgencyDirectoryFilters({
  filters,
  options,
  locale,
  onChange,
  onClear,
  whereVoice,
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

      <WhereControl filters={filters} onChange={onChange} voice={whereVoice} />

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
 * **ΠΟΥ ΨΑΧΝΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ** — ένας άξονας, δύο πηγές *(ADR-846)*.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔄 ΤΙ ΑΝΤΙΚΑΤΕΣΤΗΣΕ, ΚΑΙ ΓΙΑΤΙ Η ΠΑΛΙΑ ΓΡΑΦΗ ΗΤΑΝ ΣΩΣΤΗ ΓΙΑ ΤΟΝ ΚΑΙΡΟ ΤΗΣ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Εδώ έγραφε: *«Ο άξονας του τόπου είναι «σημείο + ακτίνα», **ΠΟΤΕ όνομα τόπου**»*, με
 * παραπομπή στο `listing-filters.ts:38`: *«ένα φίλτρο “πόλη = Θεσσαλονίκη” θα έπρεπε
 * είτε να ψάξει στον **τίτλο**, είτε να **γεννήσει νέο πεδίο**»*.
 *
 * 🔑 **Το νέο πεδίο γεννήθηκε.** Το `PublicShowcase.coverage` *(ADR-846)* είναι ακριβώς
 * αυτό που εκείνη η πρόταση προέβλεπε ως προϋπόθεση — άρα η απαγόρευση **δεν
 * παραβιάζεται· η προϋπόθεσή της εκπληρώθηκε**. Και το όνομα τόπου δεν ψάχνεται σε
 * κείμενο: είναι **ταυτότητα** κλειστού λεξιλογίου *(ΕΛΣΤΑΤ/Καλλικράτης, ADR-772)*,
 * που συγκρίνεται με **σχέση προγόνου**, όχι με `includes`.
 *
 * ✅ **ΚΑΙ ΤΟ ΔΗΛΩΜΕΝΟ ΑΝΟΙΧΤΟ ΕΚΛΕΙΣΕ**: η οθόνη `/pro` **δεν είχε τρόπο να θέσει
 * τόπο** — ο άξονας δούλευε μόνο από τη διεύθυνση. Τώρα έχει.
 *
 * ⚠️ **ΚΑΙ ΔΕΝ ΑΚΥΡΩΝΕΙ ΤΟΝ `PlaceSearchBox`** *(ADR-842, άλλος πράκτορας)*: εκείνος
 * απαντά την **ίδια** ερώτηση από **άλλη** πηγή *(ελεύθερος γεωκωδικοποιητής → σημείο)*
 * και γράφει στο **ίδιο** πεδίο, ως σκέλος `circle`. Δύο **πεδία** θα ήταν «δύο
 * αλήθειες για το πού είσαι»· δύο **πηγές ενός** πεδίου είναι το ιδίωμα του `GeoArea`.
 *
 * ⛔ **Η ακτίνα δείχνεται ΜΟΝΟ στο σκέλος `circle`** — σε διοικητική περιοχή δεν
 * σημαίνει τίποτα: δεν υπάρχει κέντρο να μετρηθεί απόσταση από αυτό.
 */
function WhereControl({
  filters,
  onChange,
  voice,
}: {
  readonly filters: ShowcaseFilters;
  readonly onChange: (filters: ShowcaseFilters) => void;
  readonly voice: ShowcaseWhereVoice;
}): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const where = filters.where;
  const areaId = where !== null && isAdministrativeWhere(where) ? where.adminId : '';

  return (
    // ⚠️ **`basis-full` εδώ ΚΑΙ `w-full max-w-md` στην ετικέτα — χρειάζονται ΚΑΙ ΤΑ ΔΥΟ.**
    //    Αυτό το δοχείο είναι στοιχείο της εξωτερικής σειράς `flex-wrap`: χωρίς `basis-full`
    //    γίνεται shrink-to-fit, και το `w-full` της ετικέτας είναι 100% ενός ήδη στενού
    //    δοχείου *(πρώτη διόρθωση 2026-09-21: μηδέν ορατή αλλαγή)*. Στενό πεδίο ⇒ στενή λίστα
    //    *(`--radix-popover-trigger-width`)* ⇒ ονόματα περιφερειών σε τρεις γραμμές.
    <div className="flex basis-full flex-wrap items-end gap-4">
      <label className="flex w-full max-w-md flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">{t(DIRECTORY_KEYS.placeFilterLabel)}</span>
        {/*
          ⚠️ **ΤΟ ΚΕΝΟ ΠΕΔΙΟ ΣΕ ΕΡΩΤΗΜΑ-ΚΥΚΛΟ ΕΙΝΑΙ ΣΩΣΤΟ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΟ ΕΛΑΤΤΩΜΑ.**
          Ο επιλογέας δέχεται **ταυτότητα του κλειστού λεξιλογίου** και τίποτε άλλο
          *(`allowFreeText={false}`)*. Ένας κύκλος **δεν είναι** διοικητική οντότητα —
          γράφοντας εκεί το μετρημένο όνομα θα λέγαμε στον άνθρωπο ότι έχει επιλέξει
          **δήμο**, και το πρώτο του πάτημα «καθάρισε» θα έσβηνε κάτι που δεν διάλεξε.
          ⇒ Το πεδίο μένει η **είσοδος** του διοικητικού άξονα· την **κατάσταση** τη λέει
          ο υπαινιγμός από κάτω, και το αφαιρούμενο σημάδι δίπλα στα αποτελέσματα.
        */}
        <AreaCombobox
          value={areaId}
          onValueChange={(adminId) =>
            onChange({ ...filters, where: adminId === '' ? null : { adminId } })
          }
          placeholder={t(DIRECTORY_KEYS.areaSearchPlaceholder)}
          emptyMessage={t(DIRECTORY_KEYS.areaSearchEmpty)}
        />
        <WhereHint voice={voice} />
      </label>

      {where !== null && !isAdministrativeWhere(where) && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">{t(DIRECTORY_KEYS.radiusLabel)}</span>
          <Select
            value={String(where.circle.radiusKm)}
            onValueChange={(value) =>
              onChange({
                ...filters,
                where: { circle: { ...where.circle, radiusKm: Number(value) } },
              })
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
      )}
    </div>
  );
}

/**
 * **Ο ΑΞΟΝΑΣ ΤΟΥ ΤΟΠΟΥ ΟΝΟΜΑΖΕΤΑΙ ΣΕ ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ** — τέσσερις, όχι δύο *(§9 #12)*.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΙ ΑΝΤΙΚΑΤΕΣΤΗΣΕ, ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ **ΨΕΜΑ ΜΕ ΣΩΣΤΗ ΠΡΟΘΕΣΗ**
 *
 * ```tsx
 * const areaId = where !== null && isAdministrativeWhere(where) ? where.adminId : '';
 * {areaId === '' ? t(DIRECTORY_KEYS.placeAll) : t(DIRECTORY_KEYS.areaHint)}
 * ```
 *
 * Το σχόλιο από πάνω έλεγε *«Ο ΑΞΟΝΑΣ ΟΝΟΜΑΖΕΤΑΙ ΚΑΙ ΣΤΙΣ ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ. Σιωπή θα
 * άφηνε τον επισκέπτη να νομίζει ότι φιλτράρει ενώ δεν φιλτράρει.»* — σωστή πρόθεση, και
 * **μετρημένες δύο καταστάσεις εκεί που ήταν τρεις**. Το σκέλος `circle` έπεφτε στο `''`,
 * δηλαδή **στον κάδο του «δεν φιλτράρω»**, και η βλάβη βγήκε **ακριβώς αντίστροφη** από
 * τον φόβο του συγγραφέα: με `?lat=&lng=&r=5` η οθόνη έλεγε **«Όλη η Ελλάδα»** ενώ
 * ταυτόχρονα έλεγε **«10 από 22»**.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * 🔒 **Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΟΛΙΚΟΣ** — πέμπτο σκέλος στη `ShowcaseWhereVoice` **δεν
 * μεταγλωττίζεται** μέχρι να αποκτήσει κείμενο. Ίδιο ιδίωμα με το
 * `COVERAGE_RELATION_KEYS` και το `CREDIBILITY_NOTE_KEYS`: **η κλειστή ένωση μετράει,
 * όχι ο άνθρωπος**.
 *
 * 🔑 **Ο πίνακας ζει στο ΙΔΙΟ module με το `t()`** — ο τεμαχιστής του CHECK 3.34 επιλύει
 * `t(TABLE[x])` **μόνο** με πίνακα σταθερό στο ίδιο αρχείο. Ένα δυναμικό κλειδί εδώ θα
 * έβγαινε *«unresolved dynamic t()»* και θα ήταν **αόρατο** στο CHECK 3.8.
 */
const WHERE_HINT_KEYS: Record<ShowcaseWhereVoice['kind'], string> = {
  nationwide: DIRECTORY_KEYS.placeAll,
  administrative: DIRECTORY_KEYS.areaHint,
  circlePlain: DIRECTORY_KEYS.placeCircleHint,
  circleAnchored: DIRECTORY_KEYS.placeCircleHintNamed,
};

function WhereHint({ voice }: { readonly voice: ShowcaseWhereVoice }): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  return (
    <span className="text-xs text-muted-foreground">
      {t(WHERE_HINT_KEYS[voice.kind], whereVoiceParams(voice))}
    </span>
  );
}
