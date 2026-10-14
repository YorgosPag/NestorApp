/**
 * @fileoverview **Από το διαβασμένο ΠΕΑ στην ΠΡΟΤΑΣΗ για το μπλοκ** (ADR-777 §8.96) — καθαρή· ποτέ εγγραφή.
 * @related `./pea-text.ts` (η ανάγνωση) · `./energy-class-ratio.ts` (η κλάση) · `./energy-certificate.ts` (το μπλοκ) ·
 *   `components/shared/energy-certificate/EnergyCertificateImportReview.tsx` (ο άνθρωπος που επιβεβαιώνει)
 * @module lib/energy-certificate/pea-proposal
 *
 * 🔑 **Πρόταση, όχι εγγραφή**: η εισαγωγή δεν γράφει ποτέ το μπλοκ. Ο άνθρωπος βλέπει «τρέχον → από ΠΕΑ», απαντά ό,τι
 * δεν απαντά το έγγραφο (αμφίσημη κλάση · μονάδα ή κτήριο), και η εφαρμογή περνά από τον **ΙΔΙΟ** δρόμο με το χέρι.
 *
 * 🔑 **Ένα ΠΕΑ αντικαθιστά ΟΛΟΚΛΗΡΟ το μπλοκ**: ό,τι δεν διάβασε γίνεται `null`, όχι «κράτα το παλιό». Μια ανάμειξη
 * δύο πιστοποιητικών (νέα κλάση, παλιός πίνακας τελικής ενέργειας) θα ήταν εκτίμηση κόστους που δεν γράφει κανένα.
 *
 * ⚠️ **Σημαίες, ποτέ σιωπή**: ό,τι μπορεί να σημαίνει «λάθος έγγραφο για αυτό το ακίνητο» (άλλο εμβαδόν · ληγμένο ·
 * παλαιότερο από το τρέχον) **λέγεται** στον άνθρωπο. Δεν μπλοκάρει: ο νόμος επιτρέπει ΠΕΑ κτηρίου, και μόνο ο άνθρωπος
 * ξέρει αν το παλιό ΠΕΑ ανέβηκε επίτηδες.
 */

import type { EnergyClass } from '@/constants/energy-classes';

import {
  energyCertificatePatchSchema,
  isCo2Emissions,
  isPrimaryEnergy,
  type EnergyCertificate,
  type EnergyCertificatePatch,
  type EnergyCertificateScope,
} from './energy-certificate';
import { isUsefulArea } from './certificate-final-energy';
import { energyClassOfRatio, type EnergyClassFromRatio } from './energy-class-ratio';
import type { PeaField, PeaReading } from './pea-text';

/** Ωφέλιμη ΠΕΑ πάνω από 1,5 × το εμβαδόν του ακινήτου ⇒ πιθανότατα πιστοποιεί όλο το κτήριο. */
const BUILDING_AREA_RATIO = 1.5;
/** Απόκλιση πάνω από 25% (χωρίς να φτάνει στο κτήριο) ⇒ ίσως ΠΕΑ άλλης μονάδας. Το ωφέλιμο ≠ το εμβαδό αγγελίας. */
const AREA_MISMATCH_RATIO = 0.25;

export const PEA_FLAGS = [
  'class-ambiguous',
  'class-unreadable',
  'building-suspected',
  'area-mismatch',
  'expired',
  'older-than-current',
  'incomplete',
] as const;
export type PeaFlag = (typeof PEA_FLAGS)[number];

/** Ό,τι γράφει το ΠΕΑ για το μπλοκ, **εκτός** από κλάση και εμβέλεια — εκείνες τις κλείνει ο άνθρωπος. */
export type PeaFigures = Pick<
  EnergyCertificate,
  'primaryEnergy' | 'co2Emissions' | 'issuedOn' | 'usefulArea' | 'finalEnergy'
>;

export interface PeaProposal {
  readonly fileId: string;
  readonly reading: PeaReading;
  readonly classResult: EnergyClassFromRatio;
  readonly figures: PeaFigures;
  /** Πρόταση εμβέλειας — `null` όταν τα στοιχεία δεν αρκούν· τότε διαλέγει ο άνθρωπος χωρίς προεπιλογή. */
  readonly suggestedScope: EnergyCertificateScope | null;
  readonly flags: readonly PeaFlag[];
  /** Τα πεδία που δεν διαβάστηκαν — αν υπάρχουν, η σημαία `incomplete` τα ονομάζει. */
  readonly unread: readonly PeaField[];
}

export interface PeaProposalContext {
  readonly fileId: string;
  readonly current: EnergyCertificate;
  /** Το εμβαδόν του ακινήτου όπως το ξέρει η εφαρμογή, m² — `null` αν δεν είναι γνωστό. */
  readonly propertyArea: number | null;
  /** `YYYY-MM-DD` — από τον καλούντα, για να ελέγχεται η λήξη σε test. */
  readonly today: string;
}

function figuresOf(reading: PeaReading): PeaFigures {
  return {
    primaryEnergy: isPrimaryEnergy(reading.primaryEnergy) ? reading.primaryEnergy : null,
    co2Emissions: isCo2Emissions(reading.co2Emissions) ? reading.co2Emissions : null,
    issuedOn: reading.issuedOn,
    usefulArea: isUsefulArea(reading.usefulArea) ? reading.usefulArea : null,
    finalEnergy: reading.finalEnergy,
  };
}

function classResultOf(reading: PeaReading): EnergyClassFromRatio {
  const { primaryEnergy, referenceEnergy } = reading;
  return primaryEnergy === null || referenceEnergy === null
    ? { kind: 'invalid' }
    : energyClassOfRatio(primaryEnergy, referenceEnergy);
}

/** Η εμβέλεια **μόνο** από μέτρηση εμβαδού· ο τίτλος της μονάδας δείχνεται στον άνθρωπο, δεν κρίνει. */
function suggestedScopeOf(usefulArea: number | null, propertyArea: number | null): EnergyCertificateScope | null {
  if (usefulArea === null || propertyArea === null || propertyArea <= 0) return null;
  const ratio = usefulArea / propertyArea;
  if (ratio > BUILDING_AREA_RATIO) return 'building';
  return Math.abs(ratio - 1) <= AREA_MISMATCH_RATIO ? 'unit' : null;
}

function flagsOf(proposal: Omit<PeaProposal, 'flags'>, context: PeaProposalContext): PeaFlag[] {
  const { classResult, figures, suggestedScope, unread, reading } = proposal;
  const flags: PeaFlag[] = [];
  if (classResult.kind === 'ambiguous') flags.push('class-ambiguous');
  if (classResult.kind === 'invalid') flags.push('class-unreadable');
  if (suggestedScope === 'building') flags.push('building-suspected');
  if (suggestedScope === null && figures.usefulArea !== null && context.propertyArea !== null) flags.push('area-mismatch');
  if (reading.validUntil !== null && reading.validUntil < context.today) flags.push('expired');
  const currentIssued = context.current.issuedOn;
  if (currentIssued !== null && figures.issuedOn !== null && figures.issuedOn < currentIssued) flags.push('older-than-current');
  if (unread.length > 0) flags.push('incomplete');
  return flags;
}

/** Ένα διαβασμένο ΠΕΑ → η πρόταση για το μπλοκ, με ό,τι χρειάζεται ο άνθρωπος για να αποφασίσει. */
export function peaProposalOf(reading: PeaReading, context: PeaProposalContext): PeaProposal {
  const figures = figuresOf(reading);
  const base = {
    fileId: context.fileId,
    reading,
    classResult: classResultOf(reading),
    figures,
    suggestedScope: suggestedScopeOf(figures.usefulArea, context.propertyArea),
    unread: reading.unread,
  };
  return { ...base, flags: flagsOf(base, context) };
}

/** Η κλάση που προτείνεται χωρίς ερώτηση — μόνο όταν ο λόγος Τ δεν αφήνει αμφιβολία. */
export function settledClassOf(proposal: PeaProposal): EnergyClass | null {
  return proposal.classResult.kind === 'exact' ? proposal.classResult.class : null;
}

/**
 * **Η διόρθωση που εφαρμόζεται** — αφού ο άνθρωπος κλείσει κλάση και εμβέλεια. Ολόκληρο μπλοκ (ένα ΠΕΑ αντικαθιστά
 * το προηγούμενο), με την προέλευση. Περνά από το ίδιο σχήμα με κάθε άλλη διόρθωση· άκυρη ⇒ `null`, ποτέ μισή.
 */
export function peaPatchOf(
  proposal: PeaProposal,
  chosen: { readonly class: EnergyClass; readonly scope: EnergyCertificateScope },
): EnergyCertificatePatch | null {
  const patch = {
    ...proposal.figures,
    class: chosen.class,
    scope: chosen.scope,
    sourceFileId: proposal.fileId,
    absence: null,
  };
  const parsed = energyCertificatePatchSchema.safeParse(patch);
  return parsed.success ? parsed.data : null;
}
