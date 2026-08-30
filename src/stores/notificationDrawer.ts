// stores/notificationDrawer.ts
/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ «ΑΝΟΙΧΤΟΣ / ΚΛΕΙΣΤΟΣ» του συρταριού ειδοποιήσεων.**
 * @related ADR-834 §6 Φάση Α · stores/notificationCenter.ts *(το αδελφό)*
 * @module stores/notificationDrawer
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ `NotificationDrawer.enterprise.tsx` (2026-08-30)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ζούσε **μέσα** στο component του συρταριού — πέντε γραμμές κατάστασης μέσα σε
 * αρχείο 400+ γραμμών που εισάγει `useAuth` → `AuthContext` → **firebase/auth**.
 *
 * ⇒ **Όποιος ήθελε μόνο τον διακόπτη, φόρτωνε ΟΛΟΚΛΗΡΟ το συρτάρι.** Το
 * καμπανάκι θέλει ακριβώς αυτό — να **ανοίγει** — και τίποτε άλλο· το ίδιο και το
 * `subapps/geo-canvas/components/AlertManagementPanel.tsx`.
 *
 * 🔑 **Το ελάττωμα ΔΕΝ ήταν θεωρητικό: το μέτρησε άγκυρα.** Μόλις το καμπανάκι
 * έγινε καθολική δυνατότητα (ADR-834), το `shell-utilities-identity.test.tsx`
 * **κοκκίνισε** — η αλυσίδα `ShellUtilities → NotificationBell →
 * NotificationDrawer → useAuth → firebase/auth` έσπασε σε περιβάλλον δοκιμής που
 * δεν έχει δουλειά με το Firebase. Η εύκολη «λύση» θα ήταν ένα mock στην άγκυρα —
 * δηλαδή **απόκρυψη της σύζευξης** αντί για διόρθωσή της.
 *
 * ⚠️ **ΜΗΝ το γυρίσεις πίσω μέσα στο component.** Η κατάσταση ενός overlay είναι
 * **καθολική** (ποιος το άνοιξε, από πού) και οι καταναλωτές της είναι **τρεις**:
 * ο διακόπτης *(καμπανάκι)*, η επιφάνεια *(συρτάρι)* και το geo-canvas. Κανένας
 * τους δεν πρέπει να πληρώνει τους άλλους δύο.
 *
 * 🔑 Ίδια θέση και ίδιο ιδίωμα με το {@link useNotificationCenter} — το store που
 * κρατά τα **περιεχόμενα**. Δύο ερωτήματα, δύο stores: *«τι υπάρχει;»* και
 * *«φαίνεται;»*.
 */

import { create } from 'zustand';

export type DrawerState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const useNotificationDrawer = create<DrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
