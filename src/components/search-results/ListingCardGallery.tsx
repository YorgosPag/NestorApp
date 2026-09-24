'use client';

/**
 * **Η ΠΕΡΙΗΓΗΣΗ ΦΩΤΟΓΡΑΦΙΩΝ ΜΕΣΑ ΣΤΗΝ ΚΑΡΤΑ** — ADR-777 §8.57
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΜΗΧΑΝΗ ΕΙΝΑΙ ΤΟ CSS, ΚΑΙ Η ΑΛΗΘΕΙΑ ΕΙΝΑΙ Η ΘΕΣΗ ΚΥΛΙΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δεν υπάρχει βιβλιοθήκη carousel και δεν υπάρχει `useState` για το *«σε ποια είμαι»*.
 * Η κίνηση είναι **native scroll με `scroll-snap`** *(baseline σε όλους τους περιηγητές
 * από το 2020)* και ο δείκτης **παράγεται** από `IntersectionObserver` πάνω στον ίδιο
 * τον κύλινδρο. Τρία πράγματα βγαίνουν δωρεάν και **σωστά**:
 *
 * 1. **Swipe με αδράνεια, trackpad, `Shift`+ροδέλα** — γραμμένα από τον περιηγητή, όχι
 *    προσομοιωμένα με `transform` και χειροκίνητο `touchmove`.
 * 2. **Δουλεύει ΧΩΡΙΣ JavaScript.** Αν το πακέτο αργήσει ή σκάσει, ο άνθρωπος
 *    εξακολουθεί να μπορεί να σύρει τις φωτογραφίες. Τα βελάκια είναι **ενίσχυση**,
 *    ποτέ η μοναδική διαδρομή.
 * 3. **Η θέση επιβιώνει σε κάθε επανα-απόδοση.** Το `ResultsList` ξαναποδίδεται σε
 *    **κάθε** `peek` — δηλαδή δεκάδες φορές το λεπτό, κάθε φορά που ο δείκτης περνά
 *    πάνω από πινέζα του χάρτη (§8.55). Με κατάσταση σε JS θα έπρεπε να αποδείξουμε
 *    ότι δεν μηδενίζεται· εδώ **δεν υπάρχει κατάσταση να μηδενιστεί** — η φωτογραφία
 *    που βλέπεις είναι εκεί όπου έχει κυλήσει το DOM.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ.** Zillow, Airbnb και Idealista δίνουν το ίδιο
 * αποτέλεσμα με **JS carousel** (embla/swiper-κλάσης): ~30KB, `transform` ανά καρέ, και
 * η θέση ζει σε κατάσταση React — άρα κάθε remount της λίστας την επαναφέρει στην πρώτη
 * φωτογραφία. Εδώ το κόστος είναι **μηδέν byte** και η θέση είναι ιδιότητα του DOM.
 * *(Τα `::scroll-button()` / `::scroll-marker` του CSS θα έκαναν ακόμη και τα βελάκια
 * χωρίς JS, αλλά είναι Chrome 150 / Safari 26.6 και **λείπουν από τον Firefox** —
 * μπαίνουν όταν γίνουν baseline· το σχήμα εδώ δεν αλλάζει, φεύγει μόνο ο κώδικας.)*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΑ ΒΕΛΑΚΙΑ ΚΥΛΟΥΝ **ΑΥΤΟΝ** ΤΟΝ ΚΥΛΙΝΔΡΟ — ΠΟΤΕ `scrollIntoView`
 * ────────────────────────────────────────────────────────────────────────────
 * Το `scrollIntoView()` και το `focus()` κυλούν **ΚΑΘΕ πρόγονο-δοχείο** μέχρι τη ρίζα.
 * Αυτό δεν είναι θεωρία σε αυτό το έργο: είναι **η αιτία** που ο χάρτης της ίδιας οθόνης
 * εξαφανιζόταν σε κάθε κλικ σε πινέζα *(§8.56 — `section.scrollTop` πήγαινε στο `1223.75`
 * και ο καμβάς στο `y = −894`)*. Εδώ ο κύλινδρος ζει μέσα σε **κάθετη** λίστα, που ζει
 * μέσα σε `<section>` που το καθολικό CSS κάνει κι αυτό κυλιόμενο. Γι' αυτό:
 *   • `scrollTo` **στο συγκεκριμένο στοιχείο**, με υπολογισμένο `left` — ποτέ έμμεσα·
 *   • `overscroll-behavior-x: contain` ⇒ το swipe **δεν διαρρέει** στη λίστα από πίσω·
 *   • καμία κλήση `focus()` κατά την κύλιση.
 *
 * @module components/search-results/ListingCardGallery
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import type { ListingImage } from '@/types/public-listing';

import { LISTING_CARD_ASPECT, LISTING_CARD_ASPECT_CLASS } from './listing-card-frame';
import { listingPhotoPositionClass } from './listing-photo-position-class';
import { useGalleryScroller } from './use-gallery-scroller';

interface ListingCardGalleryProps {
  /** Οι εικόνες **με τη σειρά τους** — από το `listingGalleryImages`, ποτέ χειρόγραφα. */
  readonly images: readonly ListingImage[];
  /** Το `sizes` της κάρτας — η γκαλερί δεν αποφασίζει διαστάσεις, τις **δέχεται**. */
  readonly sizes: string;
  /**
   * Μόνο η **πρώτη κάρτα της πρώτης οθόνης**, και μόνο για την **πρώτη** φωτογραφία της.
   *
   * ⚠️ Οι υπόλοιπες μένουν `lazy` **επίτηδες**: πολλές εικόνες υψηλής προτεραιότητας
   * ακυρώνουν η μία την άλλη (ADR-841 §7 Α2.4). Και επειδή ο κύλινδρος είναι κανονικός
   * scroll container, το `loading="lazy"` του περιηγητή **δεν κατεβάζει** τη 2η και την
   * 3η μέχρι να πλησιάσουν — δηλαδή η «προφόρτωση της επόμενης» γίνεται **από τον
   * περιηγητή, τη σωστή στιγμή**, χωρίς δικό μας χρονοδιακόπτη να τη μαντέψει.
   */
  readonly priority?: boolean;
  /** Κλάσεις του **δοχείου** — η κάρτα κρατά τον έλεγχο του περιθωρίου της. */
  readonly className?: string;
  /**
   * Ο σύνδεσμος που τυλίγει **κάθε** φωτογραφία, ώστε το κλικ πάνω της να ανοίγει την
   * αγγελία όπως παντού αλλού. Δες {@link ListingCardGalleryProps.renderSlideLink}.
   */
  readonly renderSlideLink?: (child: React.ReactNode, index: number) => React.ReactNode;
  /**
   * **ΓΡΑΦΕΑΣ** — *«δήλωσε ποια φωτογραφία βλέπεις, με αυτό το κλειδί»* (ADR-777 §8.58.7).
   *
   * 🔑 Το δηλώνει **μόνο η κάρτα της λίστας**, και το κλειδί είναι η ταυτότητα της
   * αγγελίας. Είναι ο **ένας** γραφέας του {@link module:lib/listings/listing-photo-position}.
   *
   * ⛔ **ΜΗΝ το δώσεις και στη φούσκα του χάρτη.** Δύο γραφείς στο ίδιο κλειδί είναι
   * ακριβώς ο συγχρονισμός που το §8.58.7 απέρριψε — και ο βρόχος ανάδρασης που τον
   * κάνει αδύνατο. Η φούσκα **διαβάζει** ({@link ListingCardGalleryProps.initialIndex}).
   */
  readonly reportPositionAs?: string;
  /**
   * **ΑΝΑΓΝΩΣΤΗΣ** — *«ξεκίνα από εδώ»*. Διαβάζεται **μία φορά, στην προσάρτηση**.
   *
   * 🔴 **ΔΕΝ είναι ελεγχόμενη τιμή**, και η διαφορά είναι όλη η απόφαση: μια αλλαγή του
   * **μετά** την προσάρτηση **δεν κάνει τίποτα**. Αν την ακολουθούσε, η γκαλερί θα είχε
   * **δύο γραφείς** *(τον παρατηρητή της και τον γονέα)* — και το ίδιο το σχόλιο του
   * `index` παρακάτω προβλέπει τι θα γινόταν: *«δύο αλήθειες, που αποκλίνουν στην πρώτη
   * διακοπτόμενη κύλιση»*.
   */
  readonly initialIndex?: number;
}

export function ListingCardGallery({
  images,
  sizes,
  priority = false,
  className = '',
  renderSlideLink,
  reportPositionAs,
  initialIndex = 0,
}: ListingCardGalleryProps) {
  /*
    🔑 **`common-photos`, ΟΧΙ ΝΕΑ ΚΛΕΙΔΙΑ ΣΤΟ `search-focus`** — και το εύρημα ήταν
    μετρημένο, όχι γούστο. Γράφτηκαν πρώτα πέντε φρέσκα κλειδιά (`gallery.previous`,
    `gallery.next`, …) και η **πύλη του ADR-744** αρνήθηκε να εκπέμψει: το `search-focus`
    θα γινόταν **9ο** key-sliced namespace του κελύφους έναντι σφραγισμένων 8, δηλαδή νέα
    οικογένεια κειμένου σε **~150 διαδρομές** — και το μήνυμά της λέει κατά λέξη ότι *«η
    θεραπεία είναι συνήθως να ΚΟΠΕΙ η εισαγωγή, όχι να δηλωθεί το namespace»*.

    ⚠️ Το ψάξιμο που ακολούθησε βρήκε ότι τα τέσσερα από τα πέντε **υπήρχαν ήδη**, στο
    `common-photos` — που είναι **ήδη** στο κέλυφος: `photoPreview.navigation.previousAria`
    /`nextAria` *(και μάλιστα **καλύτερα** από τα δικά μου: κουβαλούν `{current}/{total}`,
    άρα το κουμπί λέει «Επόμενη φωτογραφία (2/3)» αντί για σκέτο «Επόμενη»)* και
    `photos.galleryLabel`. Προστέθηκε **ένα** μόνο: `photoPreview.navigation.slide`.

    🔑 «Προηγούμενη φωτογραφία» **δεν είναι λεξιλόγιο αναζήτησης** — είναι λεξιλόγιο
    φωτογραφιών, και το είχε ήδη σπίτι. Το ελάττωμα ήταν ότι δεν ρώτησα πρώτα (N.11).
  */
  const { t } = useTranslation(['common-photos', 'search-results']);
  const total = images.length;
  const { scrollerRef, index, goTo } = useGalleryScroller({ total, initialIndex, reportPositionAs });

  if (total === 0) return null;

  const slides = images.map((image, position) => {
    const picture = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.url}
        srcSet={listingImageSrcSet(image)}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={t(image.altKey, { index: position + 1, total })}
        loading={priority && position === 0 ? 'eager' : 'lazy'}
        fetchPriority={priority && position === 0 ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
        className={`${LISTING_CARD_ASPECT_CLASS} w-full object-cover ${listingPhotoPositionClass(image, LISTING_CARD_ASPECT)}`}
      />
    );

    return (
      <li
        key={image.url}
        data-slide-index={position}
        /*
          APG: κάθε slide δηλώνει **ρόλο και θέση**, ώστε η ανακοίνωση να είναι
          «ομάδα, slide, 2 από 3» και όχι σκέτο «εικόνα».
        */
        role="group"
        aria-roledescription="slide"
        aria-label={t('common-photos:photoPreview.navigation.slide', { current: position + 1, total })}
        className="w-full shrink-0 snap-center snap-always"
      >
        {renderSlideLink ? renderSlideLink(picture, position) : picture}
      </li>
    );
  });

  return (
    /*
      🔴 **`z-10` — ΧΩΡΙΣ ΑΥΤΟ ΤΑ ΒΕΛΑΚΙΑ ΗΤΑΝ ΠΡΑΚΤΙΚΑ ΑΟΡΑΤΑ.** Αναφέρθηκε από τον
      Giorgio: *«πρέπει να κάνω hover ΑΚΡΙΒΩΣ πάνω από τα βελάκια… τα έψαχνα αρκετή ώρα»*.

      Η αιτία ήταν το **link-overlay** της κάρτας: το `::after { inset: 0 }` του τίτλου
      απλώνεται πάνω σε **ΟΛΗ** την κάρτα, και ο τίτλος είναι **αδελφός** αυτού του
      δοχείου — όχι απόγονός του. Άρα ο δείκτης πάνω στη φωτογραφία ακουμπούσε **το
      overlay του τίτλου**, το `.group/gallery` δεν έπαιρνε ποτέ `:hover`, και τα μόνα
      σημεία που δούλευαν ήταν τα ίδια τα κουμπιά *(`z-20`, πάνω από το overlay)*.

      🔑 Το `z-10` βάζει τον κύλινδρο **πάνω** από το overlay ⇒ hover σε **οποιοδήποτε**
      σημείο της φωτογραφίας. Το κλικ πάνω της εξακολουθεί να ανοίγει την αγγελία, γιατί
      κάθε slide έχει **δικό του** σύνδεσμο (`renderSlideLink`).

      ⚠️ Και εξηγεί το δεύτερο σύμπτωμα που αναφέρθηκε — *«όταν κάνω hover πάνω στο
      ανενεργό βελάκι δεν εμφανίζεται τίποτα»*: το `disabled:pointer-events-none` άφηνε
      τον δείκτη να **περάσει μέσα** του και να προσγειωθεί πάλι στο overlay του τίτλου.
      Με τη λούπα κανένα βελάκι δεν είναι πια ανενεργό, οπότε η περίπτωση εκλείπει.
    */
    <div className={`group/gallery relative z-10 ${className}`}>
      <ul
        ref={scrollerRef}
        aria-roledescription="carousel"
        aria-label={t('common-photos:photos.galleryLabel')}
        /*
          ⚠️ Η μπάρα κύλισης κρύβεται **οπτικά**, ποτέ λειτουργικά: το `overflow-x: auto`
          μένει, άρα η κύλιση υπάρχει για δάχτυλο, trackpad και βοηθητική τεχνολογία.
          Το `overscroll-x-contain` κρατά το swipe **μέσα** στην κάρτα.
        */
        /*
          🔴 **`[display:flex]` ΚΑΙ ΟΧΙ `flex` — ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ, ΟΧΙ ΓΟΥΣΤΟ.**
          Το `globals.css` έχει καθολικό «mobile fix»:
          `@media (max-width: 640px) { .flex, .grid { overflow-x: hidden !important } }`.
          Με σκέτο `flex`, σε πλάτος **535px** μετρήθηκε `overflow-x: hidden` — δηλαδή ο
          κύλινδρος **δεν κυλούσε με το δάχτυλο**, ακριβώς στη συσκευή όπου το swipe
          είναι ο **κύριος** τρόπος περιήγησης. Και το `!important` σημαίνει ότι καμία
          κλάση του Tailwind δεν το νικά: η μόνη διέξοδος είναι **να μην ταιριάζει ο
          επιλογέας**. Το `[display:flex]` δίνει το ίδιο layout χωρίς την κλάση `.flex`.

          ⚠️ Ίδια οικογένεια με το **Δ2 του §8.56** (`section { overflow-x: hidden }` που
          έκανε κάθε `<section>` δοχείο κύλισης και εξαφάνισε τον χάρτη): καθολικοί
          κανόνες «διόρθωσης» που σπάνε **συγκεκριμένα** συστατικά, σιωπηλά. Δεύτερη
          φορά, δεύτερο σύμπτωμα, ίδια ρίζα — καταγεγραμμένο στο ADR.
        */
        className="[display:flex] snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth motion-reduce:scroll-auto rounded-md border border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides}
      </ul>

      {total > 1 && (
        <>
          {/*
            ⚠️ Ο αριθμός στο `aria-label` είναι ο **ΠΡΟΟΡΙΣΜΟΣ**, όχι η τρέχουσα θέση:
            «Προηγούμενη φωτογραφία (2/2)» σημαίνει *«θα σε πάει στη 2η από 2»*. Με τη
            λούπα **τυλίγεται κι αυτός** — αλλιώς το κουμπί θα εκφωνούσε «(0/2)» στην
            πρώτη φωτογραφία, αριθμό που δεν υπάρχει *(μετρήθηκε στην οθόνη)*.
          */}
          <GalleryArrow
            side="left"
            label={t('common-photos:photoPreview.navigation.previousAria', {
              current: index === 0 ? total : index,
              total,
            })}
            onActivate={() => goTo(index - 1)}
          />
          <GalleryArrow
            side="right"
            label={t('common-photos:photoPreview.navigation.nextAria', {
              current: index === total - 1 ? 1 : index + 2,
              total,
            })}
            onActivate={() => goTo(index + 1)}
          />

          {/*
            🔴 **Η ΛΩΡΙΔΑ ΒΑΘΜΙΔΩΣΗΣ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ — ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΦΑΙΝΟΝΤΑΙ.**
            Οι τελείες γράφτηκαν πρώτα με `bg-background` *(δηλαδή token του θέματος)* και
            **μετρήθηκαν στην οθόνη**: στο σκοτεινό θέμα ήταν σκούρες πάνω σε σκούρα
            φωτογραφία — **ορατές στη μία κάρτα και αόρατες στη διπλανή**. Το σφάλμα δεν
            ήταν η απόχρωση: ήταν η **υπόθεση** ότι από πίσω κάθεται επιφάνεια του θέματος.
            Από πίσω κάθεται **φωτογραφία**, δηλαδή άγνωστο.

            🔑 Γι' αυτό εδώ —και **μόνο** εδώ, πάνω σε μέσο— το χρώμα είναι **σταθερό**:
            σκούρα βαθμίδωση + λευκό. Είναι η πρακτική των Airbnb, Zillow, Booking και
            Google Photos, και είναι **σωστή προσβασιμότητα**: η βαθμίδωση εγγυάται την
            αντίθεση ανεξάρτητα από το τι δείχνει η εικόνα, ενώ ένα token θα την άφηνε
            στην τύχη του κάθε ακινήτου.
          */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 rounded-b-md bg-gradient-to-t from-black/50 to-transparent"
          />

          {/*
            ΟΙ ΤΕΛΕΙΕΣ ΕΙΝΑΙ **ΔΕΙΚΤΗΣ**, ΟΧΙ ΧΕΙΡΙΣΤΗΡΙΟ — και γι' αυτό είναι `<span>`.
            ⚠️ Πέντε κουμπιά-τελείες ανά κάρτα, επί 9 κάρτες, θα πρόσθεταν **45 στάσεις
            πληκτρολογίου** σε μια οθόνη όπου ο άνθρωπος θέλει να φτάσει στην **επόμενη
            αγγελία**. Τα δύο βελάκια αρκούν για κάθε φωτογραφία· οι τελείες απαντούν
            μόνο «πόσες είναι και πού είμαι», και το ίδιο το λέει ήδη το `aria-label`
            κάθε slide στη βοηθητική τεχνολογία.
          */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-1.5 z-20 flex justify-center gap-1"
          >
            {images.map((image, position) => (
              <span
                key={image.url}
                className={[
                  'h-1.5 rounded-full bg-white transition-all',
                  position === index ? 'w-3 opacity-100' : 'w-1.5 opacity-60',
                ].join(' ')}
              />
            ))}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Το βελάκι — **πραγματικό `<button>`**, ποτέ `<div role="button">`.
 *
 * ⚠️ **`z-20` και `type="button"`, και τα δύο υποχρεωτικά.** Το πρώτο το κρατά πάνω από
 * τον αόρατο σύνδεσμο που καλύπτει την κάρτα *(το `::after` του τίτλου)*, αλλιώς το κλικ
 * θα άνοιγε την αγγελία αντί να αλλάξει φωτογραφία. Το δεύτερο γιατί ένα κουμπί χωρίς
 * `type` μέσα σε φόρμα είναι `submit`.
 *
 * 🔑 **Ορατό σε `hover` ΚΑΙ σε `focus-within` της κάρτας, πάντα ορατό σε αφή.** Το
 * `group-hover` μόνο του θα έκανε τα βελάκια **απρόσιτα με πληκτρολόγιο** — φαίνονται
 * μόνο με ποντίκι. Το `(hover: none)` τα αφήνει μονίμως ορατά εκεί όπου δεν υπάρχει
 * δείκτης να τα αποκαλύψει.
 */
function GalleryArrow({
  side,
  label,
  onActivate,
}: {
  readonly side: 'left' | 'right';
  readonly label: string;
  readonly onActivate: () => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        // ⚠️ Ο σύνδεσμος της κάρτας είναι ΠΡΟΓΟΝΟΣ: χωρίς αυτό, το κλικ ανεβαίνει και
        //    ανοίγει την αγγελία μαζί με την αλλαγή φωτογραφίας.
        event.preventDefault();
        event.stopPropagation();
        onActivate();
      }}
      className={[
        // ⚠️ ΣΤΑΘΕΡΟ ΧΡΩΜΑ, ΟΧΙ TOKEN — δες τη λωρίδα βαθμίδωσης παραπάνω: το κουμπί
        //    κάθεται πάνω σε ΦΩΤΟΓΡΑΦΙΑ, όχι πάνω σε επιφάνεια του θέματος.
        'absolute top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/55 p-1 text-white',
        'shadow-sm backdrop-blur-sm transition-opacity hover:bg-black/70',
        /*
          🔑 **ΤΕΣΣΕΡΙΣ ΔΙΑΔΡΟΜΕΣ ΑΠΟΚΑΛΥΨΗΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ ΠΕΡΙΤΤΗ:**
          `hover` στη **φωτογραφία** *(η κύρια — αυτή που έλειπε)* · `hover` οπουδήποτε
          στην **κάρτα** *(το πρότυπο Zillow/Airbnb: το βλέμμα πάει στην κάρτα, όχι στο
          βελάκι)* · `focus-within` **και των δύο** *(αλλιώς τα βελάκια θα ήταν
          απρόσιτα με πληκτρολόγιο — φαίνονταν μόνο με ποντίκι)* · και μόνιμη ορατότητα
          όπου **δεν υπάρχει δείκτης** να τα αποκαλύψει.

          ⚠️ Το `group-hover/card` απαιτεί από την κάρτα να δηλώσει `group/card`. Αν δεν
          το κάνει, ο κανόνας απλώς **δεν ταιριάζει** — η γκαλερί εξακολουθεί να δουλεύει
          με το δικό της `group/gallery`. Καμία σιωπηλή εξάρτηση.
        */
        'opacity-0 group-hover/gallery:opacity-100 group-focus-within/gallery:opacity-100',
        'group-hover/card:opacity-100 group-focus-within/card:opacity-100',
        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        '[@media(hover:none)]:opacity-100',
        side === 'left' ? 'left-1.5' : 'right-1.5',
      ].join(' ')}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
