'use client';

// =============================================================================
// 🔐 LOGIN PAGE - AUTHENTICATION ENTRY POINT
// =============================================================================
// 🏢 ENTERPRISE: Now in (auth) route group for lightweight provider stack
// Pattern: SAP, Salesforce, Microsoft - Auth pages don't need full app providers
//
// Benefits of Route Group placement:
// - ~40-50% faster compilation (fewer providers to analyze)
// - No Firestore queries on login page
// - Minimal bundle for unauthenticated users
//
// @file (auth)/login/page.tsx
// @created 2026-01-27
// @enterprise ADR-040 - Route Groups Performance Optimization

import { AuthForm } from '@/auth';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// Χωρίς αυτές τις δύο γραμμές το artifact υπάρχει, το manifest το υπογράφει, οι πύλες
// είναι πράσινες — και **κανείς δεν το φορτώνει ποτέ**: η θεραπεία μένει ΑΔΡΑΝΗΣ.
// ⚠️ ΠΟΤΕ `import()` (μετακινεί το ωμό κλειδί σε «ένα καρέ» και το κρύβει από το
// CHECK 3.51)· ΠΟΤΕ σε Server Component (ξεχωριστός γράφος module ⇒ γράφει σε άλλο
// στιγμιότυπο i18next)· η εισαγωγή του `route-slice` περνά από το `./config`, άρα ο
// bootstrap του i18next έχει τελειώσει όταν τρέξει η κλήση.
import routeSlice from '@/i18n/generated/routes/login.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export default function LoginPage() {
  // NOTE: No <main> here — το `(auth)/layout.tsx` παρέχει το <main> wrapper (ADR-777 §8.12)
  // This avoids nested <main> tags which cause HTML semantic issues.
  //
  // ⚠️ ΟΥΤΕ «γέμισε το παράθυρο και κεντράρισε» (ADR-797 ΦΑΣΗ Β). Το ΙΔΙΟ
  // `min-h-screen … items-center justify-center` δηλωνόταν **δύο φορές
  // εμφωλευμένα** — εδώ και στο `<main>` του layout — μετρημένο ζωντανά
  // 2026-08-25 ως δύο `min-height: 1122.5px` στην ίδια αλυσίδα. Η επανάληψη
  // δεν φαινόταν, γιατί δύο ταυτόσημες δηλώσεις δίνουν το ίδιο αποτέλεσμα·
  // φάνηκε μόλις ο διάδρομος έδωσε κάθετο κενό, οπότε η **δεύτερη** παρήγαγε
  // 48px κύλισης. Το κεντράρισμα ανήκει στο layout, μία φορά.
  return <AuthForm defaultMode="signin" />;
}
