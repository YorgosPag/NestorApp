'use client';

/**
 * @fileoverview **ΤΟ ΣΗΜΑ ΧΩΡΙΚΩΝ ΜΕΣΩΝ** — «3D περιήγηση» · «3D μοντέλο» · «3D» με δύο εικονίδια, πάνω στη φωτογραφία.
 * @related ADR-777 §8.88 · lib/listings/listing-spatial-media (η ΜΙΑ απόφαση) · shared/gallery/photo-overlay-surface
 * @module components/listings/ListingSpatialBadge
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-10-13), ΟΧΙ ΑΠΟ ΜΝΗΜΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Zillow** (Austin, 28 κάρτες): **ακριβώς ένα** σήμα σε 28/28, πάνω-αριστερά, μη διαδραστικό `<span>`, 12px/700· το
 * «3D Tour» είναι το μόνο σκούρο (`rgba(0,0,0,.6)`). **Redfin**: στοίβα 1–3 σημάτων. **Rightmove**: μία λωρίδα με
 * εικονίδια χωρίς λέξη. **Idealista**: δεν μετρήθηκε (τείχος captcha). Πλήρης πίνακας στο ADR.
 *
 * 🏆 **Πέρα από τη Zillow**: εκείνη μοιράζει τη **μία** θέση σε έξι είδη (μείωση τιμής, «πριν 14 ώρες», φράσεις
 * χαρακτηριστικών…), άρα σπίτι με περιήγηση **και** μείωση δείχνει μόνο το ένα. Εδώ η θέση ανήκει **μόνο** στα χωρικά
 * μέσα· η μείωση τιμής ζει ήδη δίπλα στην τιμή (§8.69) και δεν ανταγωνίζεται.
 *
 * ⚠️ **ΠΛΗΡΟΦΟΡΙΑ, ΟΧΙ ΚΟΥΜΠΙ.** `pointer-events-none` ⇒ το κλικ περνά στη φωτογραφία και ανοίγει την αγγελία· καμία
 * στάση `Tab`. Κουμπί «άνοιξε την περιήγηση» θα έστελνε τον ανώνυμο σε **άρνηση** όταν η ορατότητα είναι `on-request`.
 * Το κείμενο είναι **στο DOM**, άρα ο αναγνώστης οθόνης το διαβάζει ως κείμενο — τα εικονίδια είναι διακοσμητικά.
 * Στο διπλό σήμα το μάτι βλέπει τη σύντμηση «3D» και ο αναγνώστης ακούει την πλήρη πρόταση (`badgeCompactLabel`).
 *
 * ⚠️ **Λεξιλόγιο φωτογραφιών** (`common-photos`), όχι αναζήτησης: η κάρτα ζει στο κέλυφος και το `search-results`
 * είναι στο ταβάνι του (CHECK 3.34) — ίδιο μάθημα με το `ListingCardNoPhotoCover`.
 *
 * ⛔ **Καμία κρίση εδώ.** Το «ποιο σήμα;» το απαντά το `listingSpatialBadge`· αυτό το αρχείο μόνο ζωγραφίζει.
 */

import React from 'react';
import { Box, Compass, type LucideIcon } from 'lucide-react';

import { PHOTO_OVERLAY_SURFACE_CLASS } from '@/components/shared/gallery/photo-overlay-surface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { listingSpatialBadge, type ListingSpatialBadgeKind } from '@/lib/listings/listing-spatial-media';
import type { PublicListing } from '@/types/public-listing';

/**
 * Τα εικονίδια ανά σήμα — πλήρες `Record`, ώστε τέταρτο είδος να **σπάει τη μεταγλώττιση** αντί να βγει κενό.
 * Είναι τα **ίδια** με τις καρτέλες της σελίδας αγγελίας (`ListingMediaViewer`): ο άνθρωπος βλέπει στην κάρτα το
 * σύμβολο που θα πατήσει μέσα.
 */
const BADGE_ICONS: Record<ListingSpatialBadgeKind, readonly LucideIcon[]> = {
  tour: [Compass],
  model: [Box],
  'tour-and-model': [Compass, Box],
};

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Το κείμενο του σήματος — **κυριολεκτικά κλειδιά, ένα ανά κλάδο**, επίτηδες.
 *
 * 🔴 Η πρώτη γραφή κρατούσε τα κλειδιά σε πίνακα και καλούσε `t(labelKey)`: ο γεννήτορας του κελύφους (ADR-744)
 * **αρνήθηκε να εκπέμψει** — «ανεπίλυτη δυναμική t()» σε επτά διαδρομές. Αποδίδει κλειδιά **ανά αρχείο, από το κείμενο
 * της κλήσης**· κλειδί που ταξιδεύει ως μεταβλητή είναι αόρατο και θα έβγαινε **ωμό** στο πρώτο καρέ.
 * Το `switch` χωρίς `default` κρατά την εξαντλητικότητα: τέταρτο είδος δεν μεταγλωττίζεται.
 */
function badgeLabel(t: Translate, kind: ListingSpatialBadgeKind): string {
  switch (kind) {
    case 'tour':
      return t('common-photos:photos.spatial.tour');
    case 'model':
      return t('common-photos:photos.spatial.model');
    case 'tour-and-model':
      return t('common-photos:photos.spatial.tourAndModel');
  }
}

/**
 * **Η συμπαγής όψη** — ό,τι **γράφεται** στο χάπι όταν η πλήρης πρόταση δεν χωρά· `null` ⇒ γράφεται η ίδια η πρόταση.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ στην παραγωγή (2026-10-13, ADR-777 §8.90).** Το «3D περιήγηση · μοντέλο» θέλει χάπι 184px· το
 * στενό κελί (17rem) δίνει 165–181 και η φούσκα του χάρτη 164 ⇒ «3D περιήγηση · μ…»: το **δεύτερο** μέσο, αυτό ακριβώς
 * που διαφημίζει το σήμα, ήταν το κομμένο. **Κανένας** από τους τέσσερις δεν κόβει σήμα με «…»: Zillow 0/34, Redfin 0
 * (αναδιπλώνει χωριστά σήματα), Rightmove και Idealista δείχνουν δύο μέσα **μόνο με εικονίδια**.
 *
 * ⚠️ **Παντού, όχι «όπου δεν χωρά»** (απόφαση Giorgio 2026-10-13): η ίδια αγγελία δεν δείχνει άλλο σήμα στη λίστα και
 * άλλο στη φούσκα, και δεν υπάρχει κατώφλι πλάτους δεμένο στις μετρικές μιας γραμματοσειράς.
 *
 * 🏆 **Πέρα από Rightmove/Idealista**: εκείνοι δεν γράφουν λέξη **πουθενά**. Εδώ τα μονά σήματα («3D περιήγηση»,
 * «3D μοντέλο») κρατούν τη λέξη τους, άρα τα δύο εικονίδια διδάσκονται από τις διπλανές κάρτες· και η πλήρης πρόταση
 * μένει στο DOM για τον αναγνώστη οθόνης (`badgeLabel`).
 */
function badgeCompactLabel(t: Translate, kind: ListingSpatialBadgeKind): string | null {
  switch (kind) {
    case 'tour':
    case 'model':
      return null;
    case 'tour-and-model':
      return t('common-photos:photos.spatial.tourAndModelShort');
  }
}

interface ListingSpatialBadgeProps {
  readonly listing: Pick<PublicListing, 'models' | 'tour'>;
  /** **Η θέση** — την αποφασίζει ο γονέας (κάρτα ≠ φούσκα 176px)· το σήμα δεν ξέρει πού κάθεται. */
  readonly className?: string;
}

export function ListingSpatialBadge({ listing, className }:ListingSpatialBadgeProps): React.ReactElement | null {
  const { t } = useTranslation(['common-photos']);
  const kind = listingSpatialBadge(listing);

  if (kind === null) return null;

  const label = badgeLabel(t, kind);
  const compact = badgeCompactLabel(t, kind);

  return (
    <span
      /*
        🔴 **`cn`, ΟΧΙ συνένωση — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-10-13).** Η πρώτη γραφή κολλούσε το `className` του γονέα μετά
        το `max-w-full`: δύο κλάσεις ίδιας ιδιότητας, και νικούσε η σειρά του **stylesheet**, όχι της γραφής ⇒ υπολογισμένο
        `max-width: 100%` αντί για `calc(100% − 6.5rem)`. Το όριο που κρατά το χάπι μακριά από την καρδιά **δεν ίσχυε**
        (κελί 17rem, «3D περιήγηση · μοντέλο»: κενό 5px· φούσκα 176px: χάπι 184px, έξω από το πλαίσιο).
      */
      className={cn(
        'pointer-events-none inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        PHOTO_OVERLAY_SURFACE_CLASS,
        className
      )}
    >
      {BADGE_ICONS[kind].map((Icon) => (
        <Icon key={Icon.displayName} aria-hidden="true" className="size-3.5 shrink-0" />
      ))}
      {compact === null ? (
        <span className="truncate">{label}</span>
      ) : (
        <>
          {/* Ό,τι **βλέπει** το μάτι είναι σύντμηση· ό,τι **ακούει** ο αναγνώστης οθόνης είναι η πλήρης πρόταση — μία φορά. */}
          <span aria-hidden="true">{compact}</span>
          <span className="sr-only">{label}</span>
        </>
      )}
    </span>
  );
}
