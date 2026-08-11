'use client';

/**
 * **ΤΟ ΜΗ-ΑΠΟΚΛΕΙΣΤΙΚΟ ΦΥΛΛΟ ΠΥΘΜΕΝΑ** — και, στην ευρεία οθόνη, **η στήλη της λίστας**.
 *
 * ADR-777 Α3 · SPEC-777D §26.2/§26.3/§26.7 · NN/g «Bottom Sheets».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΕΝΑ DOM, ΔΥΟ ΔΙΑΤΑΞΕΙΣ — ΚΑΙ ΓΙ' ΑΥΤΟ ΤΟ «ΜΕΤΡΑΩ ΑΚΟΜΗ» ΔΕΝ ΚΟΣΤΙΖΕΙ ΤΙΠΟΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔑 **Η γεωμετρία και η συμπεριφορά είναι ΔΥΟ ερωτήματα, και τα απαντούν δύο μηχανισμοί.**
 *
 * | Ερώτημα | Ποιος απαντά | Πότε |
 * |---|---|---|
 * | «επικάλυψη ή στήλη;» | **CSS**, στο `md` | στο **πρώτο βάψιμο**, στον διακομιστή |
 * | «είναι ενεργές οι στάσεις, το πίσω κουμπί, το κλείδωμα κύλισης;» | **`useViewportClass`** | μετά τη μέτρηση |
 *
 * Αυτό **δεν** είναι δύο απαντήσεις στο ίδιο ερώτημα (ADR-749) — είναι δύο ερωτήματα με
 * **έναν** αριθμό: το `md` του Tailwind **είναι** το `MOBILE_BREAKPOINT`, και το κλειδώνει
 * άγκυρα που ρωτά το ίδιο το Tailwind (`ResultsSheet.layout.test.tsx`).
 *
 * 🔴 **ΓΙΑΤΙ Η ΓΕΩΜΕΤΡΙΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΕΙΝΑΙ ΣΕ JavaScript** — μετρημένο, όχι γούστο.
 * Το `useViewportClass` απαντά `measuring` στον διακομιστή και στο πρώτο καρέ, **επίτηδες**.
 * Αν η διάταξη κρεμόταν από αυτό, το `measuring` θα όφειλε να διαλέξει: ό,τι κι αν διάλεγε,
 * **η μία από τις δύο μερίδες κοινού θα έβλεπε πλήρη αναδιάταξη** μετά την ενυδάτωση — και
 * η **Α19** ζητά **CLS < 0,1**, όριο που μια εναλλαγή «στήλες ⇄ επικάλυψη» σπάει κατά τάξη
 * μεγέθους. Με τη γεωμετρία στο CSS, το `measuring` **δεν παράγει καμία διαφορά σχήματος**:
 * το CLS είναι μηδέν **εκ κατασκευής**, όχι επειδή ελπίζουμε ότι η μέτρηση προλαβαίνει.
 * Γι' αυτό και το χρώμιο του φύλλου (λαβή, κουμπιά) αποδίδεται **πάντα** και κρύβεται με
 * `md:hidden`: αν εμφανιζόταν μόλις επιβεβαιωνόταν το «στενή», θα έσπρωχνε το περιεχόμενο
 * προς τα κάτω — δηλαδή θα ξαναγεννούσε την ίδια μετατόπιση σε μικρογραφία.
 *
 * ⛔ **ΠΟΤΕ MODAL** (κανόνας 2). Δεν υπάρχει σκοτεινό στρώμα, δεν υπάρχει παγίδα εστίασης,
 * δεν υπάρχει κλείδωμα κύλισης. Το δοχείο είναι `pointer-events-none` και **μόνο** η ορατή
 * επιφάνεια το ξαναανάβει, ώστε ο χάρτης να **σέρνεται από το κενό** πάνω από το φύλλο.
 * Γι' αυτό **δεν** χρησιμοποιείται το `components/ui/sheet.tsx`: είναι Radix Dialog, δηλαδή
 * modal εξ ορισμού — και ακόμη και με `modal={false}` θα έδινε δύο καταστάσεις (ανοιχτό ή
 * κλειστό), ενώ ο **κανόνας 1** ζητά **τρεις**.
 */

import React, { useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSheetSnap } from '@/hooks/media/useSheetSnap';
import { useSheetBackDismiss } from '@/hooks/media/useSheetBackDismiss';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import {
  BOTTOM_SHEET_DISMISS_STOP,
  BOTTOM_SHEET_STOPS,
  BOTTOM_SHEET_STOP_ATTRIBUTE,
  stepStop,
  type BottomSheetStop,
} from '@/lib/layout/bottom-sheet-stops';

import styles from './ResultsSheet.module.css';

/**
 * Πού κάθεται η άγκυρα κάθε στάσης, **σε σχέση με τη στάση ηρεμίας**.
 *
 * ⚠️ Οι συμβολοσειρές είναι **γραμμένες ολόκληρες επίτηδες**: ο σαρωτής του Tailwind διαβάζει
 * **πηγαίο κείμενο**, άρα μια κλάση συναρμολογημένη σε χρόνο εκτέλεσης (πρότυπο συμβολοσειράς
 * με το όνομα της στάσης μέσα στην αγκύλη) **δεν θα παραγόταν ποτέ** — και η άγκυρα θα κόλλαγε
 * σιωπηλά στο `top: auto`, δηλαδή στη στάση ηρεμίας. Το φύλλο θα είχε **μία** στάση με τρεις
 * άγκυρες, και θα *έμοιαζε* σωστό.
 *
 * 🔴 **ΚΑΙ ΤΟ ΑΝΤΙΣΤΡΟΦΟ ΚΟΣΤΙΣΕ, ΜΕΣΑ ΣΕ ΑΥΤΟ ΤΟ ΣΧΟΛΙΟ.** Η πρώτη γραφή έδειχνε το λάθος
 * **γράφοντάς το** — και ο σαρωτής, που δεν ξεχωρίζει σχόλιο από κώδικα, παρήγαγε κανόνα με
 * ωμό `${…}` μέσα του: **το CSS build απέτυχε ολόκληρο** και η διαδρομή επέστρεφε **500**. Ίδιο
 * σχήμα με το `Κ7β` του CHECK 3.50, από την ανάποδη: εκεί ένα σχόλιο μετρήθηκε ως ζωντανός
 * κώδικας, εδώ **έγινε** ζωντανός κώδικας. **Μην γράφεις κλάση που δεν θέλεις να υπάρξει —
 * ούτε για να την απαγορεύσεις.**
 *
 * 🔑 Κανένας αριθμός δεν ζει εδώ — μόνο η **σχέση** «άγκυρα = στάση − ηρεμία», που είναι
 * η αριθμητική του ίδιου του μηχανισμού (βλ. `ResultsSheet.module.css`).
 */
/**
 * Η καταχώριση **στην ουρά ιστορικού** που ανήκει σε αυτό το φύλλο.
 *
 * ⚠️ Η συμβολοσειρά είναι **αμετάβλητη επίτηδες**: μέχρι τις 2026-08-11 ζούσε μέσα στο
 * `useSheetBackDismiss` ως μοναδικό, σταθερά γραμμένο κλειδί. Ο μηχανισμός απέκτησε δεύτερο
 * καταναλωτή (ο θεατής, ADR-777 §8.20), οπότε η **ταυτότητα** μετακόμισε στον καλούντα —
 * αλλά η τιμή έμεινε **ίδια χαρακτήρα προς χαρακτήρα**, ώστε η αλλαγή να είναι αποδεδειγμένα
 * χωρίς συνέπεια για ανοιχτές καρτέλες.
 */
const RESULTS_SHEET_HISTORY_KEY = '__resultsSheetExpanded';

const STOP_ANCHOR_CLASS: Readonly<Record<BottomSheetStop, string>> = {
  peek: 'top-0',
  half: 'top-[calc(var(--sheet-half)-var(--sheet-peek))]',
  full: 'top-[calc(var(--sheet-full)-var(--sheet-peek))]',
};

interface ResultsSheetProps {
  /** Η **μία** ερώτηση της οθόνης. Οδηγεί **συμπεριφορά**, ποτέ σχήμα. */
  readonly viewport: ViewportClass;
  readonly children: React.ReactNode;
}

export function ResultsSheet({ viewport, children }: ResultsSheetProps) {
  const { t } = useTranslation(['search-results']);
  const iconSizes = useIconSizes();

  const isSheet = viewport === 'narrow';
  const { scrollerRef, stop, snapTo } = useSheetSnap(isSheet);

  const dismiss = useCallback(() => snapTo(BOTTOM_SHEET_DISMISS_STOP), [snapTo]);
  useSheetBackDismiss({
    historyKey: RESULTS_SHEET_HISTORY_KEY,
    active: isSheet,
    expanded: stop !== BOTTOM_SHEET_DISMISS_STOP,
    dismiss,
  });

  const moreList = stepStop(stop, 1);
  const moreMap = stepStop(stop, -1);

  /**
   * 🔑 **Ο κανόνας του NN/g, ως κώδικας:** *«expands to take up the full page as the user
   * scrolls down the list»*. Όσο το φύλλο **δεν** είναι πλήρες, η εσωτερική κύλιση της
   * λίστας είναι κλειστή, οπότε η χειρονομία **αλυσιδώνει** στο δοχείο και **μεγαλώνει το
   * φύλλο**. Αν η λίστα κυλούσε από τη ματιά, το σύρσιμο θα διάβαζε αγγελίες μέσα σε μια
   * χαραμάδα τριών γραμμών — και οι τρεις στάσεις θα ήταν διακοσμητικές.
   *
   * 🔴 **ΚΡΙΝΕΤΑΙ ΜΟΝΟ Η ΣΤΑΣΗ, ΠΟΤΕ Η ΚΛΑΣΗ ΠΛΑΤΟΥΣ — και το έπιασε η άγκυρα Ζ4.**
   * Η πρώτη γραφή ρωτούσε `isSheet && stop !== 'full'`, οπότε το «μετράω ακόμη» παρήγαγε
   * **διαφορετική** συμβολοσειρά κλάσεων από το «στενή»: μια αλλαγή `overflow` που φτάνει
   * μετά την ενυδάτωση **προσθαφαιρεί μπάρα κύλισης**, δηλαδή στενεύει το περιεχόμενο και
   * μετατοπίζει κάθε κάρτα — ακριβώς το CLS που ολόκληρος ο σχεδιασμός απέφυγε. Τώρα η
   * κλάση μπαίνει **πάντα** και την ακυρώνει το `md:`, όπως κάθε άλλη διαφορά διάταξης εδώ:
   * **καμία** γεωμετρική απόφαση δεν περιμένει τη μέτρηση.
   */
  const holdInnerScroll = stop !== 'full';

  /**
   * **Η αναφορά της συμπεριφοράς** — τρεις ειλικρινείς απαντήσεις, ποτέ δύο.
   *
   * ⚠️ Η πρώτη γραφή έλεγε `isSheet ? stop : 'column'`, δηλαδή στον διακομιστή ανέφερε
   * **«στήλη»** ενώ **δεν είχε μετρήσει τίποτα**: η ίδια σύμπτυξη του «δεν ξέρω» στο
   * «ευρεία» που γέννησε εξαρχής το `useViewportClass`, αναπαραγμένη ένα επίπεδο πιο κάτω.
   * Το είδε η **ζωντανή** επαλήθευση, διαβάζοντας `column` στο SSR **κάθε** συσκευής —
   * καμία σουίτα δεν το έπιασε, γιατί καμία δεν ρωτούσε «τι λες όταν δεν ξέρεις;».
   *
   * 🔑 Δεν αλλάζει **τίποτα** γεωμετρικό (Ζ4): είναι αναφορά, όχι απόφαση.
   */
  const reportedState = viewport === 'measuring' ? 'measuring' : isSheet ? stop : 'column';

  return (
    <div
      ref={scrollerRef}
      data-sheet-state={reportedState}
      className={cn(
        styles.scroller,
        // ΣΤΕΝΗ — επικάλυψη πάνω στον χάρτη· η κύλιση ΕΙΝΑΙ η χειρονομία του φύλλου.
        // Το `z-10` είναι **τοπική** στρώση (κάτω από το `GLOBAL_LAYER_FLOOR` του CHECK 3.50):
        // το φύλλο δεν διεκδικεί τίποτα από το κέλυφος — μόνο τη σειρά μέσα στο κουτί του,
        // όπου η λίστα διαβάζεται πρώτη αλλά βάφεται δεύτερη.
        'pointer-events-none absolute inset-0 z-10 snap-y snap-mandatory overflow-y-scroll overscroll-y-contain',
        // ΕΥΡΕΙΑ — απλή στήλη πλέγματος: καμία επικάλυψη, καμία στάση, καμία κύλιση εδώ.
        'md:pointer-events-auto md:static md:z-auto md:snap-none md:overflow-hidden md:border-r md:border-border'
      )}
    >
      {/*
        ΟΙ ΤΡΕΙΣ ΣΤΑΣΕΙΣ — ένα εικονοστοιχείο η καθεμία, χωρίς περιεχόμενο και χωρίς φωνή.
        Δεν είναι «σημάδια θέσης»: είναι **οι θέσεις**. Η `scroll-snap-align: start` τις
        προσγειώνει στην κορυφή του δοχείου, και το `offsetTop` τους είναι η **ίδια** τιμή
        που διαβάζει ο ελεγκτής — γι' αυτό δεν υπάρχει πίνακας ποσοστών πουθενά.
      */}
      {BOTTOM_SHEET_STOPS.map((anchorStop) => (
        <i
          key={anchorStop}
          aria-hidden="true"
          {...{ [BOTTOM_SHEET_STOP_ATTRIBUTE]: anchorStop }}
          className={cn('absolute h-px w-px snap-start md:hidden', STOP_ANCHOR_CLASS[anchorStop])}
        />
      ))}

      {/*
        ΤΟ ΔΙΑΚΕΝΟ — εδώ φαίνεται και **σέρνεται** ο χάρτης. Δεν είναι κενό στοιχείο για
        απόσταση: είναι η **απόδειξη** του κανόνα 2. Το ύψος του παράγεται από τη στάση
        ηρεμίας, ώστε το `scrollTop = 0` να ισούται με «ματιά» χωρίς καμία αρχική κύλιση.
      */}
      <div aria-hidden="true" className="h-[calc(100%-var(--sheet-peek))] md:hidden" />

      <section
        aria-label={t('search-results:sheet.label')}
        className={cn(
          'pointer-events-auto flex h-[var(--sheet-full)] flex-col overflow-hidden',
          'rounded-t-2xl border-x border-t border-border bg-card shadow-lg',
          'md:h-full md:rounded-none md:border-0 md:bg-background md:shadow-none',
          // Το `md:` σκέλος είναι **υποχρεωτικό**, όχι διακόσμηση: στη στήλη του desktop δεν
          // υπάρχουν στάσεις, και μια λίστα που δεν κυλά εκεί θα ήταν απλώς κομμένη.
          holdInnerScroll &&
            '[&_[data-list-scroll]]:overflow-y-hidden md:[&_[data-list-scroll]]:overflow-y-auto'
        )}
      >
        <header className="relative flex shrink-0 items-center justify-end gap-1 px-2 py-2 md:hidden">
          {/*
            Η λαβή είναι **σήμα, όχι χειριστήριο** — γι' αυτό είναι `aria-hidden`. Ο κανόνας 3
            του NN/g το λέει ρητά: *«grab handles are easy to ignore… accessibility requires
            visible, tappable dismiss options»*. Τα κουμπιά δίπλα της **δεν** είναι εφεδρεία
            της: είναι ο **μόνος** τρόπος που φτάνει και στις τρεις στάσεις όποιος δεν σέρνει.
          */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={moreMap === null}
            onClick={() => moreMap && snapTo(moreMap)}
            aria-label={t('search-results:sheet.moreMap')}
          >
            <ChevronDown className={iconSizes.sm} aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={moreList === null}
            onClick={() => moreList && snapTo(moreList)}
            aria-label={t('search-results:sheet.moreList')}
          >
            <ChevronUp className={iconSizes.sm} aria-hidden="true" />
          </Button>
        </header>

        {children}
      </section>
    </div>
  );
}
