/**
 * @fileoverview **ΕΙΝΑΙ ΑΥΤΗ Η ΣΥΝΔΕΣΗ ΚΑΤΙ ΝΕΟ ΓΙΑ ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ;** — ADR-894 §10 Β3 (καθαρός πυρήνας).
 * @related services/session/new-sign-in-notifier (το κέλυφος που ρωτά και ειδοποιεί)
 * @module services/session/sign-in-novelty
 *
 * Πρακτική Google («New sign-in on …») / GitHub («new device»): ειδοποίηση όταν η σύνδεση έρχεται από **χώρα**
 * ή **συσκευή** που ο λογαριασμός δεν έχει δει πρόσφατα. Εδώ, «πρόσφατα» = οι εγγραφές που κρατάμε (90 ημέρες).
 *
 * - **Χώρα**: μόνο **γνωστή** θέση (`precision !== 'none'`) μετρά — «άγνωστη» δεν είναι «νέα» (localhost, ιδιωτική IP,
 *   βάση που λείπει δεν σημαίνουν ταξίδι). Μετρούν και οι θέσεις σύνδεσης **και** οι τελευταίες (`lastLocation`).
 * - **Συσκευή**: οικογένεια browser + λειτουργικό (όχι έκδοση — μια ενημέρωση του Chrome δεν είναι νέα συσκευή).
 * - **Πρώτη εγγραφή του λογαριασμού** ⇒ καμία ειδοποίηση: δεν υπάρχει μέτρο σύγκρισης (και το Google δεν
 *   ειδοποιεί για τη σύνδεση της δημιουργίας).
 * - Φυσικό debounce: η νέα εγγραφή γίνεται η ίδια ιστορικό ⇒ δεύτερη σύνδεση από την ίδια χώρα δεν ξαναειδοποιεί.
 * ⚠️ VPN ⇒ ψευδής «νέα χώρα»: αποδεκτό, όπως στους μεγάλους — η ειδοποίηση λέει «αν ήσασταν εσείς, τίποτα».
 */

export type SignInNoveltyReason = 'new-country' | 'new-device';

/** Ό,τι ξέρουμε για μια σύνδεση — κωδικοί, όχι κείμενο. */
export interface SignInFacts {
  /** Οι **γνωστές** χώρες της εγγραφής (σύνδεση + τελευταία θέση)· κενό = άγνωστη θέση. */
  readonly countries: readonly string[];
  /** `browserType|os` — ποτέ έκδοση. */
  readonly deviceFamily: string;
}

interface StoredPlaceLike {
  readonly countryCode?: unknown;
  readonly precision?: unknown;
}

interface StoredSessionLike {
  readonly location?: StoredPlaceLike;
  readonly lastLocation?: StoredPlaceLike;
  readonly deviceInfo?: { readonly browserType?: unknown; readonly os?: unknown };
}

const COUNTRY_CODE = /^[A-Z]{2}$/;

function knownCountryOf(place: StoredPlaceLike | undefined): string | null {
  if (!place || place.precision === 'none' || place.precision === undefined) return null;
  return typeof place.countryCode === 'string' && COUNTRY_CODE.test(place.countryCode) ? place.countryCode : null;
}

/** Αποθηκευμένη εγγραφή → γεγονότα. Παλιές εγγραφές (ipapi, χωρίς `precision`) δεν δίνουν χώρα — `legacy`. */
export function signInFactsOf(data: StoredSessionLike | undefined): SignInFacts {
  const countries = [knownCountryOf(data?.location), knownCountryOf(data?.lastLocation)]
    .filter((code): code is string => code !== null);
  const browser = typeof data?.deviceInfo?.browserType === 'string' ? data.deviceInfo.browserType : 'Unknown';
  const os = typeof data?.deviceInfo?.os === 'string' ? data.deviceInfo.os : 'Unknown';
  return { countries: [...new Set(countries)], deviceFamily: `${browser}|${os}` };
}

/** Γιατί αξίζει ειδοποίηση — κενό = καμία. Η σειρά είναι σταθερή (χώρα πρώτα). */
export function assessSignInNovelty(candidate: SignInFacts, history: readonly SignInFacts[]): SignInNoveltyReason[] {
  if (history.length === 0) return [];
  const seenCountries = new Set(history.flatMap((facts) => facts.countries));
  const seenDevices = new Set(history.map((facts) => facts.deviceFamily));
  const reasons: SignInNoveltyReason[] = [];
  if (candidate.countries.some((country) => !seenCountries.has(country))) reasons.push('new-country');
  if (!seenDevices.has(candidate.deviceFamily)) reasons.push('new-device');
  return reasons;
}
