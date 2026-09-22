/**
 * **Το route slice του `/offers/mandate/new` — ΕΝΑ σημείο, για ΚΑΘΕ κλάδο της σελίδας.**
 *
 * 🔴 ΓΙΑΤΙ ΔΙΚΟ ΤΟΥ MODULE (ίδια κλάση με το `mandate-consent-route-slice.ts`,
 * εντοπισμένη 2026-09-22): η καταχώρηση ζούσε μέσα στο `MandateRequestFormContent`.
 * Όταν η πράξη κλείνει, η σελίδα αποδίδει **μόνο** το `MandateUnavailableNotice` —
 * και τα `mandate.request.*` του `MandateRequestOutcomeNotice` ζουν **μόνο** σε αυτό
 * το slice (όχι στο κέλυφος) ⇒ ωμά στο HTML του server. Το slice ανήκει στη
 * **διαδρομή**· κάθε κλάδος το εισάγει από εδώ. Φρουρός της κλάσης:
 * `src/i18n/__tests__/route-slice-branch-ownership.test.ts`.
 *
 * ⚠️ Στατική εισαγωγή, εμβέλεια module, ποτέ από το `page.tsx` (Server Component —
 * άλλος γράφος module): ADR-744 §18. Idempotent — εκτελείται μία φορά.
 */
import routeSlice from '@/i18n/generated/routes/offers__mandate__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);
