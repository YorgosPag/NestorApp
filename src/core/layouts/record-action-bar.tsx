'use client';
/**
 * @fileoverview **Η κάτω μπάρα ενεργειών της σελίδας εγγραφής** — πού αποδίδει τις ενέργειές της η κεφαλίδα μιας
 *   σελίδας εγγραφής (κεφαλίδα με `media`) όταν η οθόνη είναι στενή, και πού **συνεισφέρει** η ενεργή καρτέλα.
 * @related ADR-912 §12.13 · §12.14 · ADR-777 §8.87.11 · `core/entity-headers/RecordHeaderActions.tsx` (ο καταναλωτής) ·
 *   `details-sheet-actions.tsx` (το ίδιο σχήμα για το φύλλο κινητού) · `tab-activity.tsx`
 * @module core/layouts/record-action-bar
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390×844)**: στη σελίδα ακινήτου τέσσερα κουμπιά σε τρεις γραμμές
 *   κάτω από την τιμή ⇒ ~130px πριν από τις καρτέλες, και οι ενέργειες στο πάνω μισό της οθόνης, μακριά από τον αντίχειρα.
 * 🔑 **Πρακτική**: Material 3 *bottom app bar* (κινητό, 2–5 ενέργειες) · Salesforce mobile *action bar* στο κάτω μέρος
 *   της εγγραφής. Η κεφαλίδα **δηλώνει**, η μπάρα **αποδίδει** (portal — ΕΝΑ αντίτυπο στο DOM), όπως στο ADR-912 §12.1.
 * 🔑 **`sticky bottom-0` ως ΤΕΛΕΥΤΑΙΟ παιδί της σελίδας, όχι `fixed`**: κρατά μόνη της τον χώρο της στο τέλος της
 *   ροής (κανένα μαντεμένο `padding-bottom` για να μη σκεπαστεί το τελευταίο στοιχείο) και δεν σπάει μέσα σε πρόγονο
 *   με `container-type`/`transform` (ADR-797 §3.1). Κενή ⇒ κρυμμένη, δεν πιάνει ούτε pixel.
 * 🔑 **Πλωτή, μέσα στον διάδρομο του κελύφους** (Material 3 Expressive *floating toolbar*, που διαδέχεται το bottom
 *   app bar): όχι `-mx-*` για να φτάσει τις άκρες — ο διάδρομος ανήκει στο κέλυφος (ADR-797, CHECK 3.63).
 * 🔑 **`null` = η σελίδα δεν έχει μπάρα· `{ host: null }` = έχει, αλλά δεν έχει ζωγραφιστεί ακόμη.**
 *
 * 🔑 **Η κύρια ενέργεια ανήκει στην ΚΑΡΤΕΛΑ που βλέπεις** (ADR-912 §12.14). Στα «Έγγραφα» ο άνθρωπος ήρθε να
 *   προσθέσει αρχείο, όχι να επεξεργαστεί το ακίνητο. Material 3: η docked toolbar έχει *ενσωματωμένη κύρια ενέργεια
 *   αντί για FAB* — άρα **ΕΝΑ** σημείο ενεργειών, όχι δεύτερο πλωτό κουμπί που σκεπάζει περιεχόμενο (Drive).
 *   Η καρτέλα **διεκδικεί** τη θυρίδα `lead` (`RecordActionLead`)· η κεφαλίδα το βλέπει και συμπτύσσει τις δικές της
 *   στο «⋯». Ίδιο σχήμα με το `claimDismissal` του φύλλου.
 * 🔑 **Η επεξεργασία υπερισχύει**: όσο η κεφαλίδα έχει ανοιχτή συνεδρία (ενέργεια `dismisses`), η «Αποθήκευση» δεν
 *   πάει ποτέ στο μενού — η καρτέλα αποδίδει τη συνεισφορά της επιτόπου.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useViewportClass } from '@/hooks/media/useViewportClass';
import { cn } from '@/lib/utils';

import { useTabIsActive } from './tab-activity';

export interface RecordActionBarSlot {
  /** Το στοιχείο της μπάρας όπου μπαίνουν οι ενέργειες της κεφαλίδας· `null` ώσπου να στηθεί. */
  readonly host: HTMLElement | null;
  /** Η θυρίδα της κύριας ενέργειας της ενεργής καρτέλας (δεξιά, στον αντίχειρα)· `null` ώσπου να στηθεί. */
  readonly leadHost: HTMLElement | null;
  /** Κάποια καρτέλα αποδίδει **τώρα** την κύρια ενέργειά της στη μπάρα. */
  readonly leadClaimed: boolean;
  /** Η κεφαλίδα έχει ανοιχτή συνεδρία επεξεργασίας ⇒ καμία καρτέλα δεν παίρνει τη θέση της. */
  readonly sessionActive: boolean;
  /** Η καρτέλα διεκδικεί τη θυρίδα· επιστρέφει την αποδέσμευση. Σταθερή ταυτότητα, ασφαλές σε διπλό effect. */
  readonly claimLead: () => () => void;
  /** Η κεφαλίδα δηλώνει αν έχει ανοιχτή συνεδρία επεξεργασίας. Σταθερή ταυτότητα. */
  readonly claimSession: (active: boolean) => void;
}

const RecordActionBarContext = createContext<RecordActionBarSlot | null>(null);

/** `null` ⇒ η σελίδα δεν προσφέρει κάτω μπάρα και η κεφαλίδα αποδίδει τις ενέργειές της επιτόπου. */
export function useRecordActionBar(): RecordActionBarSlot | null {
  return useContext(RecordActionBarContext);
}

/** Μετρητής, όχι σημαία: δύο διεκδικήσεις που αλληλεπικαλύπτονται (StrictMode · αλλαγή καρτέλας) δεν σβήνουν η μία την άλλη. */
function useLeadClaims(): readonly [boolean, () => () => void] {
  const [claims, setClaims] = useState(0);
  const claimLead = useCallback(() => {
    setClaims((count) => count + 1);
    return () => setClaims((count) => count - 1);
  }, []);
  return [claims > 0, claimLead] as const;
}

/**
 * Τυλίγει το περιεχόμενο μιας σελίδας εγγραφής και βάζει την μπάρα **στο τέλος** του. Ο πρόγονος πρέπει να είναι το
 * στοιχείο που κυλά μαζί με τη σελίδα (εδώ το `<main>`), αλλιώς το `sticky` κολλά στο λάθος κουτί.
 */
export function RecordActionBarProvider({ children }: { readonly children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [leadHost, setLeadHost] = useState<HTMLElement | null>(null);
  const [sessionActive, claimSession] = useState(false);
  const [leadClaimed, claimLead] = useLeadClaims();
  const slot = useMemo<RecordActionBarSlot>(
    () => ({ host, leadHost, leadClaimed, sessionActive, claimLead, claimSession }),
    [host, leadHost, leadClaimed, sessionActive, claimLead],
  );
  return (
    <RecordActionBarContext.Provider value={slot}>
      {children}
      <footer
        data-record-action-bar=""
        className={cn(
          'sticky bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[var(--z-index-sticky)]',
          'flex items-center gap-2 rounded-xl border bg-background p-2 shadow-lg',
          // Δύο θυρίδες, μία μπάρα: κρυμμένη όσο ΚΑΙ οι δύο είναι κενές.
          '[&:not(:has(>:not(:empty)))]:hidden',
        )}
      >
        <div ref={setHost} data-record-action-bar-record="" className="min-w-0 flex-1 empty:hidden" />
        <div ref={setLeadHost} data-record-action-bar-lead="" className="shrink-0 empty:hidden" />
      </footer>
    </RecordActionBarContext.Provider>
  );
}

/** Στενή οθόνη, ενεργή καρτέλα, χωρίς συνεδρία επεξεργασίας ⇒ η συνεισφορά της καρτέλας ζει στη μπάρα. */
function LeadWithBar({ bar, children }: { readonly bar: RecordActionBarSlot; readonly children: ReactNode }) {
  const viewport = useViewportClass();
  const tabIsActive = useTabIsActive();
  const docked = viewport === 'narrow' && tabIsActive && !bar.sessionActive;
  const { claimLead } = bar;
  useEffect(() => (docked ? claimLead() : undefined), [docked, claimLead]);

  // Ούτε επιτόπου ούτε στη μπάρα για ένα καρέ: αλλιώς στο κινητό το κουμπί θα εμφανιζόταν και θα μετακόμιζε.
  if (viewport === 'measuring') return null;
  if (viewport === 'wide' || bar.sessionActive) return <>{children}</>;
  // Κρυμμένη καρτέλα: τίποτα — ούτε στη μπάρα (θα έμενε εκεί σε άλλη καρτέλα) ούτε επιτόπου (δεν φαίνεται έτσι κι αλλιώς).
  if (!tabIsActive) return null;
  return bar.leadHost ? createPortal(children, bar.leadHost) : null;
}

/**
 * **Η κύρια ενέργεια μιας καρτέλας** (π.χ. «+ Προσθήκη Αρχείων»). Στη σελίδα εγγραφής, σε στενή οθόνη, αποδίδεται στη
 * κάτω μπάρα· παντού αλλού επιτόπου, ακριβώς όπου τη γράφει η καρτέλα. Δέχεται **οποιοδήποτε** στοιχείο — και μενού
 * που ανοίγει φύλλο — γιατί μετακομίζει ολόκληρο, με τους διαλόγους του.
 */
export function RecordActionLead({ children }: { readonly children: ReactNode }) {
  const bar = useRecordActionBar();
  return bar ? <LeadWithBar bar={bar}>{children}</LeadWithBar> : <>{children}</>;
}
