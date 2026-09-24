/**
 * @jest-environment jsdom
 *
 * @fileoverview **Ο κοινός ήρωας** (ADR-777 §8.79 · §8.82).
 * @related components/shared/landing-hero/LandingHero · landing-tabpanel.test (κόμβος) ·
 *          AgencyDirectoryContent.hero.test (`/pro`) · ShortStayLandingContent.test (`/stay`)
 *
 * ⚠️ Η θέση του ήρωα **μέσα στο μέτρο** (άμεσο τέκνο) κρίνεται στη **σύνθεση** κάθε
 *    σελίδας — εδώ κλειδώνεται μόνο ό,τι ανήκει στον ίδιο.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LandingHero } from '../LandingHero';
import { LANDING_HERO_IMAGES } from '../landing-hero-images';
import { LandingHeroesProvider } from '../LandingHeroesProvider';
import type { LandingHeroFallback, LandingHeroImage, LandingHeroSet } from '@/lib/landing/landing-hero-vocabulary';

const SIZE = { width: 1774, height: 887 } as const;

function renderHero(children?: React.ReactNode, image: LandingHeroFallback = LANDING_HERO_IMAGES.pros) {
  const view = render(
    <LandingHero image={image} title="Τίτλος" subtitle="Υπότιτλος">
      {children}
    </LandingHero>,
  ).container;
  return view.firstElementChild as HTMLElement;
}

describe('LandingHero — ADR-777 §8.79 · §8.82', () => {
  it('🔴 ζητά πλήρες πλάτος με ΟΝΟΜΑ, και ονομάζεται από τον τίτλο που του δίνουν', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `data-shell-span` ⇒ ο ήρωας πέφτει στη στήλη κειμένου.
    const hero = renderHero();

    expect(hero.tagName).toBe('SECTION');
    expect(hero).toHaveAttribute('data-shell-span', 'full');

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Τίτλος');
    expect(hero.getAttribute('aria-labelledby')).toBe(h1.id);
    expect(screen.getByText('Υπότιτλος')).toBeInTheDocument();
  });

  it('🔴 η φωτογραφία είναι ΔΙΑΚΟΣΜΗΤΙΚΗ και το LCP της σελίδας — `alt=""`, `fetchpriority="high"`', () => {
    const img = renderHero().querySelector('img') as HTMLImageElement;

    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(decodeURIComponent(img.getAttribute('src') ?? '')).toContain(LANDING_HERO_IMAGES.pros.day.src);
  });

  it('🌗 ζεύγος μέρα/γαλάζια ώρα (§8.81): δύο <img>, το CSS διαλέγει, και ΚΑΝΕΝΑ δεν είναι eager', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βάλε `priority` στο ζεύγος ⇒ `loading="eager"` ⇒ ο browser
    //    κατεβάζει ΚΑΙ ΤΙΣ ΔΥΟ φωτογραφίες, αφού το `display:none` δεν σταματά eager λήψη.
    const imgs = Array.from(renderHero(undefined, LANDING_HERO_IMAGES.home).querySelectorAll('img'));
    expect(imgs).toHaveLength(2);

    const [day, dusk] = imgs;
    expect(decodeURIComponent(day.getAttribute('src') ?? '')).toContain(LANDING_HERO_IMAGES.home.day.src);
    expect(decodeURIComponent(dusk.getAttribute('src') ?? '')).toContain(LANDING_HERO_IMAGES.home.dusk.src);
    expect(day).toHaveClass('dark:hidden');
    expect(dusk).toHaveClass('hidden', 'dark:block');
    for (const img of imgs) {
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('fetchpriority', 'high');
      expect(img).toHaveAttribute('alt', '');
    }
  });

  it('🌗 χωρίς βραδινή εκδοχή: ΜΙΑ εικόνα, eager (priority) — ίδια σε ΚΑΙ ΤΑ ΔΥΟ θέματα', () => {
    // ⚠️ Συνθετική εικόνα: όλες οι γραμμές του πίνακα έχουν σήμερα ζεύγος, αλλά ο κλάδος
    //    μένει (νέα ακτίνα μπαίνει πρώτα με μόνο `day`).
    const solo: LandingHeroFallback = { page: 'home', day: { src: '/images/landing/solo.jpg', ...SIZE }, focalPoint: { x: 1, y: 0.5 } };
    const imgs = renderHero(undefined, solo).querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).not.toHaveAttribute('loading', 'lazy');
    expect(imgs[0]).not.toHaveClass('dark:hidden');
  });

  it('🔴 ΜΕ περιεχόμενο: αποδίδεται ΜΕΣΑ σε πλαίσιο του ήρωα', () => {
    const hero = renderHero(<form aria-label="αναζήτηση" />);

    const form = screen.getByRole('form', { name: 'αναζήτηση' });
    expect(hero.contains(form)).toBe(true);
    expect(form.parentElement?.tagName).toBe('SECTION');
  });

  it('🔴 ΧΩΡΙΣ περιεχόμενο (ή `false`): μόνο τίτλος — κανένα άδειο πλαίσιο που υπόσχεται πεδίο', () => {
    // 🔑 Ίδιος κανόνας με το §8.10: όταν η σελίδα δεν έχει τι να ρωτήσει, δεν το δείχνει.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε τη συνθήκη των `children` ⇒ κοκκινίζει.
    for (const empty of [undefined, false, null]) {
      const hero = renderHero(empty);
      expect(hero.querySelectorAll('section')).toHaveLength(0);
      cleanup();
    }
  });

  it('🎯 σημείο εστίασης (ADR-881 §4.4): ΚΑΙ οι δύο άξονες, ΚΑΙ στις δύο εκδοχές· προεπιλογή = δεξιά/κέντρο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: αγνόησε το `focalPoint` ⇒ στο `/pro` κόβονται τα σχέδια (μετρημένο 24/09).
    const lower = renderHero(undefined, LANDING_HERO_IMAGES.pros);
    for (const img of Array.from(lower.querySelectorAll('img'))) {
      expect(img).toHaveAttribute('data-fx', '100');
      expect(img).toHaveAttribute('data-fy', '85');
      expect(img).toHaveClass('focal');
    }
    cleanup();
    const home = renderHero(undefined, LANDING_HERO_IMAGES.home);
    for (const img of Array.from(home.querySelectorAll('img'))) {
      expect(img).toHaveAttribute('data-fx', '100');
      expect(img).toHaveAttribute('data-fy', '50');
    }
  });

  it('🔑 ένας πίνακας εικόνων — ο κόμβος και οι δύο ακτίνες, καμία κοινή διαδρομή, κάθε γραμμή ξέρει τη σελίδα της', () => {
    const rows = Object.entries(LANDING_HERO_IMAGES);
    for (const [page, row] of rows) expect(row.page).toBe(page);
    const paths = rows.flatMap(([, image]) => [image.day.src, image.dusk.src]);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/images\/landing\/[a-z-]+\.jpg$/);
  });
});

// ---------------------------------------------------------------------------
// ADR-881 §4.3 — δημοσιευμένη έκδοση από το ράφι
// ---------------------------------------------------------------------------

const SHELF = 'https://storage.googleapis.com/public-shelf/landing-heroes/lhrev_1';

function shelfAsset(tag: string) {
  return {
    src: `${SHELF}/${tag}-2560.webp`,
    width: 2560,
    height: 1280,
    sources: [
      { url: `${SHELF}/${tag}-640.webp`, width: 640 },
      { url: `${SHELF}/${tag}-2560.webp`, width: 2560 },
    ],
  };
}

function withPublished(published: Partial<LandingHeroSet>, fallback: LandingHeroFallback) {
  const heroes: LandingHeroSet = { ...LANDING_HERO_IMAGES, ...published };
  return render(
    <LandingHeroesProvider heroes={heroes}>
      <LandingHero image={fallback} title="Τίτλος" />
    </LandingHeroesProvider>,
  ).container;
}

describe('LandingHero — δημοσιευμένη έκδοση (ADR-881 §4.3)', () => {
  const published: LandingHeroImage = { day: shelfAsset('day'), dusk: shelfAsset('dusk'), focalPoint: { x: 0.7, y: 0.3 } };

  it('🔴 υπερισχύει ΜΟΝΟ για τη δική της σελίδα', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: αγνόησε το `page` στο `useLandingHeroImage` ⇒ κοκκινίζει.
    const stay = withPublished({ stay: published }, LANDING_HERO_IMAGES.stay);
    expect(stay.querySelector('img')?.getAttribute('src')).toBe(published.day.src);
    cleanup();
    const home = withPublished({ stay: published }, LANDING_HERO_IMAGES.home);
    expect(decodeURIComponent(home.querySelector('img')?.getAttribute('src') ?? '')).toContain(LANDING_HERO_IMAGES.home.day.src);
  });

  it('🔴 εικόνα ραφιού = `<img srcset>` πάνω στα παράγωγα — ΠΟΤΕ μέσα από τον optimizer', () => {
    const img = withPublished({ stay: published }, LANDING_HERO_IMAGES.stay).querySelector('img');
    expect(img?.getAttribute('src')).not.toContain('/_next/image');
    expect(img?.getAttribute('srcset')).toBe(`${SHELF}/day-640.webp 640w, ${SHELF}/day-2560.webp 2560w`);
    expect(img).toHaveAttribute('data-fx', '70');
    expect(img).toHaveAttribute('data-fy', '30');
  });

  it('🌗 ζεύγος από το ράφι: ΚΑΙ οι δύο lazy, το CSS διαλέγει', () => {
    const imgs = Array.from(withPublished({ stay: published }, LANDING_HERO_IMAGES.stay).querySelectorAll('img'));
    expect(imgs).toHaveLength(2);
    for (const img of imgs) expect(img).toHaveAttribute('loading', 'lazy');
    expect(imgs[0]).toHaveClass('dark:hidden');
    expect(imgs[1]).toHaveClass('hidden', 'dark:block');
  });
});
