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
 *
 * Προστέθηκαν μετά το πέρασμα μεταλλάξεων (ADR-907 §10.11) — ό,τι επέζησε τότε:
 * - Κ5β: `floor` αντί `round`, ή χαμένο `max(1, …)` ⇒ καμβάς με ακμή 0.
 * - Κ6: όριο σκοτεινού `<=` αντί `<`, αλλαγμένο βάρος καναλιού (Rec. 601), διαίρεση του μέσου με bytes αντί για pixel.
 */

import { LISTING_SHELF } from '@/services/upload/utils/public-shelf-kinds';

import { fileCompanionPath } from '@/lib/files/file-companion-objects';

import {
  VIDEO_POSTER_MAX_EDGE,
  VIDEO_POSTER_MIME,
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

  // 🔴 Τα καρέ των υπόλοιπων tests είναι σχεδόν γκρίζα ⇒ τα τρία βάρη αθροίζουν σε 1 και ΚΑΝΕΝΑ δεν φαίνεται χωριστά:
  // αλλαγμένο βάρος πράσινου, όριο `<=` αντί `<` και διαίρεση με λάθος πλήθος περνούσαν (5 μεταλλάξεις §10.11).
  it('🔴 Κ6 το όριο είναι ΑΥΣΤΗΡΟ: μέση φωτεινότητα ακριβώς 24 ΔΕΝ είναι σκοτεινή, 23 είναι', () => {
    expect(isDarkFrame(pixels(256, [24, 24, 24]))).toBe(false);
    expect(isDarkFrame(pixels(256, [23, 23, 23]))).toBe(true);
    expect(isDarkFrame(pixels(1, [24, 24, 24]))).toBe(false);
  });

  it.each([
    // [κανάλι, τελευταία τιμή που είναι ακόμη σκοτεινή] — η επόμενη περνά το 24. Βάρη Rec. 601: 0,299 · 0,587 · 0,114.
    ['κόκκινο', 0, 80],
    ['πράσινο', 1, 40],
    ['μπλε', 2, 210],
  ] as const)('🔴 Κ6 κάθε κανάλι ζυγίζει με το ΔΙΚΟ του βάρος (%s)', (_name, channel, lastDark) => {
    const colour = (value: number): [number, number, number] => {
      const rgb: [number, number, number] = [0, 0, 0];
      rgb[channel] = value;
      return rgb;
    };

    expect(isDarkFrame(pixels(256, colour(lastDark)))).toBe(true);
    expect(isDarkFrame(pixels(256, colour(lastDark + 1)))).toBe(false);
  });

  it('🔴 Κ6 κορεσμένα χρώματα: καθαρό πράσινο είναι φωτεινό, σκούρο μπλε σκοτεινό — το μάτι, όχι ο μέσος όρος RGB', () => {
    expect(isDarkFrame(pixels(256, [0, 255, 0]))).toBe(false);
    // Μέσος όρος RGB 46 (θα περνούσε ως φωτεινό)· φωτεινότητα 15,8.
    expect(isDarkFrame(pixels(256, [0, 0, 139]))).toBe(true);
  });

  it('🔴 Κ6 ο μέσος διαιρείται με το πλήθος των PIXEL, όχι των bytes: αμυδρό καρέ μέσης 30 δεν είναι σκοτεινό', () => {
    expect(isDarkFrame(pixels(256, [30, 30, 30]))).toBe(false);

    // Μισό μαύρο, μισό 60 ⇒ μέση 30.
    const half = pixels(256, [0, 0, 0]);
    for (let i = 0; i < 128; i++) half.set([60, 60, 60, 255], i * 4);
    expect(isDarkFrame(half)).toBe(false);
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

  // Οι τρεις είσοδοι από πάνω κλιμακώνονται όλες σε ΑΚΕΡΑΙΟΥΣ ⇒ `floor` αντί `round` και χαμένο `max(1, …)` περνούσαν
  // (μεταλλάξεις §10.11).
  it('🔴 Κ5β στρογγυλοποίηση στο πλησιέστερο, και ποτέ ακμή μηδέν', () => {
    // 2001 × (2560 / 3000) = 1707,52 ⇒ 1708 (το `floor` δίνει 1707).
    expect(posterFrameSize(3000, 2001)).toEqual({ width: 2560, height: 1708 });
    expect(posterFrameSize(2001, 3000)).toEqual({ width: 1708, height: 2560 });
    // 2000 × (2560 / 3001) = 1706,1 ⇒ 1706 (το `ceil` δίνει 1707): μαζί με το από πάνω, μόνο το `round` περνά και τα δύο.
    expect(posterFrameSize(2000, 3001)).toEqual({ width: 1706, height: 2560 });
    expect(posterFrameSize(3001, 2000)).toEqual({ width: 2560, height: 1706 });
    // 1 × 0,256 = 0,256 ⇒ στρογγυλεύει στο 0· καμβάς πλάτους 0 δεν δίνει καρέ.
    expect(posterFrameSize(1, 10000)).toEqual({ width: 1, height: 2560 });
    expect(posterFrameSize(10000, 1)).toEqual({ width: 2560, height: 1 });
  });

  it('🔑 Κ5 το ταβάνι ΕΙΝΑΙ το μεγαλύτερο παράγωγο του ραφιού αγγελιών — τα δύο νούμερα δεν χωρίζουν', () => {
    expect(VIDEO_POSTER_MAX_EDGE).toBe(Math.max(...LISTING_SHELF.encoding.widths));
  });

  // Το μητρώο συνοδευτικών ονομάζει το αντικείμενο `_poster.webp`: άλλη μορφή εδώ ⇒ bytes PNG πίσω από κατάληξη WebP.
  it('🔑 η μορφή του καρέ είναι αυτή που υπόσχεται η κατάληξη του συνοδευτικού', () => {
    expect(VIDEO_POSTER_MIME).toBe('image/webp');
    expect(fileCompanionPath('a/file_v1.mp4', 'videoPoster').endsWith('.webp')).toBe(true);
  });
});
