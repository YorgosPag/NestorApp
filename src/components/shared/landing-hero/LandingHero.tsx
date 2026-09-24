'use client';

/**
 * **Ο ήρωας** — εικόνα στην κορυφή, και η ενέργεια της σελίδας **μέσα** της
 * (ADR-777 §8.79 · §8.82).
 *
 * @related landing-hero-images · shell-surface.css §4 (`[data-shell-span='full']`)
 *
 * 🔑 **ΤΟ ΣΧΗΜΑ ΤΗΣ ΑΓΟΡΑΣ, ΜΕΤΡΗΜΕΝΟ (24/09):** Zillow · idealista · Spitogatos δείχνουν
 * **μία κυρίαρχη ενέργεια** πάνω από το δίπλωμα. Και κάθε **ακτίνα** (Houzz/Zillow
 * `/professionals`, Airbnb) έχει **τον δικό της** ήρωα με **τη δική της** αναζήτηση.
 *
 * 🔴 **ΕΝΑ ΣΥΣΤΑΤΙΚΟ, ΤΡΕΙΣ ΚΑΤΑΝΑΛΩΤΕΣ** (§8.82): ο κόμβος `/`, το `/pro`, το `/stay`.
 *    Ήταν δεμένος στην αρχική (δικός του τίτλος, δικός του διακόπτης)· τρία αντίγραφα θα
 *    είχαν τρεις γραφές του ίδιου κάδρου, ελεύθερες να αποκλίνουν στο LCP, στο breakout
 *    και στην αντίθεση.
 *
 * ⚠️ **ΔΕΝ ΜΕΤΑΦΡΑΖΕΙ ΚΑΙ ΔΕΝ ΔΙΑΒΑΖΕΙ ΔΕΔΟΜΕΝΑ.** Τίτλος, υπότιτλος και περιεχόμενο πλαισίου
 *    έρχονται από τον καλούντα, που ξέρει **τι** ρωτά η σελίδα του και **αν** μπορεί να
 *    τηρήσει την υπόσχεση (§8.10). Κανένα `t()` εδώ ⇒ καμία επίπτωση στο budget του
 *    κελύφους (ADR-744) όποια σελίδα κι αν τον φορά.
 *
 * ⚠️ **ΚΕΝΟ ΠΛΑΙΣΙΟ = ΚΑΝΕΝΑ ΠΛΑΙΣΙΟ.** Όταν ο καλών δεν έχει τι να ρωτήσει (`children`
 *    απόντα), ο ήρωας δείχνει **μόνο** τίτλο — ποτέ άδεια κάρτα που υπόσχεται πεδίο.
 *
 * ⚠️ **ΤΟ ΚΕΙΜΕΝΟ ΠΑΝΩ ΣΤΗ ΦΩΤΟΓΡΑΦΙΑ ΕΙΝΑΙ ΛΕΥΚΟ ΣΕ ΚΑΙ ΤΑ ΔΥΟ ΘΕΜΑΤΑ — ΕΠΙΤΗΔΕΣ.** Και
 *    οι δύο εκδοχές της φωτογραφίας (μέρα / γαλάζια ώρα, §8.81) φέρουν σκούρο στρώμα που
 *    εγγυάται την αντίθεση· το πλαίσιο ζει σε `bg-card` και ακολουθεί κανονικά το θέμα.
 *
 * 🌗 **ΔΥΟ ΕΚΔΟΧΕΣ, ΜΙΑ ΛΗΨΗ (§8.81).** Το θέμα μπαίνει ως `class` (next-themes) ⇒ ο server
 *    **δεν** το ξέρει· επιλογή με JS = λάθος εικόνα που αναβοσβήνει + hydration mismatch.
 *    Αποδίδονται **και οι δύο**, και διαλέγει το **CSS** (`dark:hidden` / `hidden dark:block`).
 *    Είναι **lazy** επίτηδες: ο browser **δεν** κατεβάζει lazy `<img>` με `display:none` ⇒
 *    φεύγει **μόνο** η ορατή. ⛔ **ΜΗΝ βάλεις `priority`/`loading="eager"` στο ζεύγος**: θα
 *    κατέβαιναν **και οι δύο**. Το LCP το κρατά το ρητό `fetchPriority="high"`.
 *
 * ⚠️ **ΚΑΝΕΝΑ `z-index`**: η σειρά του DOM αρκεί (εικόνα → στρώμα → περιεχόμενο, όλα
 *    positioned). Ένα `z-*` εδώ θα ήταν στρώση έξω από την κλίμακα του ADR-780.
 *
 * 🖼️ **ΔΥΟ ΠΗΓΕΣ, ΕΝΑ ΣΧΗΜΑ (ADR-881 §4.3).** Ο καταναλωτής δίνει την **ενσωματωμένη** εικόνα της
 *    σελίδας του· ο ήρωας ρωτά τον provider αν υπάρχει **δημοσιευμένη** έκδοση (`useLandingHeroImage`).
 *    Εκδοχή του ραφιού (`sources`) ⇒ `<img srcset>` πάνω στα έτοιμα παράγωγα· αρχείο του build ⇒
 *    `next/image`. ⛔ Ποτέ ράφι μέσα από `next/image`: θα ήταν διπλή κωδικοποίηση.
 * 🎯 **ΕΣΤΙΑΣΗ ΣΕ ΔΥΟ ΑΞΟΝΕΣ (ADR-881 §4.4)** — `data-fx`/`data-fy` + CSS Module, αυτούσια (όχι
 *    κεντραρισμένη): το θέμα μένει εκεί όπου το έβαλε η σύνθεση.
 * ⚠️ **ΑΜΕΣΟ ΤΕΚΝΟ ΤΟΥ ΜΕΤΡΟΥ**: το `data-shell-span="full"` ισχύει **μόνο** όταν ο ήρωας
 *    κρέμεται κατευθείαν από το `[data-shell-measure]` της σελίδας — φωλιασμένος μένει
 *    σιωπηλά στη στήλη κειμένου. Το κλειδώνει η σύνθεση κάθε σελίδας στα τεστ της.
 */

import React, { useId } from 'react';
import Image from 'next/image';

import type { LandingHeroAsset, LandingHeroFallback, LandingHeroImage } from '@/lib/landing/landing-hero-vocabulary';
import { listingImageSrcSet } from '@/lib/listings/listing-images';

import { heroFocalAttributes, type HeroFocalAttributes } from './hero-focal-attributes';
import { useLandingHeroImage } from './LandingHeroesProvider';
import styles from './landing-hero-focal.module.css';

interface LandingHeroProps {
  /** Η **ενσωματωμένη** εικόνα της σελίδας (`LANDING_HERO_IMAGES.x`) — ποτέ ωμή διαδρομή. */
  readonly image: LandingHeroFallback;
  /** Ο **μοναδικός** `h1` της σελίδας. */
  readonly title: string;
  readonly subtitle?: string;
  /** Το πλαίσιο της ενέργειας (αναζήτηση/φίλτρα). Απόν ⇒ δεν αποδίδεται πλαίσιο. */
  readonly children?: React.ReactNode;
}

export function LandingHero({ image: fallback, title, subtitle, children }: LandingHeroProps) {
  const headingId = useId();
  const image = useLandingHeroImage(fallback);

  return (
    <section
      aria-labelledby={headingId}
      data-shell-span="full"
      className="relative flex min-h-[26rem] flex-col justify-center overflow-hidden rounded-xl bg-muted px-4 py-10 sm:px-8 lg:min-h-[32rem] lg:px-12"
    >
      <HeroBackdrop image={image} />

      <header className="relative mb-6 flex flex-col gap-2 text-white">
        <h1 id={headingId} className="m-0 text-3xl font-bold sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle !== undefined && (
          <p className="m-0 text-base text-white/90 sm:text-lg">{subtitle}</p>
        )}
      </header>

      {children !== undefined && children !== null && children !== false && (
        // 🔑 Σε `bg-card`: ακολουθεί το θέμα, και τα πεδία μέσα του διαβάζονται με τα
        //    κανονικά tokens — κανένα πεδίο δεν χρειάζεται «λευκή» παραλλαγή.
        <section className="relative flex w-full flex-col gap-3 rounded-lg bg-card p-4 text-foreground shadow-xl lg:w-3/5">
          {children}
        </section>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 🔑 ΟΙ ΣΤΑΘΕΡΕΣ ΤΟΥ ΚΑΔΡΟΥ — εξάγονται για την προσομοίωση του εργαλείου (ADR-881 §5.3)
// ---------------------------------------------------------------------------

/** Η κλάση της φωτογραφίας — `cover` + η εστίαση 2D του CSS Module. */
export const HERO_IMAGE_CLASS = `object-cover ${styles.focal}`;
export const HERO_SCRIM_CLASS =
  'pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10';
/** Η γαλάζια ώρα είναι ήδη σκοτεινή: το πλήρες στρώμα θα την έκανε μαύρη μάζα. */
export const HERO_SCRIM_DUSK_CLASS = 'dark:from-black/60 dark:via-black/30 dark:to-transparent';
/**
 * Το **ίδιο** στρώμα σούρουπου **χωρίς** `dark:`, **πλήρης** κλάση (όχι επικάλυψη πάνω στης μέρας: δύο
 * αντικρουόμενες κλάσεις Tailwind κρίνονται από τη σειρά στο CSS, όχι στο `class`) — για την προσομοίωση του εργαλείου, που δείχνει το
 * σκοτεινό κάδρο δίπλα στο φωτεινό ανεξάρτητα από το θέμα του διαχειριστή. Literal επειδή το Tailwind
 * δεν παράγει κλάσεις από κώδικα· η άγκυρα `hero-legibility.test.ts` απαιτεί ίδιες στάσεις με το από πάνω.
 */
export const HERO_SCRIM_DUSK_FORCED_CLASS =
  'pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent';

interface HeroPictureProps {
  readonly asset: LandingHeroAsset;
  readonly focal: HeroFocalAttributes;
  /** Μόνο η **μονή** εικόνα είναι eager — στο ζεύγος θα κατέβαιναν και οι δύο (§8.81). */
  readonly eager: boolean;
  readonly themeClass?: string;
}

/**
 * **Μία εκδοχή** — από το ράφι ή από το build.
 * ⚠️ Το `fetchPriority="high"` είναι ρητό και στις δύο: το `priority` του Next 15 προφορτώνει, αλλά
 *    **δεν** γράφει το χαρακτηριστικό στο `<img>` (μετρημένο 24/09: `fetchpriority = null`).
 */
function HeroPicture({ asset, focal, eager, themeClass = '' }: HeroPictureProps) {
  const className = `${HERO_IMAGE_CLASS} ${themeClass}`.trim();

  if (asset.sources !== undefined) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.src}
        srcSet={listingImageSrcSet({ sources: asset.sources })}
        sizes="100vw"
        width={asset.width}
        height={asset.height}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority="high"
        decoding="async"
        className={`absolute inset-0 h-full w-full ${className}`}
        {...focal}
      />
    );
  }

  return (
    <Image src={asset.src} alt="" fill priority={eager} fetchPriority="high" sizes="100vw" className={className} {...focal} />
  );
}

/** Φωτογραφία + σκούρο στρώμα. Διακοσμητική: το νόημα το λέει ο τίτλος, όχι η φωτογραφία. */
function HeroBackdrop({ image }: { readonly image: LandingHeroImage }) {
  const focal = heroFocalAttributes(image.focalPoint);

  if (image.dusk === undefined) {
    return (
      <>
        <HeroPicture asset={image.day} focal={focal} eager />
        <span aria-hidden="true" className={HERO_SCRIM_CLASS} />
      </>
    );
  }

  // 🔑 Lazy ⇒ κατεβαίνει μόνο η ορατή — βλ. σχόλιο αρχείου, §8.81.
  return (
    <>
      <HeroPicture asset={image.day} focal={focal} eager={false} themeClass="dark:hidden" />
      <HeroPicture asset={image.dusk} focal={focal} eager={false} themeClass="hidden dark:block" />
      <span aria-hidden="true" className={`${HERO_SCRIM_CLASS} ${HERO_SCRIM_DUSK_CLASS}`} />
    </>
  );
}
