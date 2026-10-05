'use client';

/**
 * **`/engagements` — «Οι υποθέσεις μου», στον ΠΡΟΣΩΠΙΚΟ χώρο** (ADR-901 §15 Γ2 · Ε-9 = α · ADR-862 Φ1).
 *
 * Το **προσωρινό** σπίτι (Α1): όσες υποθέσεις ανέλαβε ο άνθρωπος **χωρίς** γραφείο, και κάθε πρόταση που περιμένει
 * απάντηση. Όσες ανέλαβε για γραφείο ζουν στο `/o/<γραφείο>/cases` — **η ίδια** σελίδα-περιεχόμενο
 * ({@link MyCasesContent}), άλλο κέλυφος.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός μέσα στη
 *    σελίδα (CHECK 3.52). Το `<main>` δηλώνεται **εδώ**: οι σελίδες του `(me)` κατέχουν το δικό τους ορόσημο, ενώ στο
 *    `(app)` το δίνει το κέλυφος — γι' αυτό δεν ζει μέσα στο κοινό περιεχόμενο.
 * 🔴 Ζούσε στο `/cases` και μετακόμισε: το τμήμα ανήκει πλέον στον χώρο του γραφείου (Κ3 της CHECK 3.60 — ένα
 *    τμήμα, ένας ιδιοκτήτης). Δες `lib/conveyance/conveyance-routes.ts`.
 * 🔑 `use client` **για το slice** (ADR-744 §15 · §18): το route slice δένεται με τη **σελίδα**, και η σελίδα-περιεχόμενο
 *    υπηρετεί δύο κελύφη — άρα το καταχωρεί το κέλυφος. Σε Server Component η εγγραφή θα έγραφε σε **άλλο**
 *    στιγμιότυπο i18next (πράσινη κλήση που δεν κάνει τίποτα).
 *
 * @module app/(me)/engagements/page
 */

import { MyCasesContent } from '@/components/conveyance/my-cases/MyCasesContent';
import routeSlice from '@/i18n/generated/routes/engagements.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export default function PersonalCasesPage() {
  return (
    <main className="w-full">
      <MyCasesContent home="personal" />
    </main>
  );
}
