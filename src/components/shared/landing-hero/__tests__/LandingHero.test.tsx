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
import { LANDING_HERO_IMAGES, type LandingHeroImage } from '../landing-hero-images';

function renderHero(children?: React.ReactNode, image: LandingHeroImage = LANDING_HERO_IMAGES.pros) {
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
    expect(decodeURIComponent(img.getAttribute('src') ?? '')).toContain(LANDING_HERO_IMAGES.pros.day);
  });

  it('🌗 ζεύγος μέρα/γαλάζια ώρα (§8.81): δύο <img>, το CSS διαλέγει, και ΚΑΝΕΝΑ δεν είναι eager', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βάλε `priority` στο ζεύγος ⇒ `loading="eager"` ⇒ ο browser
    //    κατεβάζει ΚΑΙ ΤΙΣ ΔΥΟ φωτογραφίες, αφού το `display:none` δεν σταματά eager λήψη.
    const imgs = Array.from(renderHero(undefined, LANDING_HERO_IMAGES.home).querySelectorAll('img'));
    expect(imgs).toHaveLength(2);

    const [day, dusk] = imgs;
    expect(decodeURIComponent(day.getAttribute('src') ?? '')).toContain(LANDING_HERO_IMAGES.home.day);
    expect(decodeURIComponent(dusk.getAttribute('src') ?? '')).toContain(LANDING_HERO_IMAGES.home.dusk);
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
    const imgs = renderHero(undefined, { day: '/images/landing/solo.jpg' }).querySelectorAll('img');
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

  it('🎯 σημείο εστίασης: `lower` κατεβάζει το κάδρο και στις ΔΥΟ εκδοχές· απόν = κέντρο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: αγνόησε το `focus` ⇒ στο `/pro` κόβονται τα σχέδια (μετρημένο 24/09).
    const lower = renderHero(undefined, { day: '/a.jpg', dusk: '/b.jpg', focus: 'lower' });
    for (const img of Array.from(lower.querySelectorAll('img'))) {
      expect(img).toHaveClass('object-[100%_85%]');
      expect(img).not.toHaveClass('object-right');
    }
    cleanup();
    const centered = renderHero(undefined, { day: '/a.jpg', dusk: '/b.jpg' });
    for (const img of Array.from(centered.querySelectorAll('img'))) expect(img).toHaveClass('object-right');
  });

  it('🔑 ένας πίνακας εικόνων — ο κόμβος και οι δύο ακτίνες, καμία κοινή διαδρομή', () => {
    const paths = Object.values(LANDING_HERO_IMAGES).flatMap((image: LandingHeroImage) =>
      image.dusk === undefined ? [image.day] : [image.day, image.dusk],
    );
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/images\/landing\/[a-z-]+\.jpg$/);
  });
});
