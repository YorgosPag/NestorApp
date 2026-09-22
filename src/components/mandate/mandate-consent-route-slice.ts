/**
 * **Το route slice του `/mandate/[token]` — ΕΝΑ σημείο, για ΚΑΘΕ κλάδο της σελίδας.**
 *
 * 🔴 ΓΙΑΤΙ ΔΙΚΟ ΤΟΥ MODULE (CHECK 3.51 Χ, μετρημένο 2026-09-22, run `35715370312`):
 * η καταχώρηση ζούσε μέσα στο `MandateConsentContent`. Ένα client module εκτελείται
 * στο SSR **μόνο αν αποδοθεί** — και όταν ο σύνδεσμος απορρίπτεται αποδίδεται το
 * `MandateConsentRefusal`, οπότε ο server έστελνε ωμό `mandate.consent.reason.*`
 * **ενώ το κλειδί ήταν μέσα στο slice**. Το slice ανήκει στη **διαδρομή**· κάθε κλάδος
 * το εισάγει από εδώ (`import './mandate-consent-route-slice'`). Φρουρός της κλάσης:
 * `src/i18n/__tests__/route-slice-branch-ownership.test.ts`.
 *
 * 🔴 **ΟΧΙ στο `page.tsx`**: εκείνο είναι Server Component, και τα Server/Client δέντρα
 * έχουν **ξεχωριστούς γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
 * στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
 *
 * ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** (ADR-744 §18) — με `import()` το ωμό κλειδί
 * απλώς μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51. Η καταχώρηση είναι
 * idempotent (deep merge, χωρίς overwrite), και το module εκτελείται μία φορά.
 */
import routeSlice from '@/i18n/generated/routes/mandate__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);
