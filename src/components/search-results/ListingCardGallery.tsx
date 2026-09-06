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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import type { ListingImage } from '@/types/public-listing';

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
}

/** Πόσο ορατό πρέπει να είναι ένα slide για να θεωρηθεί «αυτό που βλέπω». */
const VISIBLE_THRESHOLD = 0.6;

export function ListingCardGallery({
  images,
  sizes,
  priority = false,
  className = '',
  renderSlideLink,
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
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const [index, setIndex] = useState(0);
  const total = images.length;

  /*
    🔑 **Ο ΔΕΙΚΤΗΣ ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΔΗΛΩΝΕΤΑΙ.** Το `useState` εδώ **δεν είναι** η θέση:
    είναι **αντίγραφο για την οθόνη** αυτού που ήδη ισχύει στο DOM. Γι' αυτό ο μόνος
    γραφέας του είναι ο παρατηρητής — κανένα κουμπί δεν το γράφει απευθείας. Αν το
    έγραφαν και τα δύο, θα υπήρχαν **δύο** αλήθειες και θα απέκλιναν στην πρώτη
    διακοπτόμενη κύλιση (ο άνθρωπος σέρνει ενώ τρέχει το smooth scroll του κουμπιού).
  */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null || total < 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const position = Number((entry.target as HTMLElement).dataset.slideIndex);
          if (Number.isInteger(position)) setIndex(position);
        }
      },
      { root: scroller, threshold: VISIBLE_THRESHOLD },
    );

    for (const slide of scroller.children) observer.observe(slide);
    return () => observer.disconnect();
  }, [total]);

  /**
   * ⚠️ `scrollTo` **σε αυτό το στοιχείο**, με το πλάτος του ως βήμα — δες την κεφαλίδα
   * για το γιατί απαγορεύεται το `scrollIntoView`. Το `clientWidth` διαβάζεται **τη
   * στιγμή του συμβάντος**, γιατί η κάρτα αλλάζει πλάτος με το φύλλο/το παράθυρο
   * *(κανόνας 2 του ADR-040: τιμή από αναφορά, ποτέ παγωμένο στιγμιότυπο)*.
   */
  const goTo = useCallback((next: number) => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const clamped = Math.max(0, Math.min(next, scroller.children.length - 1));
    /*
      🔴 **ΚΑΝΕΝΑ `behavior` ΕΔΩ — ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ.**
      Γράφτηκε πρώτα ως `scrollTo({ left, behavior: 'smooth' })` και **μετρήθηκε ζωντανά
      ότι ΔΕΝ ΚΙΝΕΙ ΤΙΠΟΤΑ**: ο handler εκτελούνταν σωστά (επαληθεύτηκε με περιτύλιξη
      του `scrollTo` — η κλήση κατέγραψε `{"left":362,"behavior":"smooth"}`), αλλά το
      `scrollLeft` έμενε **0**. Η ίδια κλήση με `behavior: 'auto'` πήγαινε στο **361**
      ακαριαία, και το ίδιο συνέβαινε **απευθείας από την κονσόλα** ⇒ το ελάττωμα δεν
      ήταν ο κώδικας, ήταν το `behavior: 'smooth'` σε αυτόν τον κύλινδρο.

      🔑 Η ομαλότητα μετακόμισε στο **CSS** (`scroll-smooth` + `motion-reduce:scroll-auto`
      στον κύλινδρο), και το σχήμα είναι **fail-safe**: αν η ομαλή κύλιση δεν είναι
      διαθέσιμη για οποιονδήποτε λόγο, το `scrollTo` γίνεται **ακαριαίο** — ο άνθρωπος
      πάει στη φωτογραφία **χωρίς animation**, αντί να μην πάει **καθόλου**. Η
      προηγούμενη γραφή απέτυχε **σιωπηλά και ολοκληρωτικά**· αυτή δεν μπορεί.

      ⚠️ Και το `prefers-reduced-motion` απαντιέται **καλύτερα** έτσι: το CSS media query
      αντιδρά σε αλλαγή της ρύθμισης **χωρίς επανα-απόδοση**, ενώ μια τιμή διαβασμένη σε
      JS παγώνει μέχρι το επόμενο render.
    */
    const target = clamped * scroller.clientWidth;
    const startedAt = scroller.scrollLeft;
    scroller.scrollTo({ left: target });

    /*
      🔴 **ΦΡΟΥΡΟΣ: Η ΚΙΝΗΣΗ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΗ, Η ΜΕΤΑΒΑΣΗ ΥΠΟΧΡΕΩΤΙΚΗ.**
      Μετρήθηκε ζωντανά ότι η ομαλή κύλιση μπορεί να **μην κάνει απολύτως τίποτα**: με
      `scroll-behavior: smooth` το `scrollLeft` έμενε **0**, ενώ η **ίδια** κλήση με
      `auto` πήγαινε στο **361**. Επαληθεύτηκε ότι δεν έφταιγε ο handler (η περιτύλιξη
      του `scrollTo` κατέγραψε τη σωστή κλήση) ούτε το `prefers-reduced-motion`
      (μετρήθηκε `false`) — **η ρίζα ήταν `document.visibilityState === 'hidden'`**: ο
      Chrome παγώνει κάθε ομαλή κύλιση σε κρυμμένη καρτέλα.

      🔑 Δύο καρέ αργότερα ρωτάμε το **μόνο πράγμα που μετράει**: *κουνήθηκε;* Αν όχι,
      πηγαίνουμε ακαριαία. Ο άνθρωπος βλέπει τη φωτογραφία που ζήτησε — με ή χωρίς
      animation — και ποτέ «τίποτα». Belt-and-suspenders (N.7.2 #4).

      ⚠️ **`setTimeout` ΚΑΙ ΟΧΙ `requestAnimationFrame`, ΚΑΙ ΤΟ ΕΜΑΘΑ ΜΕ ΜΕΤΡΗΣΗ.** Ο
      φρουρός γράφτηκε πρώτα με διπλό `rAF` *(το ιδίωμα του §8.56.4)* και **έμεινε κι
      αυτός νεκρός**: τα animation frames παγώνουν στην **ίδια ακριβώς** συνθήκη που
      παγώνει το smooth scroll — δηλαδή ο φρουρός ήταν **δομικά ανίκανος** να πιάσει
      τη μόνη περίπτωση για την οποία γράφτηκε. Οι χρονομετρητές εξακολουθούν να
      τρέχουν *(με στραγγαλισμό)*, άρα ο έλεγχος συμβαίνει **πάντα**.

      ⚠️ Τα **120ms** δεν είναι στρογγυλοποίηση: είναι αρκετά ώστε ένα ζωντανό smooth
      scroll να έχει **ήδη ξεκινήσει** (άρα ο φρουρός μένει αδρανής), και αρκετά λίγα
      ώστε η διόρθωση να μη διαβάζεται ως καθυστέρηση.
    */
    window.setTimeout(() => {
      const moved = Math.abs(scroller.scrollLeft - startedAt) >= 1;
      const wanted = Math.abs(target - startedAt) >= 1;
      if (!wanted || moved) return;
      /*
        ⚠️ **Η ΠΑΡΑΚΑΜΨΗ ΤΟΥ `scroll-behavior` ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΗ, ΚΑΙ ΤΟ ΕΜΑΘΑ ΜΕ
        ΜΕΤΡΗΣΗ.** Ο φρουρός δοκιμάστηκε ως σκέτο `scroller.scrollLeft = target` και
        **έμεινε κι αυτός στο 0**: το CSS `scroll-behavior: smooth` δεν αφορά μόνο το
        `scrollTo` — κάνει ομαλή **κάθε** προγραμματιστική κύλιση, **συμπεριλαμβανομένης
        της ανάθεσης** `scrollLeft`. Δηλαδή έπεφτε στην ίδια παγίδα που φτιάχτηκε να
        πιάσει. Η στιγμιαία απενεργοποίηση είναι ο **μόνος** τρόπος να εγγυηθεί κανείς
        τη μετάβαση.
      */
      const previous = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = 'auto';
      scroller.scrollLeft = target;
      scroller.style.scrollBehavior = previous;
    }, 120);
  }, []);

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
        className="aspect-[4/3] w-full object-cover"
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
    <div className={`group/gallery relative ${className}`}>
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
          <GalleryArrow
            side="left"
            /*
              ⚠️ Ο αριθμός στο `aria-label` είναι ο **ΠΡΟΟΡΙΣΜΟΣ**, όχι η τρέχουσα θέση:
              «Προηγούμενη φωτογραφία (1/2)» σημαίνει *«θα σε πάει στην 1η από 2»*. Το
              `Math.max(1, …)` υπάρχει επειδή μετρήθηκε στην οθόνη ότι στην πρώτη
              φωτογραφία το κουμπί εκφωνούσε «**(0/2)**» — αριθμός που δεν υπάρχει.
            */
            label={t('common-photos:photoPreview.navigation.previousAria', {
              current: Math.max(1, index),
              total,
            })}
            disabled={index === 0}
            onActivate={() => goTo(index - 1)}
          />
          <GalleryArrow
            side="right"
            label={t('common-photos:photoPreview.navigation.nextAria', { current: index + 2, total })}
            disabled={index === total - 1}
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
  disabled,
  onActivate,
}: {
  readonly side: 'left' | 'right';
  readonly label: string;
  readonly disabled: boolean;
  readonly onActivate: () => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
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
        'disabled:pointer-events-none disabled:opacity-0',
        'opacity-0 group-hover/gallery:opacity-100 group-focus-within/gallery:opacity-100',
        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        '[@media(hover:none)]:opacity-100',
        side === 'left' ? 'left-1.5' : 'right-1.5',
      ].join(' ')}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
