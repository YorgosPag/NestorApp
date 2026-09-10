'use client';

/**
 * @fileoverview **Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΠΟΥ ΔΕΝ ΕΜΠΟΔΙΖΕΙ** — ADR-846 Φάση 6.
 * @related lib/agency/coverage-reach (η κρίση) · hooks/mandate/useMyDeclaredCoverage ·
 *   components/owner-property/form/OwnerPropertyPlaceField (ο μοναδικός καλών)
 * @module components/mandate/CoverageReachNotice
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΡΟΕΙΔΟΠΟΙΗΣΗ, ΟΧΙ ΕΠΙΚΥΡΩΣΗ — ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΤΕΚΜΗΡΙΩΜΕΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Form warnings are fundamentally different in nature from validators as they only
 * alert the user to potential problems but don't prevent them from proceeding»*
 * (**Baymard**, *Validations vs Warnings*). Και **NN/g**: *«premature validation feels
 * accusatory»*, *«helpful messages sound like instructions, not verdicts»*.
 *
 * ⇒ Τρεις συνέπειες, και **καμία** δεν είναι διακοσμητική:
 *
 * 1. **Δεν αγγίζει το `submit`.** Καμία σημαία, κανένα `disabled`, καμία εγγραφή στη
 *    φόρμα. Αυτό το component **δεν έχει δίοδο προς την υποβολή** — η αδυναμία να
 *    μπλοκάρει είναι **δομική**, όχι υπόσχεση.
 * 2. **Λέει ρητά ότι η καταχώριση προχωρά** *(`allowed`)*. Χωρίς αυτή τη γραμμή, ένα
 *    πλαίσιο με προειδοποίηση διαβάζεται ως *«κάτι χάλασε»* και ο άνθρωπος σταματά —
 *    δηλαδή θα **μπλοκάραμε με το ύφος**, εκεί που δεν μπλοκάρουμε με τον κώδικα.
 * 3. **Μιλά μόνο σε σταθεροποιημένη διεύθυνση**: το `OwnerPropertyPlaceField` σβήνει το
 *    σημείο σε **κάθε** αλλαγή κειμένου, οπότε η σιωπή κατά την πληκτρολόγηση δεν
 *    χρειάζεται χρονόμετρο — προκύπτει από το ίδιο το μοντέλο.
 *
 * 🏆 **ΚΑΙ ΟΝΟΜΑΖΕΙ ΤΗΝ ΠΕΡΙΟΧΗ** — δες `lib/agency/coverage-reach.ts` για το γιατί
 * αυτό ξεπερνά Zillow/Idealista με **μηδέν** νέα bytes.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useAdminFootprints } from '@/hooks/useAdminFootprints';
import { useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { useCoverageResolvers } from '@/hooks/useCoverageResolvers';
import { useMyDeclaredCoverage } from '@/hooks/mandate/useMyDeclaredCoverage';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { reachVoiceOf, type ReachVoice } from '@/lib/agency/coverage-reach';
import { AGENCY_SHOWCASE_ROUTE } from '@/lib/mandate/mandate-routes';
import { Link } from '@/lib/workspace/navigation';
import type { ListingPosition } from '@/types/public-listing';

const NS = 'property-market';

/**
 * ⚠️ **Πίνακας σταθερών, ΠΟΤΕ παρεμβολή** *(N.11 · CHECK 3.8)*: ένα
 * ``t(`${K}.${voice.kind}`)`` είναι **αόρατο** στην πύλη κλειδιών και ζωγραφίζει ωμό
 * κλειδί την πρώτη φορά που κάποιος προσθέτει σκέλος.
 */
const REACH_KEYS = {
  title: `${NS}:offer.form.coverageReach.title`,
  named: `${NS}:offer.form.coverageReach.named`,
  unnamed: `${NS}:offer.form.coverageReach.unnamed`,
  allowed: `${NS}:offer.form.coverageReach.allowed`,
  why: `${NS}:offer.form.coverageReach.why`,
  manage: `${NS}:offer.form.coverageReach.manage`,
} as const;

interface CoverageReachNoticeProps {
  /**
   * Πού είναι η διεύθυνση **αυτή τη στιγμή** — `null` όσο δεν έχει λυθεί.
   *
   * ⚠️ **Η φόρμα δίνει θέση, όχι αγγελία.** Δεν υπάρχει `PublicListing` εδώ και δεν
   * κατασκευάζεται ψεύτικο: ο κριτής χωρίστηκε *(`verdictForPosition`)* ακριβώς ώστε το
   * σύνορο να ταιριάζει στην ερώτηση.
   */
  readonly position: ListingPosition | null;
}

/**
 * 🔴 **Η ΣΙΩΠΗ ΕΙΝΑΙ Η ΠΡΟΕΠΙΛΟΓΗ.** Οι αιτίες της ζουν **όλες** στο `reachVoiceOf`,
 * ονομασμένες· εδώ προστίθεται **μία** που ανήκει στην οθόνη: όσο η δήλωση δεν έχει
 * φτάσει, δεν λέμε τίποτα — μια προειδοποίηση σε εκείνο το παράθυρο θα ήταν σωστή για
 * τα δεδομένα και **ψευδής** για τον άνθρωπο.
 */
export function CoverageReachNotice({
  position,
}: CoverageReachNoticeProps): React.ReactElement | null {
  const { coverage, isLoading } = useMyDeclaredCoverage();
  const { resolvers } = useCoverageResolvers();
  const { entries } = useAdminFootprints();
  const { findById } = useAdministrativeHierarchy();

  // 🔑 **Οι εξαρτήσεις είναι αληθινές** *(μάθημα §6.2)*: το `entries` αλλάζει ταυτότητα
  //    όταν φτάνουν τα αποτυπώματα, το `findById` όταν φτάνει η ιεραρχία. Χωρίς το
  //    δεύτερο, το όνομα θα **πάγωνε στο «δεν ξέρω»** για όλη τη ζωή της σελίδας.
  const voice = React.useMemo<ReachVoice>(
    () =>
      reachVoiceOf({
        coverage,
        position,
        resolvers,
        footprints: entries,
        nameOf: (adminId) => findById(adminId)?.name ?? null,
      }),
    [coverage, position, resolvers, entries, findById],
  );

  if (isLoading || voice.kind === 'silent') return null;

  return <ReachNoticeBody areaName={voice.areaName} />;
}

/**
 * **Η όψη, χωρίς καμία κρίση** *(N.7.1)* — η τομή έγινε στο σύνορο *«από πάνω hooks και
 * ετυμηγορία, από κάτω μόνο κείμενο»*, ίδια απόφαση με το `AgreementNoticeBody`.
 */
function ReachNoticeBody({ areaName }: { readonly areaName: string | null }): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    <aside
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
      // 🔑 Η κατάσταση **είναι** η ετυμηγορία — καμία δεύτερη σημαία να αποκλίνει.
      data-testid="coverage-reach-notice"
      data-named={areaName === null ? 'false' : 'true'}
    >
      <h3 className="m-0 text-sm font-semibold text-foreground">{t(REACH_KEYS.title)}</h3>

      {/* 🏆 **ΤΟ ΟΝΟΜΑ, ΟΤΑΝ ΤΟ ΞΕΡΟΥΜΕ** — και ποτέ ωμό `municipality:0701` ή
          συντεταγμένες: το `areaName === null` έχει **δικό του** κείμενο, όχι
          υποβαθμισμένο αντίγραφο του άλλου με κενό στη θέση του ονόματος. */}
      <p className="m-0 text-sm text-foreground">
        {areaName === null ? t(REACH_KEYS.unnamed) : t(REACH_KEYS.named, { area: areaName })}
      </p>

      {/* 🔴 **Η ΓΡΑΜΜΗ ΠΟΥ ΕΜΠΟΔΙΖΕΙ ΤΟ ΠΛΑΙΣΙΟ ΝΑ ΜΠΛΟΚΑΡΕΙ ΜΕ ΤΟ ΥΦΟΣ.** Χωρίς
          αυτήν, μια προειδοποίηση δίπλα σε φόρμα διαβάζεται ως άρνηση. */}
      <p className="m-0 text-sm text-muted-foreground">{t(REACH_KEYS.allowed)}</p>

      <p className="m-0 text-sm text-muted-foreground">{t(REACH_KEYS.why)}</p>

      {/* ⚠️ **Σύνδεσμος, ΟΧΙ κουμπί που γράφει** — και είναι απόφαση, όχι έλλειψη.
          Η βιτρίνα δημοσιεύεται **ολόκληρη** (`POST /api/agency-profile`, καμία μερική
          ενημέρωση). Ένα «πρόσθεσέ την» εδώ θα έπρεπε να **ανασυνθέσει τη δήλωση** από
          τα διαβασμένα πεδία — δηλαδή **δεύτερη λογιστική** της βιτρίνας (ADR-749),
          όπου μια χαμένη μετάφραση πεδίου = **σιωπηλή διαγραφή διαπιστευτηρίων**
          ανθρώπου. Ο σύνδεσμος τον πάει εκεί που η δήλωση έχει **έναν** γραφέα.

          🔑 **Από το ΣΥΝΟΡΟ** (CHECK 3.61): η διαδρομή ζει **μέσα** στον χώρο, και το
          πρόθεμα το βάζει ο `Link` — χειρόγραφο `/o/<ψευδώνυμο>/…` θα ήταν μαντεψιά. */}
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={AGENCY_SHOWCASE_ROUTE}>{t(REACH_KEYS.manage)}</Link>
      </Button>
    </aside>
  );
}
