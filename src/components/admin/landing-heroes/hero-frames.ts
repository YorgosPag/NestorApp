/**
 * @fileoverview **Τα κάδρα της προσομοίωσης** — πώς φαίνεται ο ήρωας σε κάθε συσκευή (ADR-881 §5.3).
 * @related LandingHero (κλάσεις `px-4/sm:px-8/lg:px-12` · `min-h-[26rem]/lg:min-h-[32rem]` · `lg:w-3/5`) ·
 *   lib/landing/hero-legibility
 * @module components/admin/landing-heroes/hero-frames
 *
 * 🔴 **ΓΙΑΤΙ ΠΡΟΣΟΜΟΙΩΣΗ ΚΑΙ ΟΧΙ iframe** (τρόπος Shopify/Webflow): το `middleware.ts` στέλνει
 *    `X-Frame-Options: DENY` — απόφαση ασφαλείας που **δεν** χαλαρώνει για ένα εργαλείο. Και το
 *    Tailwind κρίνει breakpoints με το **παράθυρο**, άρα ένας ήρωας σε στενό `div` δεν θα γινόταν «κινητό».
 *
 * 📏 **ΠΡΟΕΛΕΥΣΗ ΤΩΝ ΑΡΙΘΜΩΝ**: το `lg` είναι **μετρημένο** (2026-09-24, `/stay`: ήρωας 2272×512 σε
 *    παράθυρο 2400, τίτλος y 0,27–0,38, υπότιτλος y 0,39–0,43, περιθώριο 48px). Τα στενότερα είναι
 *    **υπολογισμένα από τις κλάσεις** του ήρωα — το μεγιστοποιημένο παράθυρο δεν αλλάζει μέγεθος
 *    (ίδιο εμπόδιο με το ADR-777 §8.79.6). Ύψος κινητού = περιεχόμενο (2 γραμμές τίτλου + υπότιτλος +
 *    πλαίσιο) > `min-h` 416.
 */

import type { HeroTextZone } from '@/lib/landing/hero-legibility';

export interface HeroFrame {
  readonly id: 'mobile' | 'tablet' | 'laptop' | 'desktop';
  /** Πλάτος παραθύρου της συσκευής (για την ετικέτα). */
  readonly viewport: number;
  /** Το κουτί του ήρωα σε CSS px. */
  readonly width: number;
  readonly height: number;
  /** Πού κάθεται τίτλος + υπότιτλος, σε κλάσματα του κουτιού. */
  readonly textZone: HeroTextZone;
  /** Η αναλογία ως **literal** Tailwind (N.3: κανένα inline style· το Tailwind δεν εκτελεί κώδικα). */
  readonly aspectClass: string;
}

/** Ζώνη κειμένου: αριστερό περιθώριο → στήλη πλάτους `column` του περιεχομένου· κάθετα `y0..y1`. */
function zone(width: number, pad: number, column: number, y0: number, y1: number): HeroTextZone {
  return { x0: pad / width, x1: (pad + column * (width - 2 * pad)) / width, y0, y1 };
}

export const HERO_FRAMES: readonly HeroFrame[] = [
  { id: 'mobile', viewport: 390, width: 358, height: 460, textZone: zone(358, 16, 1, 0.09, 0.4), aspectClass: 'aspect-[358/460]' },
  { id: 'tablet', viewport: 768, width: 704, height: 416, textZone: zone(704, 32, 0.9, 0.2, 0.42), aspectClass: 'aspect-[704/416]' },
  { id: 'laptop', viewport: 1440, width: 1312, height: 512, textZone: zone(1312, 48, 0.6, 0.26, 0.44), aspectClass: 'aspect-[1312/512]' },
  { id: 'desktop', viewport: 1920, width: 1792, height: 512, textZone: zone(1792, 48, 0.6, 0.26, 0.44), aspectClass: 'aspect-[1792/512]' },
];
