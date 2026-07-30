/**
 * lifecycle — Η ΔΙΑΤΑΞΗ ΤΟΥ ΚΥΚΛΟΥ ΖΩΗΣ
 *
 * Το `BOQ_STATUS_RANK` απαντά «ποια κατάσταση είναι χαμηλότερη;». Τα υπάρχοντα
 * `BOQ_AUTO_MANAGED_STATUSES` / `BOQ_FROZEN_BASELINE_STATUSES` απαντούν «τι
 * επιτρέπεται να αγγίξει ο BIM auto-sync;». Διαφορετικές ερωτήσεις — αλλά
 * **δεν επιτρέπεται να αποκλίνουν**: εδώ δένονται ρητά, ώστε προσθήκη
 * κατάστασης σε ένα σημείο να μη μείνει σιωπηλά έξω από το άλλο.
 *
 * @see ADR-734 §6.3 κανόνας 1, ADR-673, ADR-675
 */

import {
  BOQ_STATUS_LIFECYCLE_ORDER,
  BOQ_STATUS_RANK,
  LOWEST_BOQ_ITEM_STATUS,
  boqStatusRank,
  isKnownBoqItemStatus,
  isSignableBoqItemStatus,
} from '@/types/boq';
import {
  BOQ_AUTO_MANAGED_STATUSES,
  BOQ_FROZEN_BASELINE_STATUSES,
} from '@/types/boq/units';

describe('BOQ_STATUS_RANK', () => {
  it('έχει μοναδικές, συνεχείς βαθμίδες από το 0', () => {
    const ranks = Object.values(BOQ_STATUS_RANK).sort((a, b) => a - b);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(ranks).toEqual(ranks.map((_, index) => index));
  });

  it('η παραγόμενη σειρά είναι γνησίως αύξουσα', () => {
    const ranks = BOQ_STATUS_LIFECYCLE_ORDER.map((status) => BOQ_STATUS_RANK[status]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('ξεκινά από το draft', () => {
    expect(LOWEST_BOQ_ITEM_STATUS).toBe('draft');
    expect(BOQ_STATUS_LIFECYCLE_ORDER[0]).toBe('draft');
  });
});

describe('συμφωνία με τα υπάρχοντα SSoT των καταστάσεων', () => {
  it('η διάταξη καλύπτει ΑΚΡΙΒΩΣ τις auto-managed + frozen καταστάσεις', () => {
    const known = new Set([...BOQ_AUTO_MANAGED_STATUSES, ...BOQ_FROZEN_BASELINE_STATUSES]);
    expect(new Set(BOQ_STATUS_LIFECYCLE_ORDER)).toEqual(known);
  });

  it('κάθε auto-managed κατάσταση είναι χαμηλότερη από κάθε frozen', () => {
    const maxAuto = Math.max(...BOQ_AUTO_MANAGED_STATUSES.map(boqStatusRank));
    const minFrozen = Math.min(...BOQ_FROZEN_BASELINE_STATUSES.map(boqStatusRank));
    expect(maxAuto).toBeLessThan(minFrozen);
  });
});

describe('boqStatusRank — fail-closed', () => {
  it('άγνωστη τιμή είναι ΚΑΤΩ από τη χαμηλότερη γνωστή', () => {
    expect(boqStatusRank('ghost')).toBe(-1);
    expect(boqStatusRank(undefined)).toBe(-1);
    expect(boqStatusRank(null)).toBe(-1);
    expect(boqStatusRank(3)).toBe(-1);
    expect(boqStatusRank('ghost')).toBeLessThan(boqStatusRank(LOWEST_BOQ_ITEM_STATUS));
  });

  it('δεν παρασύρεται από ιδιότητες του prototype', () => {
    expect(isKnownBoqItemStatus('toString')).toBe(false);
    expect(isKnownBoqItemStatus('constructor')).toBe(false);
  });
});

describe('isSignableBoqItemStatus', () => {
  it('μόνο certified και locked επιτρέπουν υπογραφή', () => {
    const signable = BOQ_STATUS_LIFECYCLE_ORDER.filter(isSignableBoqItemStatus);
    expect(signable).toEqual(['certified', 'locked']);
  });

  it('άγνωστη κατάσταση ποτέ δεν είναι υπογράψιμη', () => {
    expect(isSignableBoqItemStatus('certified ')).toBe(false);
    expect(isSignableBoqItemStatus(undefined)).toBe(false);
  });
});
