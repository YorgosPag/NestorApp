'use client';

/**
 * **ΜΙΑ ΖΗΤΗΣΗ** — τα κριτήριά της, οι πράξεις της, **και η απάντηση του §12.6**.
 *
 * @related ADR-777 §7 (Α9 · Α12) · SPEC-777B §12.6 · lib/demand/demand-answer.ts
 * @module components/demand/DemandDetailContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΔΩ ΖΕΙ ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *«αν η οθόνη δεν μπορεί να πει “δεν βρέθηκε τίποτα, αλλά με +20.000 € υπάρχουν 6
 * > και άλλοι 8 ζητούν το ίδιο”, δεν έχει τελειώσει»*
 *
 * Ο κατάλογος δείχνει **τι ζήτησες**· αυτή η οθόνη δείχνει **τι σημαίνει**. Και η
 * απάντηση φορτώνει **μαζί** με τα κριτήρια, όχι πίσω από κλικ: το §12.6 δηλώνει
 * **όρο επιβίωσης**, όχι χαρακτηριστικό — *«αλλιώς ο χρήστης δηλώνει, δεν παίρνει
 * απάντηση, και δεν ξαναγυρνά»*.
 *
 * ⚠️ **Πέντε ρητές καταστάσεις ανάγνωσης**, και το `absent` **δεν είναι σφάλμα**: ένα
 * `dmnd_*` που δεν επιστρέφεται σημαίνει είτε λάθος σύνδεσμος είτε **ζήτηση άλλου
 * ανθρώπου** — και οι δύο είναι «δεν υπάρχει **για σένα**». Ένα «δεν έχεις δικαίωμα»
 * θα **επιβεβαίωνε** ότι υπάρχει, δηλαδή θα διέρρεε το επίπεδο Β με άρνηση.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useDemandAnswer, useDemandCompetition } from '@/hooks/demand/useDemandAnswer';
import { useMyDemand } from '@/services/realtime/hooks/useMyDemands';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import type { PropertyDemand } from '@/types/property-demand';
import { DemandAnswerPanel } from './DemandAnswerPanel';
import { DemandLifecycleActions } from './DemandLifecycleActions';
import { DemandSummary } from './DemandSummary';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/demands/[demandId]` (ADR-777 §8.39).
//
// Το `property-market` έπαψε να ταξιδεύει ΟΛΟΚΛΗΡΟ σε 141 διαδρομές (§8.38). Χωρίς
// αυτή τη γραμμή, αυτή η οθόνη θα έβαφε **ωμά κλειδιά στο πρώτο καρέ** — η μία κλάση
// ελαττώματος ανταλλαγμένη με άλλη, που το ADR-744 §8 απαγορεύει ρητά.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component, και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** — με `import()` το ωμό κλειδί απλώς
// μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/demands__demandId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'property-market';

/** Τα κριτήρια + οι πράξεις + η απάντηση. */
function DemandBody({ demand }: { demand: PropertyDemand }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const answer = useDemandAnswer(demand);
  const competition = useDemandCompetition(demand.id);

  return (
    <>
      <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t(`${NS}:demand.detail.criteria`)}
        </h2>
        <DemandSummary demand={demand} />
        <DemandLifecycleActions demand={demand} />
      </section>

      {answer.state === 'loading' && (
        <p className="text-muted-foreground">{t(`${NS}:demand.answer.checking`)}</p>
      )}
      {answer.state === 'error' && (
        <p className="text-foreground">{t(`${NS}:demand.detail.error`)}</p>
      )}
      {answer.state === 'ready' && (
        <DemandAnswerPanel
          demand={demand}
          answer={answer.answer}
          competition={competition}
        />
      )}
    </>
  );
}

/** Η ζήτηση δεν βρέθηκε — **και λέγεται σωστά**. */
function NotFound(): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="font-medium text-foreground">{t(`${NS}:demand.detail.notFound`)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(`${NS}:demand.detail.notFoundHint`)}
      </p>
    </div>
  );
}

export function DemandDetailContent({ demandId }: { demandId: string }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();
  const lookup = useMyDemand(demandId, user?.uid ?? null);

  return (
    <main className="flex w-full flex-col gap-6">
      {/*
        ⚠️ ΚΑΝΕΝΑ `mx-auto max-w-3xl p-6` εδώ (ADR-797 ΦΑΣΗ Β). Και τα τρία τα κατέχει
        πλέον ο ΕΝΑΣ ιδιοκτήτης, το `ShellSurface` του `PrivateSpaceShell`:
          · ο **διάδρομος** ρευστά από το πλάτος της επιφάνειας (16→32px),
          · το **μέτρο** ως ρόλος `wide` = **80ch** — ⚠️ **ΟΧΙ «80 χαρακτήρες»**:
            το `ch` είναι το πλάτος του γλύφου «0», και μετρημένο στο corpus της
            εφαρμογής δίνει **91** ελληνικούς / **101** αγγλικούς (ADR-797 §Β.11),
          · το **κεντράρισμα** δωρεάν από τις δύο `1fr` στήλες του grid.
        Το παλιό `max-w-3xl` + `p-6` έδινε **720px**· ο ρόλος δίνει **719px**. Το
        κέρδος **δεν** είναι το πλάτος — είναι ότι η τιμή γράφεται **μία** φορά αντί
        για τέσσερις, και κλιμακώνεται με το zoom του χρήστη (WCAG 1.4.4).
      */}
      <nav>
        <Link href={MY_DEMANDS_ROUTE} className="text-sm font-medium text-foreground underline">
          {t(`${NS}:demand.list.title`)}
        </Link>
      </nav>

      {/*
        Το `switch` πάνω σε κλειστό σύνολο: μια κατάσταση χωρίς κλάδο θα ζωγράφιζε
        **λευκή οθόνη** — η χειρότερη δυνατή απάντηση, γιατί δεν λέει καν ότι κάτι
        πήγε στραβά.
      */}
      {lookup.state === 'loading' && (
        <p className="text-muted-foreground">{t(`${NS}:demand.detail.loading`)}</p>
      )}
      {lookup.state === 'anonymous' && (
        <p className="text-foreground">{t(`${NS}:demand.space.signInNeeded`)}</p>
      )}
      {lookup.state === 'absent' && <NotFound />}
      {lookup.state === 'error' && (
        <p className="text-foreground">{t(`${NS}:demand.detail.error`)}</p>
      )}
      {lookup.state === 'found' && <DemandBody demand={lookup.demand} />}
    </main>
  );
}
