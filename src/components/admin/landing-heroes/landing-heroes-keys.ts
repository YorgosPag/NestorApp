/**
 * @fileoverview **Κάθε κλειδί i18n του εργαλείου ηρώων, ως literal** (ADR-881 · N.11).
 * @module components/admin/landing-heroes/landing-heroes-keys
 *
 * 🔑 Πίνακες και όχι `t(\`…${code}\`)`: η πύλη 3.8 **διαβάζει** κλειδιά, δεν τα εκτελεί — ένα
 *    συναρμολογημένο κλειδί θα ήταν αόρατο, άρα ένα κλειδί που λείπει θα έφτανε στην οθόνη ωμό.
 *    Κάθε πίνακας είναι `Record<ένωση, …>`: νέα τιμή στο λεξιλόγιο ⇒ ο μεταγλωττιστής ζητά γραμμή.
 */

import type { HeroLegibilityVerdict } from '@/lib/landing/hero-legibility';
import type { LandingHeroFocalOrigin } from '@/lib/landing/landing-hero-document';
import type { HeroUploadIssueCode } from '@/lib/landing/hero-upload-check';
import type { LandingHeroPage, LandingHeroVariant } from '@/lib/landing/landing-hero-vocabulary';

import type { HeroFrame } from './hero-frames';
import type { HeroAdminError } from './useLandingHeroesAdmin';

export const LANDING_HEROES_NS = 'landing-heroes-admin';

export const HERO_PAGE_KEYS: Readonly<Record<LandingHeroPage, string>> = {
  home: 'pages.home',
  pros: 'pages.pros',
  stay: 'pages.stay',
};

export const HERO_VARIANT_KEYS: Readonly<Record<LandingHeroVariant, string>> = {
  day: 'composer.day',
  dusk: 'composer.dusk',
};

export const HERO_ISSUE_KEYS: Readonly<Record<HeroUploadIssueCode, string>> = {
  'type-not-accepted': 'issues.typeNotAccepted',
  'too-large': 'issues.tooLarge',
  'too-small': 'issues.tooSmall',
  'aspect-out-of-range': 'issues.aspectOutOfRange',
  'below-target-width': 'issues.belowTargetWidth',
  'aspect-not-target': 'issues.aspectNotTarget',
  'pair-size-mismatch': 'issues.pairSizeMismatch',
};

export const HERO_ERROR_KEYS: Readonly<Record<HeroAdminError, string>> = {
  'foreign-source': 'errors.foreignSource',
  'shelf-failed': 'errors.shelfFailed',
  'unreadable-image': 'errors.unreadableImage',
  'dimensions-rejected': 'errors.dimensionsRejected',
  'revision-not-found': 'errors.revisionNotFound',
  'invalid-target': 'errors.invalidTarget',
  'upload-failed': 'errors.uploadFailed',
  'too-large': 'errors.tooLarge',
  'no-identity': 'errors.noIdentity',
  network: 'errors.network',
};

export const HERO_FRAME_KEYS: Readonly<Record<HeroFrame['id'], string>> = {
  mobile: 'preview.frames.mobile',
  tablet: 'preview.frames.tablet',
  laptop: 'preview.frames.laptop',
  desktop: 'preview.frames.desktop',
};

export const HERO_THEME_KEYS: Readonly<Record<LandingHeroVariant, string>> = {
  day: 'preview.themes.day',
  dusk: 'preview.themes.dusk',
};

export const HERO_VERDICT_KEYS: Readonly<Record<HeroLegibilityVerdict, string>> = {
  pass: 'legibility.pass',
  'large-only': 'legibility.largeOnly',
  fail: 'legibility.fail',
};

export const HERO_FOCAL_ORIGIN_KEYS: Readonly<Record<LandingHeroFocalOrigin, string>> = {
  declared: 'history.focalDeclared',
  detected: 'history.focalDetected',
  default: 'history.focalDefault',
};

/** Οι έτοιμες εντολές AI — βήμα 1 ανά σελίδα· το βήμα 2 (γαλάζια ώρα) είναι κοινό. */
export const HERO_PROMPT_KEYS: Readonly<Record<LandingHeroPage, string>> = {
  home: 'guide.prompts.home',
  pros: 'guide.prompts.pros',
  stay: 'guide.prompts.stay',
};

export const HERO_GUIDE_RULE_KEYS = [
  'guide.rules.aspect',
  'guide.rules.subjectRight',
  'guide.rules.safeBands',
  'guide.rules.noText',
  'guide.rules.greek',
  'guide.rules.sameScene',
  'guide.rules.resolution',
] as const;
