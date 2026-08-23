'use client';

/**
 * **«Οι ζητήσεις μου»** — ο κατάλογος ανοιχτών εντολών του ανθρώπου.
 *
 * @related ADR-777 §7 (Α9 · Α12 επίπεδο Β) · SPEC-777B §12.2 · §12.6
 * @module components/demand/MyDemandsContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΔΕΙΑ ΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΟΘΟΝΗ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος που φτάνει χωρίς καμία ζήτηση **δεν ξέρει ακόμη τι είναι αυτό**. Ένα
 * σκέτο «δεν έχεις ζητήσεις» με ένα κουμπί θα το διάβαζε ως φόρμα επικοινωνίας — και
 * το §12.2 απαγορεύει ακριβώς αυτή την ανάγνωση.
 *
 * Άρα η κενή κατάσταση **λέει τι κερδίζει**: *«μαθαίνεις τι υπάρχει κοντά, τι το
 * εμποδίζει, και πόσοι άλλοι ψάχνουν το ίδιο»* — δηλαδή τον **όρο επιβίωσης** του
 * §12.6, δηλωμένο **πριν** ο χρήστης επενδύσει χρόνο.
 *
 * ⚠️ **Καμία δεύτερη ανάγνωση.** Ο κατάλογος διαβάζει το {@link useMyDemands}· η
 * απάντηση του §12.6 ζει στη **λεπτομέρεια**, όχι εδώ. Ένα ταίριασμα ανά κάρτα θα
 * σήμαινε **N** περάσματα της μηχανής σε κάθε απόδοση, για πληροφορία που ο άνθρωπος
 * δεν ζήτησε ακόμη — και η **Α0** δεσμεύει «μοντέλο για την τελική κλίμακα».
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NEW_DEMAND_ROUTE } from '@/lib/demand/demand-routes';
import { useMyDemands } from '@/services/realtime/hooks/useMyDemands';
import { DemandCard } from './DemandCard';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/demands` (ADR-777 §8.39).
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
import routeSlice from '@/i18n/generated/routes/demands.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/** Η κενή κατάσταση — **λέει τι κερδίζει**, όχι μόνο ότι είναι κενή. */
function EmptyState(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="font-medium text-foreground">{t('property-market:demand.list.empty')}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('property-market:demand.list.emptyHint')}
      </p>
    </div>
  );
}

/**
 * Το σώμα: **τέσσερις** καταστάσεις, ρητά.
 *
 * ⚠️ Το `anonymous` δεν φτάνει ποτέ εδώ (ο `ProtectedRoute` του `(me)/layout` το
 * κόβει), αλλά **καλύπτεται**: το `switch` πάνω σε κλειστό σύνολο δεν επιτρέπει
 * σιωπηλή παράλειψη, και μια κατάσταση χωρίς κλάδο θα ζωγράφιζε **λευκή οθόνη**.
 */
function DemandsBody(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const { user } = useAuth();
  const state = useMyDemands(user?.uid ?? null);

  switch (state.state) {
    case 'anonymous':
      return <p className="text-foreground">{t('property-market:demand.space.signInNeeded')}</p>;
    case 'loading':
      return <p className="text-muted-foreground">{t('property-market:demand.list.loading')}</p>;
    case 'error':
      return <p className="text-foreground">{t('property-market:demand.list.error')}</p>;
    case 'ready':
      return state.demands.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {state.demands.map((demand) => (
            <li key={demand.id}>
              <DemandCard demand={demand} />
            </li>
          ))}
        </ul>
      );
  }
}

export function MyDemandsContent(): React.ReactElement {
  const { t } = useTranslation(['property-market']);

  return (
    // `flex-1`, ΟΧΙ `min-h-screen`: το ύψος το κατέχει το `(me)/layout.tsx`, που
    // φιλοξενεί και την κεφαλίδα — ίδια σύμβαση με το `(light)`.
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {t('property-market:demand.list.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('property-market:demand.list.lead')}</p>
      </header>

      {/*
        Η πόρτα δημιουργίας είναι **σύνδεσμος προς ξεχωριστή διαδρομή**, όχι κουμπί που
        ανοίγει πάνελ — και είναι η μισή απάντηση στην **Α8**: το route-level code
        splitting του App Router σημαίνει ότι το βάρος της φόρμας **δεν ταξιδεύει καν**
        προς όποιον δεν την άνοιξε. Δες `demand-routes.ts`.
      */}
      <nav>
        <Link
          href={NEW_DEMAND_ROUTE}
          className="inline-block rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t('property-market:demand.list.create')}
        </Link>
      </nav>

      <DemandsBody />
    </main>
  );
}
