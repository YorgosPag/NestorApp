/**
 * @fileoverview **Οι λέξεις της βιβλιοθήκης μέσων** — κάθε χάρτης δεμένος στη ρίζα του λεξιλογίου (ADR-923 §5.10.4).
 * @related components/catalog/shared/catalog-labels.ts (οι λέξεις του σχήματος — το ιδίωμα) ·
 *   subapps/catalog/vocabulary/asset-roles.ts · renditions/catalog-renditions.ts · lib/images/image-colour.ts ·
 *   constants/media-rights-vocabulary.ts
 * @module components/catalog/assets/asset-labels
 *
 * 🔑 **`Record<Ρίζα, …>`, ποτέ `Record<string, …>`** (CHECK 3.73): νέος ρόλος, χρωματικός τύπος, αιτία αποτυχίας
 *    απόδοσης ή σκοπός άδειας **δεν μεταγλωττίζεται** μέχρι να αποκτήσει λέξη — και ο ρόλος εικονίδιο (CHECK 3.41).
 * 🔑 Οι σκοποί του **καταλόγου** ζουν εδώ, στο namespace `catalog` — **όχι** στο `spatial-tour` (εκείνο κρατά το πλαίσιο
 *    `listing`). Ίδιος ορισμός ανά πλαίσιο, δύο namespaces.
 * ⚠️ Κυριολεκτικά κλειδιά (όχι template): οι γεννήτορες i18n (route slice · CHECK 3.8) τα **λύνουν** στατικά.
 */

import { Award, Box, Clapperboard, FileText, Image as ImageIcon, Leaf, NotebookText, PencilRuler, type LucideIcon } from 'lucide-react';

import type { MediaLicensePurposeIn } from '@/constants/media-rights-vocabulary';
import type { ImageColourModel } from '@/lib/images/image-colour';
import type { MediaLicenseStanding } from '@/lib/media-rights/media-license-standing';
import type { DraftTermKind, MediaRightsDraftIssue } from '@/lib/media-rights/media-rights-draft';
import type { CatalogRenditionFailure, CatalogRenditionsStanding, CatalogRenditionUse } from '@/subapps/catalog/renditions/catalog-renditions';
import type { CatalogAssetRole } from '@/subapps/catalog/vocabulary/asset-roles';
import type { IntakeStage } from './asset-intake-model';

export const ASSET_ROLE_KEYS: Readonly<Record<CatalogAssetRole, string>> = {
  photo: 'assets.roles.photo',
  drawing: 'assets.roles.drawing',
  datasheet: 'assets.roles.datasheet',
  manual: 'assets.roles.manual',
  certificate: 'assets.roles.certificate',
  epd: 'assets.roles.epd',
  bim: 'assets.roles.bim',
  video: 'assets.roles.video',
};

export const ASSET_ROLE_ICONS: Readonly<Record<CatalogAssetRole, LucideIcon>> = {
  photo: ImageIcon,
  drawing: PencilRuler,
  datasheet: FileText,
  manual: NotebookText,
  certificate: Award,
  epd: Leaf,
  bim: Box,
  video: Clapperboard,
};

export const COLOUR_MODEL_KEYS: Readonly<Record<ImageColourModel, string>> = {
  rgb: 'assets.colour.models.rgb',
  cmyk: 'assets.colour.models.cmyk',
  grey: 'assets.colour.models.grey',
  lab: 'assets.colour.models.lab',
  other: 'assets.colour.models.other',
};

export const RENDITION_USE_KEYS: Readonly<Record<CatalogRenditionUse, string>> = {
  web: 'assets.renditions.uses.web',
  print: 'assets.renditions.uses.print',
};

export const RENDITION_STANDING_KEYS: Readonly<Record<CatalogRenditionsStanding, string>> = {
  ready: 'assets.renditions.standing.ready',
  failed: 'assets.renditions.standing.failed',
  stale: 'assets.renditions.standing.stale',
};

export const RENDITION_FAILURE_KEYS: Readonly<Record<CatalogRenditionFailure, string>> = {
  undecodable: 'assets.renditions.failures.undecodable',
  tooLarge: 'assets.renditions.failures.tooLarge',
};

export const CATALOG_LICENSE_PURPOSE_KEYS: Readonly<Record<MediaLicensePurposeIn<'catalog'>, string>> = {
  'catalog-publication': 'assets.licence.purposes.catalogPublication',
  'reseller-reuse': 'assets.licence.purposes.resellerReuse',
  unrestricted: 'assets.licence.purposes.unrestricted',
};

export const LICENSE_TERM_KIND_KEYS: Readonly<Record<DraftTermKind, string>> = {
  perpetual: 'assets.licence.termKinds.perpetual',
  date: 'assets.licence.termKinds.date',
};

/** Ίδιες λέξεις με τα ευρήματα του γραφέα (`catalog:issues.*`) — μία ετικέτα ανά αστοχία, όχι δύο. */
export const LICENSE_DRAFT_ISSUE_KEYS: Readonly<Record<MediaRightsDraftIssue, string>> = {
  creatorRequired: 'issues.rightsCreatorRequired',
  termDateRequired: 'issues.rightsTermDateRequired',
};

export const LICENSE_STANDING_KEYS: Readonly<Record<MediaLicenseStanding, string>> = {
  active: 'assets.licence.standing.active',
  expired: 'assets.licence.standing.expired',
  'mandate-ended': 'assets.licence.standing.mandateEnded',
};

/**
 * **Τι υποτέθηκε** σε μια απόδοση πηγής χωρίς προφίλ — εξαρτάται από τον χώρο της πηγής **και** τη χρήση. Ένα CMYK χωρίς
 * προφίλ **δεν** «ερμηνεύεται ως sRGB» στην εκτύπωση: κρατά τους αριθμούς του (μετρημένο ζωντανά, 2026-10-26 — η ετικέτα
 * έλεγε το αντίθετο από τα bytes).
 */
export type AssumedProfileKind = 'rgb' | 'cmykWeb' | 'cmykPrint';

export function assumedProfileKind(use: CatalogRenditionUse, sourceModel: ImageColourModel | null): AssumedProfileKind {
  if (sourceModel !== 'cmyk') return 'rgb';
  return use === 'print' ? 'cmykPrint' : 'cmykWeb';
}

export const ASSUMED_PROFILE_KEYS: Readonly<Record<AssumedProfileKind, string>> = {
  rgb: 'assets.renditions.assumed.rgb',
  cmykWeb: 'assets.renditions.assumed.cmykWeb',
  cmykPrint: 'assets.renditions.assumed.cmykPrint',
};

/** «Κρατήθηκε ο χώρος της πηγής» — **και** το προφίλ της μόνο όταν υπήρχε. */
export const COLOUR_PRESERVED_KEYS = {
  withProfile: 'assets.renditions.colourPreservedWithProfile',
  withoutProfile: 'assets.renditions.colourPreserved',
} as const;

export const INTAKE_STAGE_KEYS: Readonly<Record<IntakeStage, string>> = {
  create: 'assets.intake.stages.create',
  upload: 'assets.intake.stages.upload',
  attach: 'assets.intake.stages.attach',
};
