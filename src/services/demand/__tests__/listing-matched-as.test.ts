/**
 * @fileoverview **«ΤΑΙΡΙΑΖΕΙ ΩΣ…» ΣΤΗΝ ΕΙΔΟΠΟΙΗΣΗ** (ADR-777 §8.60.16) — η πρόταση και η ένωση των λόγων.
 *
 * 🔑 **Δεύτερη φωνή**: οι προσδοκίες είναι χειρόγραφο κείμενο, ποτέ ξαναϋπολογισμένο με τις ίδιες
 * συναρτήσεις. Τα κενά κανονικοποιούνται (το `Intl` βάζει NBSP πριν το «€»).
 */

import type { DemandSeekMet } from '@/lib/demand/demand-matching';
import { demand, listing as listingFixture } from '@/lib/demand/__tests__/demand-fixtures';

import { matchAnnouncementCopy, matchedAsSentence } from '../listing-announcement-copy';
import { mergeMetOn, type TopicReason } from '../listing-match-topics';

const plain = (text: string | undefined): string | undefined => text?.replace(/\s/g, ' ');

const RENT: DemandSeekMet = { kind: 'leaseOut', role: 'rent', amount: 850, headroomBy: 50 };
const SALE: DemandSeekMet = { kind: 'sell', role: 'sale', amount: 170_000, headroomBy: null };

describe('matchedAsSentence — ως τι, σε ποια μονάδα, πόσο κάτω από το όριο', () => {
  it('μία συναλλαγή με περιθώριο', () => {
    expect(plain(matchedAsSentence([RENT]))).toBe(
      'Ταιριάζει ως ενοικίαση (850,00 €/μήνα, 50,00 €/μήνα κάτω από το όριό σας).',
    );
  });

  it('δύο συναλλαγές ⇒ και οι δύο, με τη σειρά που ήρθαν', () => {
    expect(plain(matchedAsSentence([SALE, RENT]))).toBe(
      'Ταιριάζει ως αγορά (170.000,00 €) και ως ενοικίαση (850,00 €/μήνα, 50,00 €/μήνα κάτω από το όριό σας).',
    );
  });

  it('ακριβώς στο όριο ⇒ «ακριβώς στο όριό σας», όχι «0 € κάτω»', () => {
    expect(plain(matchedAsSentence([{ ...RENT, headroomBy: 0 }]))).toBe(
      'Ταιριάζει ως ενοικίαση (850,00 €/μήνα, ακριβώς στο όριό σας).',
    );
  });

  it('αντιπαροχή χωρίς δηλωμένο ποσοστό ⇒ «προς συζήτηση», κανένα ευρώ', () => {
    const exchange: DemandSeekMet = { kind: 'exchange', landownerShare: null, headroomBy: null };
    expect(matchedAsSentence([exchange])).toBe('Ταιριάζει ως αντιπαροχή (ποσοστό προς συζήτηση).');
  });

  it('🔴 αντιπαροχή με ποσοστό ⇒ «% στον οικοπεδούχο» και περιθώριο σε ΜΟΝΑΔΕΣ, ποτέ «€»', () => {
    const exchange: DemandSeekMet = { kind: 'exchange', landownerShare: 35, headroomBy: 5 };
    expect(matchedAsSentence([exchange])).toBe(
      'Ταιριάζει ως αντιπαροχή (35% στον οικοπεδούχο, 5 μονάδες κάτω από το όριό σας).',
    );
  });

  it('κανένα «ως τι» ⇒ καμία πρόταση (όχι «Ταιριάζει .»)', () => {
    expect(matchedAsSentence([])).toBeUndefined();
  });
});

describe('mergeMetOn — πολλές ζητήσεις του ίδιου ανθρώπου, ΜΙΑ ένωση', () => {
  const reason = (id: string, metOn: readonly DemandSeekMet[]): TopicReason => ({
    demand: demand({ id }),
    metOn,
  });

  it('ένας λόγος ⇒ το περιθώριο μένει', () => {
    expect(mergeMetOn([reason('dmnd_a', [RENT])])).toEqual([RENT]);
  });

  it('🔴 δύο λόγοι ⇒ ένωση ΑΝΑ ΕΙΔΟΣ (όχι «ως ενοικίαση και ως ενοικίαση»), χωρίς περιθώριο', () => {
    const merged = mergeMetOn([
      reason('dmnd_a', [RENT]),
      reason('dmnd_b', [SALE, { ...RENT, headroomBy: 300 }]),
    ]);
    expect(merged).toEqual([
      { ...RENT, headroomBy: null },
      { ...SALE, headroomBy: null },
    ]);
  });
});

describe('matchAnnouncementCopy — το «ως τι» ζει στο σώμα, πριν από κάθε μείωση', () => {
  const listing = listingFixture({ title: 'Δυάρι', priceReduction: null });
  const reasons = { demandIds: ['dmnd_a'], seeks: [[]], names: ['Ενοικίαση · Κορδελιό'] };

  it('χωρίς μείωση ⇒ σώμα = η πρόταση «ως τι»', () => {
    const copy = matchAnnouncementCopy({ listing, reasons, metOn: [RENT] }, 0);
    expect(copy.titleKey).toBe('demandListingMatch.namedTitle');
    expect(copy.title).toBe('Νέα αγγελία για τη ζήτηση «Ενοικίαση · Κορδελιό»: «Δυάρι»');
    expect(plain(copy.body)).toBe('Ταιριάζει ως ενοικίαση (850,00 €/μήνα, 50,00 €/μήνα κάτω από το όριό σας).');
  });

  it('χωρίς «ως τι» ⇒ κανένα σώμα, όπως πριν', () => {
    expect(matchAnnouncementCopy({ listing, reasons, metOn: [] }, 0).body).toBeUndefined();
  });
});
