/**
 * @fileoverview **ΤΙ ΕΙΝΑΙ ΜΙΑ ΕΙΚΟΝΑ ΗΡΩΑ** — σελίδες, εκδοχές, σχήμα, προδιαγραφή (ADR-881).
 * @related ADR-881 · ADR-777 §8.79 · §8.81 · lib/listings/photo-focal-point
 * @module lib/landing/landing-hero-vocabulary
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΣΧΗΜΑ, ΔΥΟ ΠΗΓΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ήρωας δέχεται την ίδια {@link LandingHeroImage} είτε έρχεται από τον **ενσωματωμένο** πίνακα
 * (`public/images/landing/*`, το δίχτυ ασφαλείας) είτε από **δημοσιευμένη έκδοση** (δημόσιο ράφι).
 * Η διαφορά ζει σε **ένα** πεδίο: τα {@link LandingHeroAsset.sources}. Παρόντα ⇒ παράγωγα ραφιού
 * (`<img srcset>`)· απόντα ⇒ αρχείο του build (`next/image`). Κανένα `if (fromDatabase)` πουθενά.
 *
 * ⚠️ **Καθαρό module**: καμία εξάρτηση από React, Firestore ή `sharp` — το εισάγουν και ο πίνακας
 *    των ειδών του ραφιού (καθαρός) και ο browser.
 */

import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import { FILE_TYPE_CONFIG } from '@/config/file-upload-config';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';

// ============================================================================
// 1. ΣΕΛΙΔΕΣ ΚΑΙ ΕΚΔΟΧΕΣ
// ============================================================================

/**
 * **Οι σελίδες που φορούν ήρωα** — ο κόμβος και οι ακτίνες του (ADR-777 §8.82).
 * ⚠️ Τα ονόματα είναι **κλειδιά αποθήκευσης** (`settings/landing_heroes.pages.<page>`): ποτέ μετονομασία.
 */
export const LANDING_HERO_PAGES = ['home', 'pros', 'stay'] as const;
export type LandingHeroPage = (typeof LANDING_HERO_PAGES)[number];

export function isLandingHeroPage(value: unknown): value is LandingHeroPage {
  return typeof value === 'string' && (LANDING_HERO_PAGES as readonly string[]).includes(value);
}

/**
 * **Μέρα στο φωτεινό, γαλάζια ώρα στο σκοτεινό** (ADR-777 §8.81.2). Η `dusk` είναι η **ίδια** σκηνή.
 */
export const LANDING_HERO_VARIANTS = ['day', 'dusk'] as const;
export type LandingHeroVariant = (typeof LANDING_HERO_VARIANTS)[number];

/**
 * Το **υλικό** μιας πηγής του ραφιού — κουβαλιέται αδιαφανώς (ADR-841 §7 Α17.4).
 * Ζει εδώ, στο καθαρό λεξιλόγιο, ώστε ο πίνακας των ειδών να μη χρειαστεί εξάρτηση προς τα πάνω.
 */
export interface LandingHeroMaterial {
  readonly variant: LandingHeroVariant;
}

// ============================================================================
// 2. ΤΟ ΣΧΗΜΑ ΠΟΥ ΑΠΟΔΙΔΕΤΑΙ
// ============================================================================

/** Ένα παράγωγο: `url` + πλάτος σε pixel — ό,τι μπαίνει ως `w` στο `srcset`. */
export interface LandingHeroSource {
  readonly url: string;
  readonly width: number;
}

/** Μία εκδοχή (μέρα ή σούρουπο) — έτοιμη για απόδοση. */
export interface LandingHeroAsset {
  /** Το **μεγαλύτερο** διαθέσιμο — ο στόχος του `src`. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /**
   * **Παράγωγα του ραφιού**, αύξον πλάτος. Απόντα ⇒ αρχείο του build, που το βελτιστοποιεί το
   * `next/image`. ⛔ Ποτέ και τα δύο: θα ήταν διπλή κωδικοποίηση (ADR-881 §2).
   */
  readonly sources?: readonly LandingHeroSource[];
}

/**
 * **Η εικόνα ήρωα μιας σελίδας.**
 * 🎯 Το `focalPoint` είναι **κοινό** για μέρα και σούρουπο — το κάδρο είναι ίδιο (§8.81.2).
 * ⚠️ Εφαρμόζεται **αυτούσιο** (`object-position: x% y%`), **όχι** κεντραρισμένο όπως στις κάρτες
 *    (ADR-881 §4.4): η σύνθεση του ήρωα **θέλει** το θέμα δεξιά και τον τίτλο αριστερά.
 */
export interface LandingHeroImage {
  readonly day: LandingHeroAsset;
  /** Απούσα ⇒ η `day` και στα δύο θέματα. */
  readonly dusk?: LandingHeroAsset;
  readonly focalPoint: PhotoFocalPoint;
}

/**
 * Η **ενσωματωμένη** εικόνα μιας σελίδας — ό,τι δίνει ο καταναλωτής στον ήρωα. Κουβαλά το `page`
 * ώστε ο ήρωας να ρωτήσει *«υπάρχει δημοσιευμένη έκδοση για ΑΥΤΗ τη σελίδα;»* χωρίς ο καταναλωτής
 * να αλλάξει (ADR-881 §4.3).
 */
export interface LandingHeroFallback extends LandingHeroImage {
  readonly page: LandingHeroPage;
}

/**
 * 🎯 **Η προεπιλεγμένη εστίαση του ήρωα = ο κανόνας της σύνθεσης**: θέμα δεξιά, κάθετο κέντρο (η ιστορική
 * `object-right`). ⚠️ **ΟΧΙ ο αυτόματος εντοπισμός του ADR-880** — μετρημένο 2026-09-24 στη δοκιμή από άκρη σε
 * άκρη: για τη βεράντα του `/stay` έδωσε `{0,44 , 0,875}` και το κάδρο κατέβηκε στο πάτωμα, κόβοντας το χωριό.
 * Ο ανιχνευτής ψάχνει το «ενδιαφέρον» μιας φωτογραφίας ακινήτου· ο ήρωας έχει σύνθεση **ορισμένη εκ των
 * προτέρων** από τις ίδιες τις εντολές AI (ADR-881 §8.6).
 */
export const LANDING_HERO_DEFAULT_FOCAL_POINT: PhotoFocalPoint = { x: 1, y: 0.5 };

/** Όλες οι σελίδες, πάντα — κάθε σελίδα έχει εικόνα (δημοσιευμένη ή ενσωματωμένη). */
export type LandingHeroSet = Readonly<Record<LandingHeroPage, LandingHeroImage>>;

// ============================================================================
// 3. ΤΑΥΤΟΤΗΤΑ ΕΚΔΟΣΗΣ
// ============================================================================

const REVISION_ID_PATTERN = new RegExp(`^${ENTERPRISE_ID_PREFIXES.LANDING_HERO_REVISION}_[A-Za-z0-9-]+$`);

/**
 * Είναι αυτό ταυτότητα **έκδοσης ήρωα** (`lhrev_*`);
 * 🔴 Είναι **και** ο φρουρός του δημόσιου ραφιού: η ταυτότητα γίνεται πρόθεμα κλειδιού στον
 * δημόσιο κάδο, άρα επιτρέπονται **μόνο** χαρακτήρες που δεν ανοίγουν διαδρομή (`/`, `..`).
 */
export function isLandingHeroRevisionId(value: unknown): value is string {
  return typeof value === 'string' && REVISION_ID_PATTERN.test(value);
}

// ============================================================================
// 4. Η ΠΡΟΔΙΑΓΡΑΦΗ ΑΝΕΒΑΣΜΑΤΟΣ (ADR-881 §4.6)
// ============================================================================

/**
 * **Τι δέχεται το εργαλείο** — τα μπλοκ και τα κατώφλια προειδοποίησης σε **ένα** σημείο.
 * 🔑 Ο λόγος [1,5 , 2,2] δέχεται **και** το 3:2 του ChatGPT (1536×1024, το φαρδύτερο που βγάζει)
 *    **και** το 2:1 του Midjourney: ο ήρωας κόβει ούτως ή άλλως (~2,9:1 σε μεγάλη οθόνη, <2:1 σε
 *    κινητό) και η εστίαση κρατά το θέμα. Πέρα από αυτά το κάδρο χάνεται.
 */
export const LANDING_HERO_UPLOAD_SPEC = {
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  /** Ό,τι **δέχεται** το εργαλείο από τον άνθρωπο (ένα PNG 2400×1200 από AI συχνά > 5 MB). */
  maxBytes: 20 * 1024 * 1024,
  /**
   * Ό,τι δέχεται ο **αγωγός ανεβάσματος** (`FILE_TYPE_CONFIG.image.maxSize`, SSoT) — πάνω από αυτό ο
   * browser ξανακωδικοποιεί τοπικά σε WebP q95 πριν ανεβεί (ADR-881 §4.6). Δεμένο, όχι αντιγραμμένο.
   */
  uploadMaxBytes: FILE_TYPE_CONFIG.image.maxSize,
  minWidth: 1536,
  minHeight: 768,
  minAspect: 1.5,
  maxAspect: 2.2,
  /** Κάτω από αυτό: προειδοποίηση — μαλακό σε οθόνη υψηλής πυκνότητας. */
  targetWidth: 2400,
  targetAspect: 2,
  /** Απόκλιση από το 2:1 που δεν αξίζει προειδοποίηση. */
  aspectTolerance: 0.03,
} as const;

export type LandingHeroAcceptedType = (typeof LANDING_HERO_UPLOAD_SPEC.acceptedTypes)[number];
