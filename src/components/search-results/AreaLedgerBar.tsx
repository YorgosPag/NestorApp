'use client';

/**
 * **Η ΤΕΤΑΡΤΗ ΔΙΑΜΕΡΙΣΗ** — «8 εδώ · 3 ίσως · 6 εκτός περιοχής» *(ADR-777 §8.63)*.
 *
 * Οι τρεις που προηγούνται ρωτούν *«πού;»* (`ListingLedgerBar`), *«πότε;»*
 * (`StayLedgerBar`) και *«ταιριάζει;»* (`CriteriaLedgerBar`). Αυτή ρωτά **«είναι στην
 * περιοχή που κοιτάω;»** — και είναι η **μόνη** από τις τέσσερις που περιγράφει κάτι
 * το οποίο η οθόνη **πράγματι έκοψε**.
 *
 * ## 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΟ ΦΙΛΤΡΟ
 *
 * Το φιλτράρισμα από το κάδρο το κάνουν **όλοι** *(Zillow, Redfin, Idealista,
 * Rightmove)*. Αυτό που **κανείς** τους δεν κάνει είναι να πει **πόσα** έφυγαν και
 * **πόσα δεν ξέρει**: ο χρήστης βλέπει τον αριθμό να αλλάζει και δεν μαθαίνει ποτέ
 * ούτε ποια χάθηκαν ούτε γιατί. Τα καταγεγραμμένα παράπονα για την Airbnb είναι
 * ακριβώς αυτό — *«καταλύματα εμφανίζονται και εξαφανίζονται»*.
 *
 * 🔑 **Η μεσαία στήλη είναι το πραγματικό εύρημα.** Μια αγγελία που ξέρουμε μόνο τη
 * **συνοικία** της δεν είναι ούτε «μέσα» ούτε «έξω», και η μόνη τίμια απάντηση είναι
 * *«ίσως, και γι' αυτό στο λέω»*. Είναι το ίδιο σχήμα με το `UnmappedListingsRow`,
 * που ήδη λέει *«3 ακόμη: μπορεί να είναι εδώ, μπορεί και όχι»* — το πρότυπο
 * υπήρχε, έλειπε η τρίτη κατηγορία στον **κριτή**.
 *
 * ⚠️ **ΔΕΝ τυπώνεται όταν κανείς δεν ρώτησε περιοχή.** Είναι η μόνη από τις τέσσερις
 * γραμμές με αυτή τη συμπεριφορά, και **δεν** αναιρεί τον κανόνα 27: εκείνος απαιτεί
 * να μη λείπει αριθμός για ερώτηση **που έγινε**. Χωρίς περιοχή, το `outside` θα
 * ήταν `0` σε **κάθε** αναζήτηση για πάντα — δηλαδή ακριβώς το *«`0` σημαίνει κανείς
 * δεν κοίταξε»* που το repo έχει πληρώσει τέσσερις φορές *(N.11 · N.12 · N.18 ·
 * CHECK 3.18)*. Ίδιο ιδίωμα με το `asked` του `CriteriaLedgerBar`.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { ListingReadCoverage } from '@/lib/listings/listing-geo-query';
import {
  areaLedgerBalances,
  areaLedgerMatchesVisible,
  type ListingAreaLedger,
} from '@/lib/listings/listing-search-area';

interface AreaLedgerBarProps {
  readonly ledger: ListingAreaLedger;
  /** Ρώτησε κάποιος περιοχή; Χωρίς ερώτηση, **καμία γραμμή** — δες την κεφαλίδα. */
  readonly asked: boolean;
  /**
   * **ΠΟΣΕΣ ΑΓΓΕΛΙΕΣ ΕΠΕΖΗΣΑΝ ΠΡΑΓΜΑΤΙΚΑ** — ο αριθμός που κάνει τη γραμμή ανίκανη
   * να ψευδιστεί.
   *
   * ⚠️ **Υποχρεωτικό, ποτέ προαιρετικό με προεπιλογή `inside + maybe`.** Μια τέτοια
   * προεπιλογή θα έκανε τον έλεγχο **ταυτολογία** — θα περνούσε πάντα. Είναι
   * κατά λέξη το επιχείρημα του `ListingLedgerBar.rendered` (§8.62), και ισχύει εδώ
   * για τον ίδιο λόγο: ο καταναλωτής **οφείλει** να το μετρήσει από το σύνολο που
   * όντως έδωσε στην οθόνη.
   */
  readonly visibleCount: number;
  /**
   * **ΤΙ ΚΟΙΤΑΞΕ Η ΑΝΑΓΝΩΣΗ** — και γι' αυτό, τι επιτρέπεται να ισχυριστεί η γραμμή.
   *
   * 🔴 **Χωρίς αυτό, το §8.65 θα ΑΚΥΡΩΝΕ σιωπηλά το §8.63.** Από τη στιγμή που το
   * ερώτημα κουβαλά την περιοχή, ο κατάλογος περιέχει μόνο ό,τι ζει στο ορθογώνιο
   * ανάγνωσης — άρα το `outside` μετρά **τον δακτύλιο των 10 χλμ**, όχι τον κόσμο.
   * Ένας τέτοιος αριθμός είναι **μικρός, εύλογος και ψεύτικος**: δεν σπάει καμία
   * ισορροπία, δεν κοκκινίζει καμία άγκυρα, και λέει ψέματα σε κάθε αναζήτηση.
   *
   * ⇒ Όταν η ανάγνωση **κόπηκε**, η γραμμή λέει *«8 εδώ · 3 ίσως»* και **ομολογεί**
   * ότι δεν κοίταξε παραπέρα. Δεν αφαιρείται πληροφορία: αντικαθίσταται ψευδής με
   * αληθινή — το ίδιο ιδίωμα με το `indeterminate` του `public-place-lookup`.
   */
  readonly coverage: ListingReadCoverage;
  readonly className?: string;
}

export function AreaLedgerBar({
  ledger,
  asked,
  visibleCount,
  coverage,
  className,
}: AreaLedgerBarProps) {
  const { t } = useTranslation(['search-results']);

  // 🔑 **ΔΥΟ ΑΝΕΞΑΡΤΗΤΕΣ ΕΡΩΤΗΣΕΙΣ, ΠΟΤΕ ΜΙΑ ΜΕ «Ή» ΣΤΗΝ ΠΗΓΗ** — ίδιο ιδίωμα με το
  //    `ListingLedgerBar`: το πρώτο ρωτά «κλείνει μέσα της;», το δεύτερο «μιλά για το
  //    ΙΔΙΟ σύνολο με τη λίστα;». Συμπτυγμένα, θα χανόταν ποιο από τα δύο έσπασε.
  const balanced = areaLedgerBalances(ledger);
  const matches = areaLedgerMatchesVisible(ledger, visibleCount);

  if (!asked) return null;

  return (
    <output
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground',
        className
      )}
    >
      {/*
        🔑 **ΔΥΟ ΔΙΑΤΥΠΩΣΕΙΣ, ΓΙΑΤΙ ΞΕΡΟΥΜΕ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΠΡΑΓΜΑΤΑ** — ποτέ μία με
        `outside: 0`. Όταν η ανάγνωση κόπηκε, το «εκτός περιοχής» δεν είναι μηδέν:
        είναι **άγνωστο**, και οι δύο λέξεις δεν επιτρέπεται να μοιράζονται σύμβολο.
      */}
      <span>
        {coverage.kind === 'complete'
          ? t('search-results:area.summary', {
              inside: ledger.inside,
              maybe: ledger.maybe,
              outside: ledger.outside,
            })
          : t('search-results:area.summaryCapped', {
              inside: ledger.inside,
              maybe: ledger.maybe,
            })}
      </span>

      {/*
        ⚠️ **Ο συνολικός αριθμός λέγεται ΜΟΝΟ όταν είναι ακριβής.** Για δηλωμένο
        **κύκλο** η καταμέτρηση τρέχει στο περιγεγραμμένο ορθογώνιο (έως 21,5%
        μεγαλύτερο), οπότε το `total` έρχεται `null` και η οθόνη λέει σκέτο
        *«υπάρχουν κι άλλες»* — αληθές, χωρίς ψεύτικη ακρίβεια τριών ψηφίων.
      */}
      {coverage.kind === 'capped' && (
        <span>
          {coverage.total === null
            ? t('search-results:area.moreUnknown', { shown: coverage.shown })
            : t('search-results:area.moreCounted', {
                shown: coverage.shown,
                total: coverage.total,
              })}
        </span>
      )}

      {/*
        ⚠️ **Η εξήγηση εμφανίζεται ΜΟΝΟ όταν υπάρχει «ίσως».** Μια μόνιμη υποσημείωση
        για κατηγορία που αυτή τη στιγμή είναι άδεια εκπαιδεύει τον αναγνώστη να
        προσπερνά τη γραμμή — και τότε δεν θα τη διαβάσει ούτε τη μέρα που μετράει.
      */}
      {ledger.maybe > 0 && <span>{t('search-results:area.maybeHint')}</span>}

      {!(balanced && matches) && (
        <strong role="alert" className="text-destructive">
          {t('search-results:area.imbalanced')}
        </strong>
      )}
    </output>
  );
}
