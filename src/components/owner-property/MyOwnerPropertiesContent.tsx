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
import Link from 'next/link';

import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
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
    </main>
  );
}
