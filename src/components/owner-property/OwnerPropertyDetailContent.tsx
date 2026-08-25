'use client';

/**
 * @fileoverview **Η ΜΙΑ ΑΓΓΕΛΙΑ** — θέαση, επεξεργασία, απόσυρση, και **ο δρόμος προς τον κόσμο**.
 * @related ADR-777 §7 (Α5 · Α14 · Α22) · §8.16 · lib/listings/listing-routes.ts
 * @module components/owner-property/OwnerPropertyDetailContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ ΤΗΣ Α14 ΚΛΕΙΝΕΙ **ΕΔΩ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *«Αν ένας ιδιώτης δεν μπορεί να ανεβάσει το διαμέρισμά του και **να το δει να
 * > εμφανίζεται στα αποτελέσματα**, δεν έχει τελειώσει.»*
 *
 * Ο σύνδεσμος προς τη **δημόσια** αγγελία (`listingDetailHref`) είναι το σημείο όπου
 * ο κύκλος κλείνει και γίνεται **επαληθεύσιμος από τον ίδιο τον άνθρωπο** — όχι από
 * εμάς. Και εμφανίζεται **μόνο** όταν η αγγελία είναι πραγματικά δημοσιευμένη, γιατί
 * ένας σύνδεσμος προς κενή σελίδα είναι χειρότερος από κανέναν.
 *
 * 🔑 **Ο ίδιος κριτής με τον διακομιστή**, όπως και στην κάρτα: η σύνθεση
 * `projectableFromOwnerProperty` → `isPubliclyListed`. Καμία δεύτερη ανάγνωση, κανένα
 * δεύτερο κατηγόρημα.
 *
 * ⚠️ **Η απόσυρση ΔΕΝ διαγράφει** (`lifecycle: 'withdrawn'`), και το λέει η ίδια η
 * οθόνη: η αγγελία φεύγει από τον χάρτη και **μένει στον κατάλογό του**. Ένα κουμπί
 * «διαγραφή» θα ήταν μη αναστρέψιμη πράξη πάνω στη δουλειά του ανθρώπου, για ανάγκη
 * που το `lifecycle` καλύπτει πλήρως.
 */

import React from 'react';
import { Link, useRouter } from '@/lib/workspace/navigation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { nowISO } from '@/lib/date-local';
import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { ownerPropertyFormFrom } from '@/lib/owner-property/owner-property-form-values';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { isPubliclyListed } from '@/services/listings/public-listing-projection';
import { setOwnerListingLifecycle } from '@/services/owner-property/owner-property.service';
import { useMyOwnerProperty } from '@/services/realtime/hooks/useMyOwnerProperties';
import type { OwnerProperty } from '@/types/owner-property';

import { PlaceInterestPanel } from '@/components/demand/PlaceInterestPanel';
import { usePlaceInterest } from '@/hooks/demand/usePlaceInterest';
import { OwnerPropertyCard } from './OwnerPropertyCard';
import { OwnerPropertyFormContent } from './OwnerPropertyFormContent';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/offers/[offerId]` (ADR-777 §8.39).
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
import routeSlice from '@/i18n/generated/routes/offers__offerId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'property-market';
const K = `${NS}:offer`;

/** Οι τρεις καταστάσεις του κουμπιού κύκλου ζωής. **Ποτέ** `boolean` + `string`. */
type LifecycleState = 'idle' | 'busy' | 'failed';

/**
 * **Απόσυρση / επαναφορά** — ένα κουμπί, δύο κατευθύνσεις.
 *
 * ⚠️ **Δεν είναι αισιόδοξο, σε αντίθεση με το «ψάχνω ακόμη» της ζήτησης.** Εκεί η
 * πράξη αγγίζει **ένα πεδίο** και η αναμονή είναι θόρυβος· εδώ αλλάζει **τι βλέπει ο
 * κόσμος**. Μια όψη που λέει «αποσύρθηκε» ενώ η αγγελία είναι ακόμη στον χάρτη είναι
 * το χειρότερο δυνατό ψέμα προς τον ιδιοκτήτη — και δεν υπάρχει τρόπος να το
 * ανακαλύψει από τη δική του οθόνη.
 */
function LifecycleButton({ property }: { property: OwnerProperty }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [state, setState] = React.useState<LifecycleState>('idle');

  const next = property.lifecycle === 'listed' ? 'withdrawn' : 'listed';

  async function handleClick(): Promise<void> {
    setState('busy');
    const outcome = await setOwnerListingLifecycle(property.id, next);
    // Η ζωντανή ανάγνωση (`useMyOwnerProperty`) φέρνει τη νέα κατάσταση μόνη της —
    // καμία τοπική αντιγραφή, **μία** πηγή.
    setState(outcome.kind === 'saved' ? 'idle' : 'failed');
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'busy'}
        className="self-start rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
      >
        {t(next === 'withdrawn' ? `${K}.lifecycle.withdraw` : `${K}.lifecycle.restore`)}
      </button>
      <p className="text-sm text-muted-foreground">{t(`${K}.lifecycle.withdrawNote`)}</p>
      {state === 'failed' && (
        <p aria-live="polite" className="text-sm text-foreground">
          {t(`${K}.lifecycle.failed`)}
        </p>
      )}
    </div>
  );
}

/** Η θέαση — περίληψη, δρόμος προς τον κόσμο, κύκλος ζωής. */
function OwnerPropertyView({
  property,
  onEdit,
}: {
  property: OwnerProperty;
  onEdit: () => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const onMap = isPubliclyListed(projectableFromOwnerProperty(property, nowISO()));
  // ⚠️ Στην **κορυφή** του component, ποτέ μέσα στο JSX: ένας hook που ζει σε έκφραση
  // γνωρίσματος διαβάζεται ως υπό όρους από τον επόμενο αναγνώστη, ακόμη κι όταν δεν
  // είναι — και η πρώτη φορά που κάποιος τον τυλίξει σε `{onMap && …}` σπάει σιωπηλά.
  const interest = usePlaceInterest(property.id);

  return (
    <div className="flex flex-col gap-4">
      <OwnerPropertyCard property={property} />

      {/*
        🎯 **ΤΟ ΔΟΛΩΜΑ ΤΟΥ §12.6, ADR-777 Ε2** — «N άνθρωποι ψάχνουν κάτι σαν το δικό
        σας». Στέκεται **πάνω** από το κουμπί επεξεργασίας και **πριν** τον σύνδεσμο
        δημοσίευσης, επίτηδες: είναι ο **λόγος** να πατήσει κάποιο από τα δύο.

        🔑 **Εμφανίζεται ΚΑΙ όταν η αγγελία δεν είναι δημοσιευμένη** — εκεί έχει τη
        μεγαλύτερη αξία. Το §12.6 το λέει: *«πολύ ισχυρότερο κάλεσμα από “ανεβάστε
        αγγελία”»*, δηλαδή απευθύνεται **εξ ορισμού** σε όποιον δεν έχει ανεβάσει.
      */}
      <PlaceInterestPanel interest={interest} />

      {/*
        🔴 **Ο σύνδεσμος που κλείνει τον κύκλο της Α14.** Εμφανίζεται μόνο όταν η
        αγγελία είναι πραγματικά δημοσιευμένη — ένας σύνδεσμος προς κενή σελίδα είναι
        χειρότερος από κανέναν.
      */}
      {onMap && (
        <nav>
          <Link
            href={listingDetailHref(property.id)}
            className="inline-block rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
          >
            {t(`${K}.publish.view`)}
          </Link>
        </nav>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t(`${K}.detail.edit`)}
        </button>
      </div>

      <LifecycleButton property={property} />
    </div>
  );
}

export function OwnerPropertyDetailContent({
  ownerPropertyId,
}: {
  ownerPropertyId: string;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const router = useRouter();
  const { user } = useAuth();
  const [editing, setEditing] = React.useState(false);
  const lookup = useMyOwnerProperty(ownerPropertyId, user?.uid ?? null);

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
        <button
          type="button"
          onClick={() => router.push(MY_OFFERS_ROUTE)}
          className="text-sm font-medium text-foreground underline"
        >
          {t(`${K}.detail.back`)}
        </button>
      </nav>

      {lookup.state === 'loading' && (
        <p className="text-muted-foreground">{t(`${K}.detail.loading`)}</p>
      )}
      {lookup.state === 'anonymous' && (
        <p className="text-foreground">{t(`${NS}:demand.space.signInNeeded`)}</p>
      )}
      {lookup.state === 'absent' && (
        <p className="text-foreground">{t(`${K}.detail.absent`)}</p>
      )}
      {lookup.state === 'error' && (
        <p className="text-foreground">{t(`${K}.detail.error`)}</p>
      )}

      {lookup.state === 'found' &&
        (editing ? (
          /*
            ⚠️ **Η φόρμα εδώ ΔΕΝ περνά από την πύλη της Α8, και είναι σκόπιμο.** Η
            πύλη προστατεύει τα **bytes** της διαδρομής δημιουργίας — εκείνη είναι
            ξεχωριστό bundle. Εδώ ο άνθρωπος βρίσκεται ήδη στη σελίδα του ακινήτου
            του και ζητά ρητά επεξεργασία: μια άρνηση θα τον άφηνε να **βλέπει** την
            αγγελία και να μην μπορεί να διορθώσει τυπογραφικό.
          */
          <OwnerPropertyFormContent
            initialValues={ownerPropertyFormFrom(lookup.property)}
            editingId={lookup.property.id}
            previousOffers={lookup.property.offers}
          />
        ) : (
          <OwnerPropertyView
            property={lookup.property}
            onEdit={() => setEditing(true)}
          />
        ))}
    </main>
  );
}
