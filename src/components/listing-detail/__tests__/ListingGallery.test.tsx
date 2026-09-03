/**
 * Άγκυρες της **ορατής** πρότασης προέλευσης της συλλογής (ADR-841 Α15 · Ο-18).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΤΟ ΜΙΣΟ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΦΥΛΑΓΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `alt` το φυλάνε **τρεις** σουίτες *(ο γραφέας, το δέσιμο, το λεξιλόγιο)*, γιατί
 * ταξιδεύει μέσα στο έγγραφο. Η **ορατή** σημείωση από κάτω δεν ταξίδευε πουθενά —
 * ήταν κυριολεκτικό `t('…ownerNote')` **χωρίς κανέναν κλάδο**, και γι' αυτό **καμία**
 * άγκυρα δεν είχε λόγο να τη ρωτήσει. Έμεινε να λέει *«υλικό του κατόχου»* σε **κάθε**
 * αγγελία γραφείου, ορατή σε **κάθε** επισκέπτη, μέχρι που κάποιος κοίταξε το
 * **γειτονικό** κλειδί.
 *
 * 🔑 **Το `t` επιστρέφει το ΚΛΕΙΔΙ, επίτηδες** *(ίδιο ιδίωμα με το
 * `ListingDetailContent.test.tsx`)*: μια άγκυρα που ψάχνει ελληνικό κείμενο σπάει σε
 * κάθε διόρθωση διατύπωσης και σταδιακά χαλαρώνει. Το αμετάβλητο εδώ είναι *«**ποιο**
 * ερώτημα κάνει η οθόνη»*, και ότι το ερώτημα **αλλάζει με την προέλευση**.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingGallery } from '../ListingGallery';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import type { ListingAuthorship, PublicListing } from '@/types/public-listing';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

function listingWith(authorship: ListingAuthorship, images = 2): PublicListing {
  return {
    authorship,
    agencyName: authorship === 'agency' ? 'ΠΑΓΩΝΗΣ Α.Ε.' : null,
    coverImage: null,
    gallery: Array.from({ length: images }, (_unused, index) => ({
      url: `https://shelf/${index}.webp`,
      width: 1280,
      height: 960,
      // ⚠️ Ο γραφέας βάζει **το κλειδί της προέλευσης**· εδώ το περνάμε αυτούσιο ώστε
      //    η οθόνη να ελεγχθεί για το ότι το **σέβεται**, όχι για το ότι το μαντεύει.
      altKey: LISTING_MATERIAL_KEYS[authorship].galleryAlt,
      sources: [],
    })),
  } as unknown as PublicListing;
}

describe('Γ — Η ΟΡΑΤΗ ΣΗΜΕΙΩΣΗ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΠΡΟΕΛΕΥΣΗ', () => {
  it('🔴 Γ1 — αγγελία ΓΡΑΦΕΙΟΥ ⇒ η σημείωση ζητά το κλειδί ΓΡΑΦΕΙΟΥ', () => {
    render(<ListingGallery listing={listingWith('agency')} />);
    expect(screen.getByText(LISTING_MATERIAL_KEYS.agency.sourceNote)).toBeInTheDocument();
  });

  it('🔴 Γ2 — αγγελία ΙΔΙΩΤΗ ⇒ η σημείωση ζητά το κλειδί ΙΔΙΩΤΗ', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε τη σημείωση σταθερή *(δηλαδή γύρνα στο κυριολεκτικό
    //    `t('…ownerNote')` της Φ3)* ⇒ ένα από τα δύο σκέλη πέφτει, όποιο κι αν
    //    διαλεχτεί. Αυτό ακριβώς έλειπε πριν την Α15.
    render(<ListingGallery listing={listingWith('owner-declared')} />);
    expect(
      screen.getByText(LISTING_MATERIAL_KEYS['owner-declared'].sourceNote),
    ).toBeInTheDocument();
  });

  it('🔑 Γ3 — και οι ΔΥΟ φράσεις δεν εμφανίζονται ΠΟΤΕ μαζί', () => {
    // Μια αγγελία έχει **μία** προέλευση. Δύο σημειώσεις θα σήμαινε ότι η οθόνη
    // ζωγραφίζει και τις δύο και αφήνει τον άνθρωπο να διαλέξει ποια ισχύει.
    render(<ListingGallery listing={listingWith('agency')} />);
    expect(
      screen.queryByText(LISTING_MATERIAL_KEYS['owner-declared'].sourceNote),
    ).not.toBeInTheDocument();
  });

  it('Γ4 — το `alt` κάθε εικόνας είναι το κλειδί ΤΟΥ ΕΓΓΡΑΦΟΥ, με θέση και σύνολο', () => {
    render(<ListingGallery listing={listingWith('agency', 3)} />);
    const images = screen.getAllByRole('img');

    expect(images).toHaveLength(3);
    images.forEach((image, position) => {
      expect(image).toHaveAttribute(
        'alt',
        `${LISTING_MATERIAL_KEYS.agency.galleryAlt}::${JSON.stringify({ index: position + 1, total: 3 })}`,
      );
    });
  });

  it('Γ5 — χωρίς εικόνες: η απουσία ονομάζεται, και ΚΑΜΙΑ σημείωση προέλευσης', () => {
    // ⚠️ Μετρημένο 2026-09-03: η **μόνη** ζωντανή αγγελία ιδιώτη είναι ακριβώς αυτή η
    //    περίπτωση. Μια σημείωση *«οι φωτογραφίες είναι υλικό…»* κάτω από **καμία**
    //    φωτογραφία θα ήταν τρίτη πρόταση που λέει ψέμα.
    render(<ListingGallery listing={listingWith('owner-declared', 0)} />);

    expect(screen.getByText('search-results:detail.media.absent')).toBeInTheDocument();
    expect(
      screen.queryByText(LISTING_MATERIAL_KEYS['owner-declared'].sourceNote),
    ).not.toBeInTheDocument();
  });
});
