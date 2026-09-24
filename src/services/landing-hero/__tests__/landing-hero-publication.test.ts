/**
 * ⚓ ADR-881 §4.2 · §5.1 — **ο κύκλος ζωής της εικόνας ήρωα**.
 *
 * Κλειδώνεται: (Α) ξένο μονοπάτι δεν αγγίζει ΠΟΤΕ το ράφι · (Β) η νέα έκδοση ταιριάζει εκδοχές με το
 * ΥΛΙΚΟ, όχι με τη θέση · (Γ) ο άνθρωπος υπερισχύει του αυτόματου · (Δ) η «νέα εστίαση» ΔΕΝ ξανακωδικοποιεί ·
 * (Ε) η δημοσίευση ακυρώνει τη μνήμη των δημόσιων σελίδων — και ΜΟΝΟ όταν πέτυχε.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';

const reconcilePublicShelf = jest.fn();
const createLandingHeroRevisionDoc = jest.fn();
const readLandingHeroRevisionDoc = jest.fn();
const movePublishedPointer = jest.fn();
const revalidateTag = jest.fn();
const logSystemOperation = jest.fn();

jest.mock('@/services/listings/public-shelf.service', () => ({ reconcilePublicShelf: (...a: unknown[]) => reconcilePublicShelf(...a) }));
jest.mock('../landing-hero-store', () => ({
  createLandingHeroRevisionDoc: (...a: unknown[]) => createLandingHeroRevisionDoc(...a),
  readLandingHeroRevisionDoc: (...a: unknown[]) => readLandingHeroRevisionDoc(...a),
  movePublishedPointer: (...a: unknown[]) => movePublishedPointer(...a),
}));
jest.mock('next/cache', () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }));
jest.mock('@/lib/auth/audit-convenience', () => ({ logSystemOperation: (...a: unknown[]) => logSystemOperation(...a) }));
jest.mock('@/services/enterprise-id.service', () => ({ generateLandingHeroRevisionId: () => 'lhrev_new-1' }));

import {
  createLandingHeroRevision,
  deriveLandingHeroRevision,
  heroSourceFor,
  publishLandingHero,
} from '../landing-hero-publication';

const db = {} as Firestore;
const ctx = { uid: 'uid-1', companyId: 'comp_owner' } as AuthContext;
const OWN = (name: string) => `companies/comp_owner/entities/company/comp_owner/domains/admin/categories/photos/files/${name}.jpg`;
const FOREIGN = 'companies/comp_other/entities/company/comp_other/domains/admin/categories/photos/files/x.jpg';

function shelfImage(variant: 'day' | 'dusk', width = 2560, height = 1280, focalPoint: { x: number; y: number } | null = null) {
  const object = { key: `k-${variant}`, url: `https://shelf/${variant}.webp`, width, height };
  return { canonical: object, variants: [object], material: { variant }, focalPoint, declaredFocalPoint: null };
}

beforeEach(() => {
  jest.clearAllMocks();
  readLandingHeroRevisionDoc.mockImplementation(async (_db: unknown, id: string) => ({ id, page: 'stay' }));
});

describe('Α — φρουρός κατοχής', () => {
  it('δέχεται μονοπάτι του οργανισμού του αιτούντος', () => {
    expect(heroSourceFor('comp_owner', OWN('d'), 'day')).toEqual({ privateStoragePath: OWN('d'), material: { variant: 'day' } });
  });

  it('🔴 ξένο μονοπάτι ⇒ απόρριψη ΠΡΙΝ αγγίξει byte το ράφι', async () => {
    const result = await createLandingHeroRevision(db, ctx, { page: 'stay', dayPath: OWN('d'), duskPath: FOREIGN, focalPoint: null });
    expect(result).toEqual({ outcome: 'rejected', reason: 'foreign-source' });
    expect(reconcilePublicShelf).not.toHaveBeenCalled();
  });
});

describe('Β/Γ — νέα έκδοση', () => {
  it('🔴 ταιριάζει εκδοχές με το ΥΛΙΚΟ — ακόμη κι αν το ράφι τις επιστρέψει ανάποδα', async () => {
    reconcilePublicShelf.mockResolvedValue({ outcome: 'reconciled', published: [shelfImage('dusk'), shelfImage('day', 2560, 1280, { x: 0.8, y: 0.4 })] });
    await createLandingHeroRevision(db, ctx, { page: 'stay', dayPath: OWN('d'), duskPath: OWN('n'), focalPoint: null });

    const [, id, draft] = createLandingHeroRevisionDoc.mock.calls[0];
    expect(id).toBe('lhrev_new-1');
    expect(draft.day.src).toBe('https://shelf/day.webp');
    expect(draft.dusk.src).toBe('https://shelf/dusk.webp');
    // 🔴 ADR-881 §8.6 — χωρίς δήλωση ⇒ ο ΚΑΝΟΝΑΣ ΤΗΣ ΣΥΝΘΕΣΗΣ, ΟΧΙ ό,τι βρήκε ανιχνευτής στα bytes
    //    (μετρημένο: για τη βεράντα του /stay έδωσε {0,44 , 0,875} και έκοψε το χωριό).
    expect(draft.focalPoint).toEqual({ x: 1, y: 0.5 });
    expect(draft.focalOrigin).toBe('default');
  });

  it('ο άνθρωπος υπερισχύει του αυτόματου', async () => {
    reconcilePublicShelf.mockResolvedValue({ outcome: 'reconciled', published: [shelfImage('day', 2560, 1280, { x: 0.8, y: 0.4 })] });
    await createLandingHeroRevision(db, ctx, { page: 'stay', dayPath: OWN('d'), duskPath: null, focalPoint: { x: 0.2, y: 0.9 } });
    const [, , draft] = createLandingHeroRevisionDoc.mock.calls[0];
    expect(draft.focalPoint).toEqual({ x: 0.2, y: 0.9 });
    expect(draft.focalOrigin).toBe('declared');
    expect(draft.dusk).toBeNull();
  });

  it('ζητήθηκε σούρουπο αλλά το ράφι το απέρριψε ⇒ καμία έκδοση με μισό ζεύγος', async () => {
    reconcilePublicShelf.mockResolvedValue({ outcome: 'reconciled', published: [shelfImage('day')] });
    const result = await createLandingHeroRevision(db, ctx, { page: 'stay', dayPath: OWN('d'), duskPath: OWN('n'), focalPoint: null });
    expect(result).toEqual({ outcome: 'rejected', reason: 'unreadable-image' });
    expect(createLandingHeroRevisionDoc).not.toHaveBeenCalled();
  });

  it('belt-and-suspenders: ο διακομιστής ξανακρίνει διαστάσεις — τετράγωνη ⇒ απόρριψη', async () => {
    reconcilePublicShelf.mockResolvedValue({ outcome: 'reconciled', published: [shelfImage('day', 2048, 2048)] });
    const result = await createLandingHeroRevision(db, ctx, { page: 'stay', dayPath: OWN('d'), duskPath: null, focalPoint: null });
    expect(result).toEqual({ outcome: 'rejected', reason: 'dimensions-rejected' });
  });
});

describe('Δ — νέα εστίαση', () => {
  it('🔴 ΔΕΝ ξανακωδικοποιεί: κανένα ράφι, ίδια παράγωγα, `derivedFrom` = η βάση', async () => {
    const base = { id: 'lhrev_base', page: 'home', day: { src: 'https://shelf/d.webp' }, dusk: null, focalPoint: { x: 1, y: 0.5 }, focalOrigin: 'detected', sources: { day: OWN('d'), dusk: null }, derivedFrom: null, createdAt: '2026-09-24T00:00:00.000Z', createdBy: 'uid-0' };
    readLandingHeroRevisionDoc.mockResolvedValueOnce(base);
    await deriveLandingHeroRevision(db, ctx, 'lhrev_base', { x: 0.3, y: 0.3 });

    expect(reconcilePublicShelf).not.toHaveBeenCalled();
    const [, , draft] = createLandingHeroRevisionDoc.mock.calls[0];
    expect(draft).toMatchObject({ day: base.day, focalPoint: { x: 0.3, y: 0.3 }, focalOrigin: 'declared', derivedFrom: 'lhrev_base', createdBy: 'uid-1' });
    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('createdAt');
  });
});

describe('Ε — δημοσίευση', () => {
  it('μετακινεί δείκτη → ακυρώνει τη μνήμη → audit', async () => {
    movePublishedPointer.mockResolvedValue({ previous: 'lhrev_old' });
    await expect(publishLandingHero(db, ctx, 'home', 'lhrev_new-1')).resolves.toEqual({ outcome: 'published', previous: 'lhrev_old' });
    expect(revalidateTag).toHaveBeenCalledWith('landing-heroes');
    expect(logSystemOperation).toHaveBeenCalled();
  });

  it('🔴 άκυρος στόχος ⇒ η μνήμη ΔΕΝ ακυρώνεται (οι σελίδες δεν ξαναδιαβάζουν για το τίποτα)', async () => {
    movePublishedPointer.mockResolvedValue('invalid-target');
    await expect(publishLandingHero(db, ctx, 'home', 'lhrev_x')).resolves.toEqual({ outcome: 'invalid-target' });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('αποτυχία audit δεν ρίχνει την πράξη', async () => {
    movePublishedPointer.mockResolvedValue({ previous: null });
    logSystemOperation.mockRejectedValueOnce(new Error('audit down'));
    await expect(publishLandingHero(db, ctx, 'home', null)).resolves.toEqual({ outcome: 'published', previous: null });
  });
});
