'use client';

/**
 * @fileoverview **ΤΟ ΣΚΑΛΙ ΑΠΟΚΑΛΥΨΗΣ** — τι βλέπει ο επισκέπτης **πριν** ζητήσει 3Δ.
 * @related ADR-845 §7.6 (Φ4.3) · ADR-777 Α19 κανόνας 30 · ADR-841 §6
 * @module components/listing-detail/ListingModelStage
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΕΙΚΟΝΑ-ΑΦΙΣΑ, ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ **ΔΕΝ** ΕΙΝΑΙ ΕΚΠΤΩΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επίσημη οδηγία της Google θέλει `poster` — και **έχει δίκιο**. Εμείς όμως **δεν έχουμε
 * αφίσα**: το `PublishedModelFile` είναι `{ url, altKey }`, τίποτε άλλο *(ADR-845 §7.3)*.
 *
 * ⛔ **Και ΔΕΝ βάζουμε ψεύτικη.** Η κορυφαία φωτογραφία της αγγελίας θα «γέμιζε» το κουτί,
 * αλλά θα έλεγε **ψέματα για το τι είναι το αρχείο** — ίδιο ακριβώς επιχείρημα με το
 * `detail.media.absent` *(«δεν βάζουμε ξένη φωτογραφία στη θέση της: θα έδειχνε άλλο
 * ακίνητο και θα διαβαζόταν ως αυτό»)*.
 *
 * 🔑 **Ο κανόνας 30 του ADR-777 Α19 ΤΗΡΕΙΤΑΙ**: *«κάτι ΑΛΗΘΙΝΟ ζωγραφίζεται στο πρώτο
 * καρέ· κενό με spinner ΔΕΝ είναι πρώτος καρές»*. Μια **ονομασμένη κάρτα εισόδου** — που
 * λέει τι υπάρχει και τι θα γίνει αν την πατήσεις — **είναι** αληθινή. Spinner δεν θα ήταν.
 *
 * ✅ **Και έχει και μετρήσιμο κέρδος**: κανένα νέο στοιχείο δεν διεκδικεί το **LCP**, που
 * μένει η κορυφαία φωτογραφία *(Α2.4)*. Το ερώτημα *«πώς δεν χαλάμε το LCP με 3Δ;»*
 * απαντιέται **με αφαίρεση** αντί για ρύθμιση.
 *
 * 🔶 Η αφίσα ανοίγει ως **Ο-12** — δες ADR-845 §9 για το γιατί το `toDataURL()` τη στιγμή
 * της δημοσίευσης είναι **εξυπνότερο** από το headless Chrome των μεγάλων.
 */

import dynamic from 'next/dynamic';
import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

// ⛔ **ΑΠΟ ΤΟ ΑΡΧΕΙΟ ΧΩΡΙΣ ΠΑΡΕΝΕΡΓΕΙΕΣ, ΠΟΤΕ ΑΠΟ ΤΟΝ ΚΑΜΒΑ.** Ένα στατικό `import` από το
//    `ListingModelCanvas` θα έσερνε το `model-viewer.min.js` (1.068.903 bytes) στο **ΙΔΙΟ**
//    κομμάτι με αυτό το αρχείο — το `dynamic()` από κάτω θα έμενε, θα φαινόταν σωστό, και το
//    megabyte θα κατέβαινε σε **κάθε** επισκέπτη. Δες την κεφαλίδα του `…-stage-metrics`.
import { MODEL_STAGE_ASPECT_CLASS } from './listing-model-stage-metrics';

/** Κοινό περίγραμμα και για τις τρεις καταστάσεις ⇒ **καμία** μετατόπιση στην εναλλαγή. */
const STAGE_BOX = `flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-4 text-center ${MODEL_STAGE_ASPECT_CLASS}`;

/**
 * ⛔ **`ssr: false` ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ, ΟΧΙ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ**: το `<model-viewer>` δηλώνει
 * custom element πάνω στο `window.customElements` τη στιγμή που φορτώνει το module. Σε
 * απόδοση διακομιστή δεν υπάρχει `window` ⇒ η σελίδα θα **έσκαγε** στην παραγωγή.
 *
 * 🔑 **ΚΑΙ ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΚΕΡΔΙΖΟΝΤΑΙ ΤΑ BYTES**: επειδή ο κόμβος αποδίδεται **μόνο**
 * αφού ο άνθρωπος πατήσει, το κομμάτι του megabyte **δεν ζητιέται ποτέ** από επισκέπτη που
 * δεν ζήτησε 3Δ. Είναι αυστηρότερο από το `reveal="interaction"` της Google, που κατεβάζει
 * τη βιβλιοθήκη ούτως ή άλλως.
 */
const ListingModelCanvas = dynamic(() => import('./ListingModelCanvas'), {
  ssr: false,
  // ⚠️ **ΕΔΩ ΕΠΙΤΡΕΠΕΤΑΙ ΤΟ «ΦΟΡΤΩΝΕΙ», ΚΑΙ ΜΟΝΟ ΕΔΩ**: ο κανόνας 30 απαγορεύει κενό με
  //    spinner ως **πρώτο καρέ**· αυτό δεν είναι πρώτο καρές, είναι η απάντηση σε **πράξη
  //    του ανθρώπου** — και το κομμάτι είναι ~1 MB, δηλαδή δευτερόλεπτα σε αδύναμο δίκτυο.
  //    Σιωπή εδώ θα διαβαζόταν ως «το κουμπί δεν δούλεψε».
  loading: () => <StageLoading />,
});

type StageState = 'idle' | 'revealed' | 'failed';

interface ListingModelStageProps {
  readonly src: string;
  readonly alt: string;
}

export function ListingModelStage({ src, alt }: ListingModelStageProps) {
  const [state, setState] = React.useState<StageState>('idle');
  const onFailed = React.useCallback(() => setState('failed'), []);
  const onReveal = React.useCallback(() => setState('revealed'), []);

  if (state === 'revealed') {
    return <ListingModelCanvas src={src} alt={alt} onFailed={onFailed} />;
  }
  if (state === 'failed') {
    return <StageFailure onRetry={onReveal} />;
  }
  return <StageInvitation alt={alt} onReveal={onReveal} />;
}

/**
 * Η κάρτα εισόδου — **αληθινό περιεχόμενο στο πρώτο καρέ**.
 *
 * ⚠️ Το `alt` μπαίνει ως ορατό κείμενο **επίτηδες**: είναι η ίδια πρόταση που θα άκουγε ο
 * αναγνώστης οθόνης μέσα στον καμβά, και το **VoiceOver σε iOS δεν τη διαβάζει ποτέ εκεί**
 * *(αγνοεί το `canvas`)*. Εδώ τη διαβάζει **κάθε** αναγνώστης, σε **κάθε** συσκευή.
 */
function StageInvitation({ alt, onReveal }: { readonly alt: string; readonly onReveal: () => void }) {
  const { t } = useTranslation(['listing-detail']);

  return (
    <button type="button" onClick={onReveal} className={`${STAGE_BOX} hover:bg-accent`}>
      <span className="text-sm text-muted-foreground">{alt}</span>
      <span className="text-sm font-medium text-foreground underline underline-offset-4">
        {t('listing-detail:model.reveal')}
      </span>
    </button>
  );
}

/** Το διάστημα ανάμεσα στο κλικ και στην άφιξη του κομματιού — **με όνομα**, ποτέ κενό. */
function StageLoading() {
  const { t } = useTranslation(['listing-detail']);

  return (
    <section className={STAGE_BOX} aria-live="polite">
      <p className="text-sm text-muted-foreground">{t('listing-detail:model.loading')}</p>
    </section>
  );
}

/**
 * Η ονομασμένη αποτυχία.
 *
 * ⛔ **Ποτέ σιωπηλό κενό**: ένα μοντέλο που δεν φόρτωσε και **δεν το λέει** διαβάζεται ως
 * *«αυτό το ακίνητο δεν έχει μοντέλο»* — δηλαδή η οθόνη λέει ψέματα για τα δεδομένα. Είναι
 * η ίδια κλάση με το ADR-844 §1, όπου *«κάτι πήγε στραβά»* αντικαταστάθηκε από αιτία.
 */
function StageFailure({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useTranslation(['listing-detail']);

  return (
    <section className={STAGE_BOX} aria-live="polite">
      <p className="text-sm text-muted-foreground">{t('listing-detail:model.failed')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm font-medium text-foreground underline underline-offset-4"
      >
        {t('listing-detail:model.retry')}
      </button>
    </section>
  );
}
