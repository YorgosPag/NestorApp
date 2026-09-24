/**
 * @fileoverview 🖼️ **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΗΣ ΕΙΚΟΝΑΣ ΗΡΩΑ** — νέα έκδοση · έκδοση εστίασης · δημοσίευση
 *   (ADR-881 §4.2 · §5.1).
 * @related ADR-881 · landing-hero-store · services/listings/public-shelf.service ·
 *   services/mandate/showcase-mark-publication (το πρότυπο του φρουρού κατοχής)
 * @module services/landing-hero/landing-hero-publication
 *
 * 🔑 **Ο ΕΝΑΣ ιδιοκτήτης του κύκλου ζωής** (N.7.2 #7): οι routes είναι λεπτές — επικύρωση σύρματος
 *    και κλήση εδώ. Ράφι, έγγραφα, ακύρωση μνήμης και audit ζουν σε αυτό το αρχείο.
 *
 * 🔴 **ΤΟ ΜΟΝΟΠΑΤΙ ΤΟ ΣΤΕΛΝΕΙ Ο ΠΕΛΑΤΗΣ** — ίδιο πρόβλημα με το σήμα βιτρίνας: χωρίς φρουρό, ένα
 *    μονοπάτι **άλλης** εταιρείας θα δημοσιευόταν σε ανώνυμο κοινό. {@link heroSourceFor} απαντά
 *    «ανήκει στον οργανισμό του αιτούντος;» **πριν** αγγίξει byte. Ο αιτών είναι `super_admin`, αλλά
 *    ο φρουρός δεν εξαιρεί κανέναν: η εμπιστοσύνη στον ρόλο δεν είναι λόγος να γίνει η πλατφόρμα
 *    μηχανή εξαγωγής ιδιωτικών αρχείων με ένα λάθος κλικ.
 *
 * ⚠️ **SERVER-ONLY**: το ράφι σέρνει `sharp` + Admin SDK.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { revalidateTag } from 'next/cache';

import type { AuthContext } from '@/lib/auth';
import { logSystemOperation } from '@/lib/auth/audit-convenience';
import type { LandingHeroFocalOrigin, LandingHeroRevision } from '@/lib/landing/landing-hero-document';
import { checkHeroDimensions, hasBlockingIssue } from '@/lib/landing/hero-upload-check';
import {
  LANDING_HERO_DEFAULT_FOCAL_POINT,
  type LandingHeroAsset,
  type LandingHeroMaterial,
  type LandingHeroPage,
  type LandingHeroVariant,
} from '@/lib/landing/landing-hero-vocabulary';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { generateLandingHeroRevisionId } from '@/services/enterprise-id.service';
import { reconcilePublicShelf, type PublicShelfImage } from '@/services/listings/public-shelf.service';
import { LANDING_HERO_SHELF } from '@/services/upload/utils/public-shelf-landing-hero-kind';
import { parseStoragePath } from '@/services/upload/utils/storage-path';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

import { LANDING_HEROES_CACHE_TAG } from './landing-hero-cache-tag';
import {
  createLandingHeroRevisionDoc,
  movePublishedPointer,
  readLandingHeroRevisionDoc,
  type LandingHeroRevisionDraft,
} from './landing-hero-store';

const logger = createModuleLogger('landing-hero-publication');

/** Το audit ονομάζει τη ρύθμιση — ίδιο κλειδί για κάθε πράξη του ήρωα. */
const AUDIT_CONFIG_ID = 'landing_heroes';

export interface CreateLandingHeroRevisionInput {
  readonly page: LandingHeroPage;
  readonly dayPath: string;
  readonly duskPath: string | null;
  /** Ό,τι **δήλωσε** ο άνθρωπος· `null` ⇒ αφήνει το αυτόματο. */
  readonly focalPoint: PhotoFocalPoint | null;
}

export type LandingHeroRejection = 'foreign-source' | 'shelf-failed' | 'unreadable-image' | 'dimensions-rejected';

export type LandingHeroRevisionResult =
  | { readonly outcome: 'created'; readonly revision: LandingHeroRevision }
  | { readonly outcome: 'rejected'; readonly reason: LandingHeroRejection };

// ---------------------------------------------------------------------------
// Φρουρός + μετάφραση
// ---------------------------------------------------------------------------

/** «Ανήκει αυτό το μονοπάτι στον οργανισμό του αιτούντος;» — `null` ⇒ όχι. */
export function heroSourceFor(
  companyId: string,
  privateStoragePath: string,
  variant: LandingHeroVariant,
): PublicShelfSource<LandingHeroMaterial> | null {
  const parsed = parseStoragePath(privateStoragePath);
  if (parsed === null || parsed.companyId !== companyId) return null;
  return { privateStoragePath, material: { variant } };
}

function toAsset(image: PublicShelfImage<LandingHeroMaterial>): LandingHeroAsset {
  return {
    src: image.canonical.url,
    width: image.canonical.width,
    height: image.canonical.height,
    sources: image.variants.map((variant) => ({ url: variant.url, width: variant.width })),
  };
}

/**
 * Ο άνθρωπος υπερισχύει· αλλιώς ο **κανόνας της σύνθεσης** (`LANDING_HERO_DEFAULT_FOCAL_POINT`), **όχι** το
 * κέντρο και **όχι** ανιχνευτής (ADR-881 §8.6). Το `detected` μένει στο λεξιλόγιο μόνο για ιστορικές εκδόσεις.
 */
function focalFrom(declared: PhotoFocalPoint | null): {
  readonly focalPoint: PhotoFocalPoint;
  readonly focalOrigin: LandingHeroFocalOrigin;
} {
  return declared === null
    ? { focalPoint: LANDING_HERO_DEFAULT_FOCAL_POINT, focalOrigin: 'default' }
    : { focalPoint: declared, focalOrigin: 'declared' };
}

// ---------------------------------------------------------------------------
// Νέα έκδοση από αρχεία
// ---------------------------------------------------------------------------

type ShelfOutcome =
  | { readonly ok: true; readonly day: PublicShelfImage<LandingHeroMaterial>; readonly dusk: PublicShelfImage<LandingHeroMaterial> | null }
  | { readonly ok: false; readonly reason: LandingHeroRejection };

/** Ράφι → οι δύο εκδοχές, ταιριασμένες με το **υλικό** τους (ποτέ με τη θέση — Α17.4). */
async function publishToShelf(
  revisionId: string,
  sources: readonly PublicShelfSource<LandingHeroMaterial>[],
  wantsDusk: boolean,
): Promise<ShelfOutcome> {
  const report = await reconcilePublicShelf(LANDING_HERO_SHELF, revisionId, sources);
  if (report.outcome === 'failed') return { ok: false, reason: 'shelf-failed' };
  const day = report.published.find((image) => image.material.variant === 'day');
  const dusk = report.published.find((image) => image.material.variant === 'dusk') ?? null;
  if (day === undefined || (wantsDusk && dusk === null)) return { ok: false, reason: 'unreadable-image' };
  const rejected = [day, dusk].some((image) => image !== null && hasBlockingIssue(checkHeroDimensions(image.canonical)));
  return rejected ? { ok: false, reason: 'dimensions-rejected' } : { ok: true, day, dusk };
}

/**
 * **Νέα έκδοση** — φρουρός → ράφι → έγγραφο → audit. Δεν δημοσιεύει: η έκδοση γεννιέται **πρόχειρο**.
 * ⚠️ Αν το έγγραφο αποτύχει μετά το ράφι, τα bytes μένουν σε πρόθεμα που κανείς δεν δείχνει — αθώο
 *    (αόρατο, content-addressed) και μικρό· ποτέ το αντίστροφο (έγγραφο που δείχνει σε ανύπαρκτα bytes).
 */
export async function createLandingHeroRevision(
  db: Firestore,
  ctx: AuthContext,
  input: CreateLandingHeroRevisionInput,
): Promise<LandingHeroRevisionResult> {
  const day = heroSourceFor(ctx.companyId, input.dayPath, 'day');
  const dusk = input.duskPath === null ? null : heroSourceFor(ctx.companyId, input.duskPath, 'dusk');
  if (day === null || (input.duskPath !== null && dusk === null)) return { outcome: 'rejected', reason: 'foreign-source' };

  const id = generateLandingHeroRevisionId();
  const shelf = await publishToShelf(id, dusk === null ? [day] : [day, dusk], dusk !== null);
  if (!shelf.ok) return { outcome: 'rejected', reason: shelf.reason };

  const draft: LandingHeroRevisionDraft = {
    page: input.page,
    day: toAsset(shelf.day),
    dusk: shelf.dusk === null ? null : toAsset(shelf.dusk),
    ...focalFrom(input.focalPoint),
    sources: { day: input.dayPath, dusk: input.duskPath },
    derivedFrom: null,
    createdBy: ctx.uid,
  };
  return commitRevision(db, ctx, id, draft);
}

// ---------------------------------------------------------------------------
// Νέα έκδοση ΜΟΝΟ με άλλη εστίαση
// ---------------------------------------------------------------------------

/**
 * **Ίδιες εικόνες, άλλο σημείο** — νέα έκδοση που **ξαναχρησιμοποιεί** τα δημόσια παράγωγα της
 * βάσης (κανένα re-encode). Η αμεταβλητότητα μένει ακέραιη: η βάση δεν αγγίζεται.
 */
export async function deriveLandingHeroRevision(
  db: Firestore,
  ctx: AuthContext,
  baseRevisionId: string,
  focalPoint: PhotoFocalPoint,
): Promise<LandingHeroRevisionResult | 'not-found'> {
  const base = await readLandingHeroRevisionDoc(db, baseRevisionId);
  if (base === null) return 'not-found';
  const { id: _id, createdAt: _createdAt, ...rest } = base;
  const draft: LandingHeroRevisionDraft = {
    ...rest,
    focalPoint,
    focalOrigin: 'declared',
    derivedFrom: base.id,
    createdBy: ctx.uid,
  };
  return commitRevision(db, ctx, generateLandingHeroRevisionId(), draft);
}

async function commitRevision(
  db: Firestore,
  ctx: AuthContext,
  id: string,
  draft: LandingHeroRevisionDraft,
): Promise<LandingHeroRevisionResult> {
  await createLandingHeroRevisionDoc(db, id, draft);
  await audit(ctx, 'revision-created', { page: draft.page, revisionId: id, derivedFrom: draft.derivedFrom });
  const revision = await readLandingHeroRevisionDoc(db, id);
  // Μόλις γράφτηκε από εμάς· `null` εδώ σημαίνει ότι γράψαμε κάτι που ο δικός μας αναγνώστης αρνείται.
  if (revision === null) throw new Error(`Revision ${id} was written but cannot be read`);
  return { outcome: 'created', revision };
}

// ---------------------------------------------------------------------------
// Δημοσίευση / επαναφορά
// ---------------------------------------------------------------------------

export type PublishLandingHeroResult =
  | { readonly outcome: 'published'; readonly previous: string | null }
  | { readonly outcome: 'invalid-target' };

/**
 * **Κάνε αυτή την έκδοση ζωντανή** για τη σελίδα — ή `null` για επιστροφή στην ενσωματωμένη.
 * Δείκτης (transaction) → ακύρωση μνήμης → audit. Επαναφορά = δημοσίευση παλιότερης έκδοσης.
 */
export async function publishLandingHero(
  db: Firestore,
  ctx: AuthContext,
  page: LandingHeroPage,
  revisionId: string | null,
): Promise<PublishLandingHeroResult> {
  const moved = await movePublishedPointer(db, page, revisionId, ctx.uid);
  if (moved === 'invalid-target') return { outcome: 'invalid-target' };
  revalidateTag(LANDING_HEROES_CACHE_TAG);
  await audit(ctx, 'published', { page, revisionId, previous: moved.previous });
  return { outcome: 'published', previous: moved.previous };
}

/** Audit **πλατφόρμας** (`system_audit_logs`) — ποτέ δεν ρίχνει την πράξη που κατέγραψε. */
async function audit(ctx: AuthContext, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await logSystemOperation(ctx, AUDIT_CONFIG_ID, { action, ...details }, `landing hero ${action}`);
  } catch (error) {
    logger.warn('Audit ήρωα απέτυχε', { action, error: getErrorMessage(error) });
  }
}
