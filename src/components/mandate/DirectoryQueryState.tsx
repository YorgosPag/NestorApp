'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΕΡΩΤΗΜΑΤΟΣ** — τι φιλτράρω τώρα, και με πόσα
 * αποτελέσματα. Μία περιοχή, μία αλήθεια. ADR-846 §9 #12.
 * @related components/ui/filter-chip (το SSoT του σημαδιού) ·
 *   lib/agency/showcase-where-voice (η κλειστή ένωση) · components/mandate/AgencyDirectoryContent
 * @module components/mandate/DirectoryQueryState
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΤΟ ΣΗΜΑΔΙ ΚΑΙ Ο ΜΕΤΡΗΤΗΣ ΖΟΥΝ **ΜΑΖΙ** — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΑΙΣΘΗΤΙΚΗ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Λένε **τα δύο μισά της ίδιας πρότασης**: *«αφαίρεσα κάτι»* *(το σημάδι)* και *«να τι
 * έμεινε»* *(«10 από 22»)*. Χωρισμένα, ο επισκέπτης βλέπει έναν αριθμό που δεν εξηγείται
 * και μια εξήγηση που δεν μετριέται — και **αυτό ακριβώς ήταν το §9 #12**.
 *
 * 🔑 **ΚΑΙ Η ΕΝΩΣΗ ΤΟΥΣ ΕΙΝΑΙ Η ΛΥΣΗ ΤΗΣ ΕΣΤΙΑΣΗΣ.** Όταν ο άνθρωπος πατήσει το `×`, ο
 * κόμβος του σημαδιού **φεύγει από το DOM**· αν η εστίαση ήταν πάνω του, πέφτει στο
 * `<body>` και ο χρήστης πληκτρολογίου **χάνει τη θέση του στη σελίδα**. Η σύσταση
 * *(Adrian Roselli, «where to put focus when deleting a thing»)* είναι να μετακινηθεί σε
 * **γείτονα μέσα στην ίδια δομή**, **πριν** φύγει ο κόμβος. Επειδή αυτή η περιοχή
 * **επιβιώνει** *(ο μετρητής μένει πάντα)*, ο γείτονας υπάρχει — και είναι ο **σωστός**:
 * ο άνθρωπος προσγειώνεται ακριβώς εκεί που τυπώνεται ο **νέος** αριθμός.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ**: σε Zillow/Redfin η αφαίρεση σημαδιού αφήνει την
 * εστίαση να πέσει στο `<body>` — μετρημένο συχνό ελάττωμα σε καταλόγους ακινήτων. Εδώ η
 * προσγείωση είναι **δηλωμένη** και η αλλαγή **ανακοινώνεται** *(`role="status"`)*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΚΑΝΕΙ ΑΥΤΗ Η ΠΕΡΙΟΧΗ — ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΛΕΙΠΕΙ ΑΠΟ ΑΜΕΛΕΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * | Τι λείπει | Γιατί |
 * |---|---|
 * | σημάδι για την **ειδικότητα** | το `<Select>` της **δείχνει ήδη** την τιμή του· δεύτερο σημάδι = **δύο φωνές για ένα πράγμα** |
 * | σημάδι για **διοικητική περιοχή** | ίδιο: ο `AreaCombobox` δείχνει το όνομα. Ο **κύκλος** είναι ο μόνος άξονας που το χειριστήριό του **δεν μπορεί** να παρουσιάσει *(δέχεται μόνο ταυτότητες του λεξιλογίου)* — γι' αυτό παίρνει σημάδι **αυτός** |
 * | «καθάρισε **όλα**» εδώ | **υπάρχει ήδη**, στα χειριστήρια *(Φ4)*. Δεύτερο κουμπί με το ίδιο νόημα δίπλα σε σημάδι που κάνει **λιγότερα** είναι ακριβώς η σύγχυση που το NN/g ονομάζει |
 *
 * 🔑 **Η αρχή, σε μία γραμμή**: *σημάδι παίρνει ο άξονας του οποίου την τιμή το
 * χειριστήριό του **δεν μπορεί** να δείξει.* Αν αύριο ο `AreaCombobox` μάθει να δείχνει
 * κύκλο, το σημάδι φεύγει — και η αλλαγή είναι **μία γραμμή** στον πίνακα παρακάτω.
 */

import React from 'react';

import { FilterChip } from '@/components/ui/filter-chip';
import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import {
  whereVoiceParams,
  type ShowcaseWhereVoice,
} from '@/lib/agency/showcase-where-voice';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * **Ποια σκέλη παίρνουν σημάδι** — και τα δύο `null` είναι **δήλωση, όχι παράλειψη**.
 *
 * 🔒 **Ο πίνακας είναι ΟΛΙΚΟΣ**: πέμπτο σκέλος στη `ShowcaseWhereVoice` **δεν
 * μεταγλωττίζεται** μέχρι κάποιος να **απαντήσει** *«παίρνει σημάδι;»*. Το εναλλακτικό
 * `if (voice.kind === 'circlePlain' || voice.kind === 'circleAnchored')` θα ήταν πάλι
 * **δυαδικός τελεστής πάνω σε κλειστή ένωση** — ακριβώς το ελάττωμα που όλη αυτή η
 * εργασία θεραπεύει, γραμμένο δεύτερη φορά στο διπλανό αρχείο.
 */
const WHERE_CHIP_KEYS: Record<ShowcaseWhereVoice['kind'], string | null> = {
  nationwide: null,
  administrative: null,
  circlePlain: DIRECTORY_KEYS.whereChipCircle,
  circleAnchored: DIRECTORY_KEYS.whereChipCircleNamed,
};

export interface DirectoryQueryStateProps {
  readonly voice: ShowcaseWhereVoice;
  /** Πόσοι φαίνονται **τώρα** — ο αριθμητής. */
  readonly shown: number;
  /** Πόσοι υπάρχουν **συνολικά** — ο παρονομαστής, χωρίς τον οποίο το φίλτρο είναι αόρατο. */
  readonly total: number;
  /** `true` όταν **οποιοσδήποτε** άξονας κόβει — ορίζει ποιο από τα δύο κείμενα ισχύει. */
  readonly filtering: boolean;
  /**
   * Αφαιρεί **μόνο** τον άξονα του τόπου.
   *
   * ⛔ **ΠΟΤΕ «καθάρισε τα πάντα»**: ένα σημάδι που ονομάζει τον τόπο και σβήνει και την
   * ειδικότητα είναι **παγίδα** — ο άνθρωπος χάνει δουλειά που δεν ζήτησε να χάσει.
   */
  readonly onClearWhere: () => void;
}

export function DirectoryQueryState({
  voice,
  shown,
  total,
  filtering,
  onClearWhere,
}: DirectoryQueryStateProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const region = React.useRef<HTMLElement>(null);
  const chipKey = WHERE_CHIP_KEYS[voice.kind];

  const removeWhere = React.useCallback((): void => {
    // 🔴 **ΠΡΩΤΑ Η ΕΣΤΙΑΣΗ, ΜΕΤΑ Η ΑΦΑΙΡΕΣΗ.** Η αντίστροφη σειρά αφήνει το React να
    //    ξεμοντάρει το κουμπί ενώ το κρατά η εστίαση ⇒ `document.activeElement` γίνεται
    //    `<body>`. Η περιοχή **επιβιώνει** της αφαίρεσης, άρα είναι έγκυρος στόχος.
    region.current?.focus();
    onClearWhere();
  }, [onClearWhere]);

  return (
    <section
      ref={region}
      tabIndex={-1}
      className="flex flex-col gap-2 outline-none"
      aria-label={t(DIRECTORY_KEYS.queryStateLabel)}
    >
      {chipKey !== null && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {/* 🔑 **Λίστα με ΕΝΑ στοιχείο, επίτηδες**: τα σημάδια είναι απαρίθμηση, και ο
              αναγνώστης οθόνης το λέει *(«λίστα, 1 στοιχείο»)*. Όταν προστεθεί δεύτερος
              άξονας χωρίς παρουσιάσιμο χειριστήριο, η δομή **δεν αλλάζει**. */}
          <li>
            <FilterChip
              label={t(chipKey, whereVoiceParams(voice))}
              removeLabel={t(DIRECTORY_KEYS.whereChipRemove, {
                filter: t(chipKey, whereVoiceParams(voice)),
              })}
              onRemove={removeWhere}
            />
          </li>
        </ul>
      )}

      {/*
        🔑 **`role="status"` — Ο ΑΡΙΘΜΟΣ ΑΝΑΚΟΙΝΩΝΕΤΑΙ, ΔΕΝ ΑΠΛΩΣ ΤΥΠΩΝΕΤΑΙ.** Ο χρήστης
        αναγνώστη οθόνης που αλλάζει φίλτρο δεν έχει **κανέναν** τρόπο να μάθει ότι το
        πλήθος άλλαξε: η εστίασή του είναι στο χειριστήριο, και η λίστα ενημερώνεται
        αθόρυβα. Είναι η ρητή σύσταση της έρευνας για faceted search *(ζωντανή περιοχή
        με το πλήθος αποτελεσμάτων)* — και το **δεύτερο μισό** του §9 #12: η οθόνη οφείλει
        να λέει την αλήθεια σε **όλους**, όχι μόνο σε όσους τη βλέπουν.

        ⚠️ **`polite`, ποτέ `assertive`**: η αλλαγή πλήθους δεν διακόπτει· περιμένει να
        τελειώσει ό,τι λέει ο αναγνώστης. Ένα `assertive` εδώ θα έκοβε τον άνθρωπο στη
        μέση **σε κάθε πάτημα** του επιλογέα.
      */}
      <p role="status" className="m-0 text-sm text-muted-foreground">
        {filtering
          ? t(DIRECTORY_KEYS.countFiltered, { shown, total })
          : t(DIRECTORY_KEYS.count, { count: total })}
      </p>
    </section>
  );
}
