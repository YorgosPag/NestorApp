'use client';

/**
 * @fileoverview **«ΑΝΕΒΑΣΕ Ο,ΤΙ ΕΧΕΙΣ»** — φωτογραφίες και σχέδια (Α14).
 * @related ADR-777 §7 (Α14 · Α19 κανόνας 31) · ADR-842 §7.6.8 (πώς λέγεται το σχέδιο
 *   ανά είδος) · hooks/owner-property/useOwnerPropertyMedia
 * @module components/owner-property/form/OwnerPropertyMediaField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΠΟΦΑΣΗ ΤΗΣ Α14, ΚΑΤΑ ΛΕΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *«Όχι μόνο μια ξερή κάτοψη … να ανεβάζει φωτογραφίες, κατόψεις, **ό,τι έχει**,
 * > **αλλά να συμπληρώνει και φόρμα με δεδομένα** … Αλλά **δεν θα επιβάλουμε στον
 * > χρήστη να γίνει ειδικός του κλάδου**.»*
 *
 * Άρα το ανέβασμα είναι **προαιρετικό** και τα **πεδία** είναι ο πυρήνας (§17.1:
 * *«ακίνητο χωρίς πεδία είναι αόρατο στη μηχανή ταιριάσματος»*). Ένα υποχρεωτικό
 * αρχείο θα ήταν φράγμα σε ακριβώς αυτό που η Α14 άνοιξε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΙΔΙΩΤΙΚΑ ΕΞ ΟΡΙΣΜΟΥ — ΔΗΜΟΣΙΑ **ΜΟΝΟ ΜΕ ΠΡΑΞΗ** (ADR-841 §7 Α2.7)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **κανόνας 31** (Α19) απαγορεύει ρητά την εικόνα χρήστη ως **πρώτο καρέ**:
 * *«παράγεται ΑΠΟ ΤΟ ΜΟΝΤΕΛΟ, ποτέ από ανέβασμα χρήστη — αλλιώς **μπορεί να πει
 * ψέματα**»*. Ο κανόνας **δεν κάμπτεται**: το `PublicListing.coverImage` παραμένει
 * `null` μέχρι να υπάρξει ο παραγωγός του (Φ4).
 *
 * 🔑 **Αυτό που άλλαξε στη Φ3 είναι ότι γεννήθηκε ΔΕΥΤΕΡΗ ΕΡΩΤΗΣΗ**, με δικό της πεδίο:
 * το `gallery` — *«τι **ΔΕΙΧΝΕΙ** ο κάτοχος;»* απέναντι στο *«τι **ΕΙΝΑΙ** το κτίριο;»*.
 * Δύο πεδία, δύο παραγωγοί, κανένα ψέμα (Α2.6).
 *
 * 🔴 **Η ΕΠΙΛΟΓΗ ΕΙΝΑΙ OPT-IN, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΟΥΔΕΤΕΡΗ ΠΡΟΤΙΜΗΣΗ** (Α2.7): κάθε αρχείο
 * που ανέβηκε **πριν** από σήμερα το έκανε κάτω από **γραπτή** υπόσχεση ιδιωτικότητας.
 * Ένα opt-out θα άλλαζε **αναδρομικά** εκείνο το συμβόλαιο και θα δημοσίευε την
 * ταυτότητα που ανέβηκε **κατά λάθος**.
 *
 * 🔑 **Και η οθόνη το δηλώνει** (`media.privateNote`), αντί να το υπονοήσει — με το
 * κείμενο **αλλαγμένο μαζί με τον κώδικα**. Μια οθόνη που υπόσχεται *«δεν
 * δημοσιεύονται»* δίπλα σε ένα κουτάκι «δημοσίευση» δεν είναι απλώς μπαγιάτικη: είναι
 * **ψέμα σε ενεργή οθόνη**.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FormFieldset } from '@/components/shared/forms/form-field-primitives';
import { isLandProperty } from '@/constants/property-classification';
import { useOwnerPropertyMedia } from '@/hooks/owner-property/useOwnerPropertyMedia';
import { hasDraftIdentity } from '@/lib/forms/draft-identity';
import { AUTH_ROUTES } from '@/lib/routes';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import {
  isLeadOwnerMedia,
  publishedOwnerMedia,
  withOwnerMediaFirst,
} from '@/lib/owner-property/owner-media-publication';
import { OwnerPropertyMediaItem } from './OwnerPropertyMediaItem';

const NS = 'property-market';
const K = `${NS}:offer.media`;

export function OwnerPropertyMediaField({
  authorUserId,
  ownerPropertyId,
}: {
  authorUserId: string | null;
  ownerPropertyId: string;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<OwnerPropertyFormValues>();
  const inputId = React.useId();
  const { state, upload } = useOwnerPropertyMedia(authorUserId, ownerPropertyId);

  /**
   * 🔴 **ΕΝΑ ΜΗΝΥΜΑ, ΔΥΟ ΣΚΑΝΔΑΛΕΣ** (ADR-660 §5.9) — και οι δύο χρειάζονται.
   *
   * Η **πρώτη** είναι *προληπτική*: ο άνθρωπος το μαθαίνει **πριν** διαλέξει αρχείο,
   * όπως ακριβώς η φόρμα δείχνει «τι λείπει» χωρίς να περιμένει υποβολή (Α14 §17.2).
   * Η **δεύτερη** είναι το *fail-closed* του ίδιου του ανεβάσματος: αν η ταυτότητα
   * χαθεί **ανάμεσα** στην απόδοση και στην επιλογή αρχείου (λήξη συνεδρίας), η
   * προληπτική δεν έχει προλάβει να εμφανιστεί.
   *
   * ⚠️ **Ένα `<p>`, όχι δύο**: είναι το **ίδιο γεγονός**. Δύο μηνύματα που λένε το
   * ίδιο πράγμα διαβάζονται ως δύο διαφορετικά προβλήματα.
   */
  const accountMissing = !hasDraftIdentity(authorUserId) || state.state === 'accountRequired';

  /**
   * 🔴 **ΕΝΑ ΟΙΚΟΠΕΔΟ ΔΕΝ ΕΧΕΙ ΚΑΤΟΨΗ** — και το ήξεραν όλοι εκτός από αυτή τη γραμμή.
   *
   * Μετρημένο στην οθόνη (2026-09-03, `/offers/ownp_330a5a4b-…`): με είδος **Οικόπεδο**
   * το πεδίο ζητούσε *«φωτογραφίες, **κάτοψη**, PDF»*, ενώ **δύο κάρτες παρακάτω** ο
   * δείκτης πληρότητας έλεγε σωστά *«λείπει: **Τοπογραφικό διάγραμμα**»*. Δηλαδή η
   * απόφαση **υπήρχε** (`completionFieldLabelKey` · `LAND_LABELLED_FIELDS`, στο
   * `constants/field-completion-weights.ts`) και το ανέβασμα ήταν το **μόνο** σημείο
   * που δεν ρώτησε.
   *
   * 🔑 **Ο ΚΡΙΤΗΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΜΕ ΤΟΝ ΑΔΕΛΦΟ**, και είναι το νόημα: το
   * `OwnerBasicsFields` ρωτά **αυτό ακριβώς** το κατηγόρημα δύο πεδία πιο πάνω για να
   * πει «Εμβαδόν **οικοπέδου**». Ένα χειρόγραφο `type === 'plot' || type === 'parcel'`
   * εδώ θα ήταν η **τρίτη** αυθεντία για το «τι είναι γη» — και η τέταρτη τιμή γης θα
   * προστίθετο στη μία (`property-types.ts`, το ίδιο το σχόλιο του κατηγορήματος).
   *
   * ⚠️ **Ταξικό, όχι λίστα τιμών**: καλύπτει το «Αγροτεμάχιο» χωρίς δεύτερη γραμμή, και
   * μια τρίτη τιμή γης δωρεάν (`resolvedPropertyClassOf(…) === 'land'`).
   *
   * ✅ **ΚΑΛΥΠΤΕΙ ΚΑΙ ΤΗΝ ΩΜΗ ΠΑΛΑΙΑ ΤΙΜΗ** (`type: 'Οικόπεδο'`) — **από το §7.6.11**.
   * Μέχρι τότε **δεν** την κάλυπτε, και η αιτία δεν ήταν εδώ: το κατηγόρημα ρωτούσε
   * `isCanonicalPropertyType` **χωρίς** `normalizePropertyType`, ενώ ο δείκτης
   * πληρότητας κανονικοποιούσε — **δύο κριτές, και ο ένας ήξερε λιγότερα**.
   *
   * 🔑 **ΚΑΙ Η ΘΕΡΑΠΕΙΑ ΔΕΝ ΜΠΗΚΕ ΕΔΩ, ΕΠΙΤΗΔΕΣ.** Ένας δυνατός κριτής **μόνο** στο
   * ανέβασμα θα έκανε την **ίδια οθόνη** να αυτο-αντικρούεται — *«Εμβαδόν»* πάνω από το
   * `OwnerBasicsFields`, *«τοπογραφικό»* κάτω από εδώ — που είναι **χειρότερο** από το
   * να λένε και τα δύο το ίδιο λάθος. Μπήκε **στο κατηγόρημα**, για **έξι** καταναλωτές
   * ταυτόχρονα, και ο αδύναμος κριτής **έπαψε να εξάγεται** ώστε να μη μπορεί να
   * ξαναδιαλεχθεί: {@link isLandProperty} (`constants/property-classification`).
   */
  const isLand = isLandProperty(form.watch('type'));

  const media = form.watch('media') ?? [];
  // 🔑 **Ο ΙΔΙΟΣ κριτής με τον γραφέα** — δες το σκεπτικό του `owner-media-publication`.
  const published = publishedOwnerMedia(media);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    // ⚠️ Το πεδίο αδειάζει **αμέσως**, ώστε το ίδιο αρχείο να μπορεί να ξαναεπιλεγεί
    // μετά από αποτυχία: ένα `<input type="file">` δεν πυροδοτεί `change` για ίδια τιμή.
    event.target.value = '';

    // ⚠️ **Σειριακά, όχι `Promise.all`**: η κατάσταση ανεβάσματος είναι **μία** και
    // δείχνει ένα όνομα αρχείου. Παράλληλα ανεβάσματα θα την έγραφαν το ένα πάνω στο
    // άλλο, και ο άνθρωπος θα έβλεπε ποσοστά που πηδάνε ανάμεσα σε δύο αρχεία.
    for (const file of files) {
      const uploaded = await upload(file);
      if (uploaded === null) continue;
      // 🔑 Διαβάζεται **η τρέχουσα** τιμή της φόρμας σε κάθε βήμα, όχι το `media` του
      // κλεισίματος: αλλιώς το δεύτερο αρχείο θα έσβηνε το πρώτο.
      form.setValue('media', [...(form.getValues('media') ?? []), uploaded], {
        shouldDirty: true,
      });
    }
  }

  /**
   * **Η επιλογή δημοσίευσης** — γράφεται στη φόρμα, όχι σε δεύτερη κατάσταση.
   *
   * ⚠️ Διαβάζεται **η τρέχουσα** τιμή (`getValues`) και όχι το `media` του κλεισίματος,
   * ίδιος λόγος με το ανέβασμα: δύο γρήγορα κλικ θα έγραφαν το ένα πάνω στο άλλο.
   */
  function handleTogglePublished(storagePath: string, next: boolean): void {
    form.setValue(
      'media',
      (form.getValues('media') ?? []).map((item) =>
        item.storagePath === storagePath ? { ...item, published: next } : item,
      ),
      { shouldDirty: true },
    );
  }

  /**
   * **«ΤΙ ΕΙΝΑΙ ΑΥΤΟ;»** — η δεύτερη ανθρώπινη δήλωση (ADR-841 §7 Α17).
   *
   * 🔴 **ΔΕΥΤΕΡΟ ΕΡΩΤΗΜΑ, ΔΕΥΤΕΡΟΣ ΧΕΙΡΙΣΤΗΣ — ΠΟΤΕ ΣΥΝΔΥΑΣΜΕΝΟ ΜΕ ΤΗ ΔΗΜΟΣΙΕΥΣΗ.** Το
   * *«φεύγει;»* και το *«τι είναι;»* είναι ορθογώνια: ο κάτοχος μπορεί να χαρακτηρίσει
   * κάτοψη που **δεν** δημοσιεύει, και να δημοσιεύσει φωτογραφία που δεν χαρακτήρισε.
   * Ένας χειριστής που τα έγραφε μαζί θα έπαιρνε **μία** απόφαση για **δύο** ερωτήσεις.
   *
   * ⚠️ **Ίδιο ιδίωμα `getValues` με τους γείτονές του**, και για τον ίδιο λόγο: δύο
   * γρήγορα κλικ σε διαφορετικές γραμμές θα έγραφαν το ένα πάνω στο άλλο αν διάβαζαν το
   * `media` του κλεισίματος.
   */
  function handleToggleFloorplan(storagePath: string, isFloorplan: boolean): void {
    form.setValue(
      'media',
      (form.getValues('media') ?? []).map((item) =>
        item.storagePath === storagePath
          ? { ...item, kind: isFloorplan ? ('floorplan' as const) : ('photo' as const) }
          : item,
      ),
      { shouldDirty: true },
    );
  }

  /**
   * **«Να μπει πρώτη»** — μετακίνηση μέσα στον **ίδιο** πίνακα (ADR-841 §7 Α2.1).
   *
   * ⛔ **Κανένα πεδίο σειράς**: η σειρά που βλέπει ο κάτοχος **είναι** η σειρά που
   * φεύγει, και δεν υπάρχει δεύτερη λίστα να μείνει πίσω.
   */
  function handleMakeFirst(storagePath: string): void {
    form.setValue('media', [...withOwnerMediaFirst(form.getValues('media') ?? [], storagePath)], {
      shouldDirty: true,
    });
  }

  function handleRemove(storagePath: string): void {
    // ⚠️ **Αφαιρείται από την αγγελία, ΔΕΝ σβήνεται από το Storage.** Η διαγραφή
    // αρχείου είναι μη αναστρέψιμη πράξη σε δεδομένο του ανθρώπου, ενώ αυτή η οθόνη
    // μπορεί να ακυρωθεί χωρίς αποθήκευση — μια «καθαριότητα» εδώ θα κατέστρεφε το
    // αρχείο ακόμη κι αν ο άνθρωπος πατούσε μετά «Ακύρωση».
    form.setValue(
      'media',
      (form.getValues('media') ?? []).filter((item) => item.storagePath !== storagePath),
      { shouldDirty: true },
    );
  }

  return (
    <FormFieldset
      legend={t(isLand ? `${K}.landLabel` : `${K}.label`)}
      help={t(isLand ? `${K}.landHelp` : `${K}.help`)}
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          className="inline-block cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
        >
          {t(`${K}.add`)}
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          onChange={handleFiles}
          className="sr-only"
        />

        {state.state === 'uploading' && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t(`${K}.uploading`, { fileName: state.fileName, percent: state.percent })}
          </p>
        )}
        {state.state === 'rejected' && (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.rejected`, { fileName: state.fileName, reason: state.reason })}
          </p>
        )}
        {state.state === 'failed' && (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.failed`, { fileName: state.fileName })}
          </p>
        )}
        {accountMissing && (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.accountRequired`)}{' '}
            {/*
              🔑 **Σύνδεσμος, ΟΧΙ διάλογος** (ADR-660 §5.10). Ένα `<form>` σύνδεσης
              φωλιασμένο μέσα σε αυτό το `<form>` είναι **άκυρο HTML**· και ο
              `AuthForm` είναι **οθόνη** (δικό της toolbar, σήμα, ανακατεύθυνση), όχι
              χειριστήριο πεδίου. Η φυγή είναι ασφαλής επειδή το προσχέδιο
              **επιβιώνει**: δες `owner-property-draft-memory.ts`.
            */}
            <Link href={AUTH_ROUTES.login} className="font-medium text-foreground underline">
              {t(`${K}.signIn`)}
            </Link>
          </p>
        )}

        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(`${K}.empty`)}</p>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col p-0">
              {media.map((item) => (
                <OwnerPropertyMediaItem
                  key={item.storagePath}
                  item={item}
                  isLead={isLeadOwnerMedia(media, item.storagePath)}
                  canPublish={published.length < PUBLISHED_MEDIA_LIMIT}
                  onTogglePublished={handleTogglePublished}
                  onToggleFloorplan={handleToggleFloorplan}
                  onMakeFirst={handleMakeFirst}
                  onRemove={handleRemove}
                />
              ))}
            </ul>
            {/*
              🔑 **Ο μετρητής διαβάζει τον ΙΔΙΟ SSoT με τον γραφέα του ραφιού** — άρα ο
              αριθμός εδώ **δεν μπορεί** να διαφωνήσει με το τι φεύγει στον κόσμο.
            */}
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {/*
                🔴 **`published`, ΠΟΤΕ `count`** — και οι δύο λόγοι είναι μετρημένοι:
                *(α)* το μήνυμα λέει `{published}`, οπότε ένα `count` άφηνε τη μεταβλητή
                **άλυτη στην οθόνη** *(«Δημοσιεύονται (published) από (max)»* — το είδα
                περπατώντας, με 1.012 tests πράσινα)*· *(β)* το `count` είναι
                **δεσμευμένο** όνομα του i18next: ενεργοποιεί πληθυντικούς και θα
                απαιτούσε `_one`/`_other`, δηλαδή δεύτερο μηχανισμό για μια πρόταση που
                δεν κλίνει.
              */}
              {t(`${K}.publishedCount`, {
                published: published.length,
                max: PUBLISHED_MEDIA_LIMIT,
              })}
            </p>
          </>
        )}

        {/*
          🔴 **Η ΥΠΟΣΧΕΣΗ ΑΛΛΑΞΕ ΜΑΖΙ ΜΕ ΤΟΝ ΚΩΔΙΚΑ** (ADR-841 §7 Α2.7). Έλεγε *«τα
          αρχεία σου είναι ιδιωτικά και **δεν δημοσιεύονται**»* — αληθές μέχρι τη Φ3,
          **ψέμα σε ενεργή οθόνη** από τη στιγμή που υπάρχει το κουτάκι από πάνω.
          Η νέα διατύπωση κρατά την υπόσχεση **κατά γράμμα** για κάθε αρχείο που δεν
          διάλεξε ο άνθρωπος — που είναι, εξ ορισμού, **όλα τα υπάρχοντα**.
        */}
        <p className="text-sm text-muted-foreground">{t(`${K}.privateNote`)}</p>
      </div>
    </FormFieldset>
  );
}
