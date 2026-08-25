'use client';

/**
 * @fileoverview **«Τα ακίνητά μου»** — ο κατάλογος του ιδιοκτήτη.
 * @related ADR-777 §7 (Α14 · Α12 επίπεδο Β · Α8) · §17.1 · §8.16
 * @module components/owner-property/MyOwnerPropertiesContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΔΕΙΑ ΚΑΤΑΣΤΑΣΗ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΟΘΟΝΗ ΕΔΩ — ΚΑΙ ΓΙΑ ΑΛΛΟ ΛΟΓΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στη **ζήτηση**, η κενή κατάσταση εξηγεί *τι είναι* μια ζήτηση — έννοια που ο
 * χρήστης δεν έχει ξαναδεί. Εδώ ο άνθρωπος ξέρει ακριβώς τι είναι «καταχωρώ το
 * ακίνητό μου»· **αυτό που δεν ξέρει είναι γιατί του ζητάμε πεδία**.
 *
 * Άρα η κενή κατάσταση λέει το **§17.1**, χωρίς ορολογία: *«χωρίς αυτά το ακίνητο
 * υπάρχει στη βάση και δεν συναντά ποτέ κανέναν»*. Είναι η **μόνη** πρόταση που
 * μετατρέπει τη φόρμα από γραφειοκρατία σε συμφέρον του — και λέγεται **πριν**
 * επενδύσει χρόνο, όχι αφού εγκαταλείψει.
 *
 * ⚠️ **Καμία δεύτερη ανάγνωση, και κανένα ταίριασμα ανά κάρτα.** Ο κατάλογος διαβάζει
 * μόνο το {@link useMyOwnerProperties}· το «είναι στον χάρτη;» είναι **καθαρή
 * συνάρτηση** πάνω στα ίδια δεδομένα (δες {@link OwnerPropertyCard}).
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { CREATE_WORKSPACE_ROUTE } from '@/lib/workspace/workspace-routes';
import { useMyOwnerProperties } from '@/services/realtime/hooks/useMyOwnerProperties';

import { OwnerPropertyCard } from './OwnerPropertyCard';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/offers` (ADR-777 §8.39).
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
import routeSlice from '@/i18n/generated/routes/offers.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'property-market';
const K = `${NS}:offer.list`;

/** Η κενή κατάσταση — **λέει το §17.1**, όχι μόνο ότι είναι κενή. */
function EmptyState(): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="font-medium text-foreground">{t(`${K}.empty`)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(`${K}.emptyHint`)}</p>
    </div>
  );
}

/**
 * Το σώμα: **τέσσερις** καταστάσεις, ρητά.
 *
 * ⚠️ Το `anonymous` δεν φτάνει ποτέ εδώ (ο φρουρός ταυτότητας του `(me)/layout` το
 * κόβει), αλλά **καλύπτεται**: το `switch` πάνω σε κλειστό σύνολο δεν επιτρέπει
 * σιωπηλή παράλειψη, και μια κατάσταση χωρίς κλάδο θα ζωγράφιζε **λευκή οθόνη**.
 */
function OwnerPropertiesBody(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();
  const state = useMyOwnerProperties(user?.uid ?? null);

  switch (state.state) {
    case 'anonymous':
      return <p className="text-foreground">{t(`${NS}:demand.space.signInNeeded`)}</p>;
    case 'loading':
      return <p className="text-muted-foreground">{t(`${K}.loading`)}</p>;
    case 'error':
      return <p className="text-foreground">{t(`${K}.error`)}</p>;
    case 'ready':
      return state.properties.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {state.properties.map((property) => (
            <li key={property.id}>
              <OwnerPropertyCard property={property} />
            </li>
          ))}
        </ul>
      );
  }
}

export function MyOwnerPropertiesContent(): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    // `flex-1`, ΟΧΙ `min-h-screen`: το ύψος το κατέχει το `(me)/layout.tsx`, που
    // φιλοξενεί και την κεφαλίδα — ίδια σύμβαση με το `(light)`.
    <main className="flex w-full flex-col gap-6">
      {/*
        ⚠️ ΚΑΝΕΝΑ `mx-auto max-w-3xl p-6` εδώ (ADR-797 ΦΑΣΗ Β). Και τα τρία τα κατέχει
        πλέον ο ΕΝΑΣ ιδιοκτήτης, το `ShellSurface` του `PrivateSpaceShell`:
          · ο **διάδρομος** ρευστά από το πλάτος της επιφάνειας (16→32px),
          · το **μέτρο** ως ρόλος `wide` = 80 χαρακτήρες (WCAG 1.4.8),
          · το **κεντράρισμα** δωρεάν από τις δύο `1fr` στήλες του grid.
        Το παλιό `max-w-3xl` + `p-6` έδινε 720px = **80,1 χαρακτήρες** — δηλαδή το
        ίδιο πλάτος, αλλά κλειδωμένο σε pixel (σπάει στο zoom, WCAG 1.4.4) και
        γραμμένο **τέσσερις φορές** σε τέσσερα αρχεία.
      */}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t(`${K}.title`)}</h1>
        <p className="text-sm text-muted-foreground">{t(`${K}.lead`)}</p>
      </header>

      {/*
        Η πόρτα δημιουργίας είναι **σύνδεσμος προς ξεχωριστή διαδρομή**, όχι κουμπί που
        ανοίγει πάνελ — και είναι η μισή απάντηση στην **Α8**: το route-level code
        splitting σημαίνει ότι το βάρος της φόρμας **δεν ταξιδεύει καν** προς όποιον
        δεν την άνοιξε. Δες `owner-property-routes.ts`.
      */}
      <nav>
        <Link
          href={NEW_OFFER_ROUTE}
          className="inline-block rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t(`${K}.create`)}
        </Link>
      </nav>

      <OwnerPropertiesBody />

      <WorkspaceInvitation />
    </main>
  );
}

/**
 * **Η πόρτα προς τον εταιρικό χώρο** (ADR-787 Κ-1).
 *
 * 🔴 **Γιατί εδώ.** Μέχρι σήμερα ένας αυτο-εγγεγραμμένος άνθρωπος **δεν είχε
 * κανέναν τρόπο** να φτιάξει γραφείο: ο εταιρικός χώρος δινόταν μόνο από
 * `super_admin`. Αυτή η οθόνη είναι το **μοναδικό** σημείο όπου προσγειώνεται
 * όποιος δεν έχει χώρο (`PRIVATE_SPACE_HOME`, `lib/routes/landing.ts`) — δηλαδή
 * η μόνη θέση όπου η πόρτα **συναντά** αυτόν που τη χρειάζεται.
 *
 * ⚠️ **Ζωγραφίζεται μόνο σε όποιον ΔΕΝ έχει ήδη χώρο.** Ο διακομιστής τον
 * απορρίπτει ούτως ή άλλως (`already-has-workspace`), αλλά μια πρόσκληση που
 * οδηγεί σε βέβαιη άρνηση είναι **ψέμα στην οθόνη** — και δεν διορθώνεται με
 * καλύτερο μήνυμα σφάλματος.
 *
 * ⚠️ **Κάτω από τον κατάλογο, όχι πάνω.** Ο άνθρωπος ήρθε για τα ακίνητά του·
 * η πρόσκληση είναι **δεύτερη** πρόταση, όχι ανταγωνιστής της «Νέα καταχώρηση».
 */
function WorkspaceInvitation(): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();

  if (user?.companyId) return null;

  return (
    <aside className="rounded-lg border border-border bg-muted/30 p-5">
      <h2 className="text-sm font-semibold text-foreground">
        {t(`${K}.workspaceCta.title`)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(`${K}.workspaceCta.body`)}
      </p>
      <Link
        href={CREATE_WORKSPACE_ROUTE}
        className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {t(`${K}.workspaceCta.action`)}
      </Link>
    </aside>
  );
}
