/**
 * @fileoverview **Το καρέ του εξωφύλλου** — η κρίση «ποιο καρέ» (ADR-907 §10.8). Το DOM (`<video>` + καμβάς) δεν υπάρχει
 * στο jsdom· εδώ φυλάσσεται ό,τι **αποφασίζει**, και η λήψη επαληθεύεται στον browser.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Κ1: το πρώτο καρέ (0″) γίνεται η πρώτη επιλογή, ή η σειρά μέσο → τέταρτο → τρία τέταρτα αλλάζει.
 * - Κ2: διάρκεια που δεν διαβάζεται δίνει `NaN` στο `currentTime` αντί για την αρχή.
 * - Κ3: σκοτεινό καρέ κερδίζει φωτεινό· ή, όταν όλα είναι σκοτεινά, δεν επιστρέφεται κανένα.
 * - Κ4: στιγμή που δεν έδωσε καρέ ακυρώνει τις επόμενες.
 * - Κ5: το καρέ μεγεθύνεται, χάνει την αναλογία του, ή το ταβάνι του χωρίζει από το μεγαλύτερο παράγωγο του ραφιού.
 */

import { LISTING_SHELF } from '@/services/upload/utils/public-shelf-kinds';

import {
  VIDEO_POSTER_MAX_EDGE,
  isDarkFrame,
  pickPosterFrame,
  posterFrameSize,
  posterFrameTimes,
  type PosterFrameCandidate,
} from '../video-poster-frame';

function pixels(count: number, [r, g, b]: readonly [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) data.set([r, g, b, 255], i * 4);
  return data;
}

function frame(name: string, dark: boolean): PosterFrameCandidate {
  return { blob: new Blob([name]), dark };
}

describe('posterFrameTimes', () => {
  it('🔴 Κ1 το ΜΕΣΟ πρώτα, μετά το ένα τέταρτο και τα τρία τέταρτα — ποτέ το πρώτο καρέ', () => {
    expect(posterFrameTimes(120)).toEqual([60, 30, 90]);
    expect(posterFrameTimes(9.2)[0]).toBeCloseTo(4.6);
    expect(posterFrameTimes(120)).not.toContain(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -3])('🔴 Κ2 διάρκεια %p ⇒ η αρχή, ποτέ `NaN`', (duration) => {
    expect(posterFrameTimes(duration)).toEqual([0]);
  });
});

describe('isDarkFrame', () => {
  it('μαύρο και σχεδόν μαύρο είναι σκοτεινά· ένα συνηθισμένο δωμάτιο όχι', () => {
    expect(isDarkFrame(pixels(256, [0, 0, 0]))).toBe(true);
    expect(isDarkFrame(pixels(256, [12, 12, 12]))).toBe(true);
    expect(isDarkFrame(pixels(256, [90, 80, 70]))).toBe(false);
  });

  it('κρίνει τον ΜΕΣΟ όρο: λίγα φωτεινά pixel σε μαύρο καρέ δεν το σώζουν', () => {
    const mostlyBlack = pixels(256, [0, 0, 0]);
    mostlyBlack.set([255, 255, 255, 255], 0);

    expect(isDarkFrame(mostlyBlack)).toBe(true);
  });

  it('κενό δείγμα ⇒ σκοτεινό: δεν υπάρχει εικόνα να δείξει', () => {
    expect(isDarkFrame(new Uint8ClampedArray(0))).toBe(true);
  });
});

describe('pickPosterFrame', () => {
  it('🔴 Κ3 το πρώτο ΦΩΤΕΙΝΟ με τη σειρά των στιγμών — το σκοτεινό μέσο προσπερνιέται', async () => {
    const grab = jest.fn(async (time: number) => frame(String(time), time === 60));

    const picked = await pickPosterFrame([60, 30, 90], grab);

    expect(await picked?.text()).toBe('30');
    expect(grab).toHaveBeenCalledTimes(2);
  });

  it('🔴 Κ3 όλα σκοτεινά ⇒ κρατιέται το ΜΕΣΟ — το βίντεο είναι σκοτεινό, δεν μένει χωρίς εξώφυλλο', async () => {
    const picked = await pickPosterFrame([60, 30, 90], async (time) => frame(String(time), true));

    expect(await picked?.text()).toBe('60');
  });

  it('🔴 Κ4 στιγμή που δεν έδωσε καρέ προσπερνιέται· καμία ⇒ `null`', async () => {
    const picked = await pickPosterFrame([60, 30, 90], async (time) => (time === 60 ? null : frame(String(time), false)));

    expect(await picked?.text()).toBe('30');
    expect(await pickPosterFrame([60, 30], async () => null)).toBeNull();
  });
});

describe('posterFrameSize', () => {
  it('🔴 Κ5 ποτέ μεγέθυνση· μεγάλο καρέ μικραίνει με την αναλογία του', () => {
    expect(posterFrameSize(1024, 464)).toEqual({ width: 1024, height: 464 });
    expect(posterFrameSize(3840, 2160)).toEqual({ width: 2560, height: 1440 });
    expect(posterFrameSize(2160, 3840)).toEqual({ width: 1440, height: 2560 });
  });

  it('🔑 Κ5 το ταβάνι ΕΙΝΑΙ το μεγαλύτερο παράγωγο του ραφιού αγγελιών — τα δύο νούμερα δεν χωρίζουν', () => {
    expect(VIDEO_POSTER_MAX_EDGE).toBe(Math.max(...LISTING_SHELF.encoding.widths));
  });
});
