/**
 * ADR-923 §5.15 — ο κριτής των δημοσιευμένων εκδόσεων. Λάθος εδώ = έντυπο ομάδας Χ σε αγοραστή της ομάδας Ψ, ή έκδοση με τιμές
 * στη βιτρίνα (Θ4). Κάθε γραμμή του πίνακα της κεφαλίδας έχει άγκυρα.
 */
import { catalogEditionAudienceSchema } from '../../schema/zod/catalog-edition.schema';
import type { CatalogEditionDefinition } from '../../types/catalog-edition';
import type { PricingViewer } from '../../types/price-list';
import { EMPTY_PUBLICATION_RETENTION, type PublicationArtifact } from '../../types/publication';
import {
  catalogEditionViewOf,
  editionAudienceKey,
  editionVisibleTo,
  latestVisibleEdition,
  PUBLICATION_DISPOSAL_MARGIN_MS,
  publishabilityOf,
  restoredOnWithdrawal,
  supersededBy,
} from '../catalog-edition-policy';

const artifact = (profile: PublicationArtifact['profile']): PublicationArtifact => ({
  profile,
  storagePath: `catalog-publications/c/r/${profile}.pdf`,
  sizeBytes: 10,
  pageCount: 3,
  sha256: 'ab',
  renderMs: 1,
});

const run = (patch: Partial<Parameters<typeof publishabilityOf>[0]> = {}) => ({
  status: 'ready' as const,
  priced: false,
  retention: EMPTY_PUBLICATION_RETENTION,
  artifacts: [artifact('print'), artifact('screen')],
  dispositionDueAt: null,
  ...patch,
});

const NOW = '2026-11-07T12:00:00.000Z';

const GROUP_A = { kind: 'customerGroup', customerGroupId: 'cgrp_a' } as const;
const GROUP_B = { kind: 'customerGroup', customerGroupId: 'cgrp_b' } as const;
const ANONYMOUS = { kind: 'anonymous' } as const;

const edition = (patch: Partial<CatalogEditionDefinition> = {}): CatalogEditionDefinition => ({
  shelfKey: 'cpubr_1',
  title: { el: 'Κατάλογος', en: 'Catalog' },
  language: 'el',
  audience: ANONYMOUS,
  source: { kind: 'publication', runId: 'cpubx_1', profile: 'screen' },
  file: { storagePath: 'p', sizeBytes: 10, pageCount: 3, sha256: 'ab' },
  status: 'published',
  publishedAt: '2026-11-07T10:00:00.000Z',
  publishedBy: 'u',
  endedAt: null,
  endedBy: null,
  supersededBy: null,
  ...patch,
});

const anonymous: PricingViewer = { kind: 'anonymous' };
const buyerOf = (customerGroupId: string | null): PricingViewer => ({ kind: 'signedIn', customerGroupId, parties: [] });

describe('publishabilityOf: τι δημοσιεύεται', () => {
  it('έτοιμη, χωρίς τιμές ⇒ το PDF οθόνης, ποτέ το εκτύπωσης', () => {
    const verdict = publishabilityOf(run(), NOW);
    expect(verdict.ok && verdict.artifact.profile).toBe('screen');
  });

  it('αρνήσεις, η καθεμία με τη δική της αιτία', () => {
    expect(publishabilityOf(run({ status: 'running' }), NOW)).toEqual({ ok: false, refusal: 'notReady' });
    const disposal = { disposedAt: 'x', disposedBy: 'u', cause: 'manual', ruleId: 'r' } as const;
    expect(publishabilityOf(run({ retention: { ...EMPTY_PUBLICATION_RETENTION, disposal } }), NOW)).toEqual({ ok: false, refusal: 'disposed' });
    expect(publishabilityOf(run({ artifacts: [artifact('print')] }), NOW)).toEqual({ ok: false, refusal: 'noScreenFile' });
  });

  it('🔒 αγώνας με τη σάρωση: προθεσμία μέσα στο περιθώριο ⇒ άρνηση· πιο μακριά ή καμία ⇒ δημοσιεύεται', () => {
    const at = (offsetMs: number) => new Date(Date.parse(NOW) + offsetMs).toISOString();
    expect(publishabilityOf(run({ dispositionDueAt: at(-1) }), NOW)).toEqual({ ok: false, refusal: 'disposalDue' });
    expect(publishabilityOf(run({ dispositionDueAt: at(PUBLICATION_DISPOSAL_MARGIN_MS) }), NOW)).toEqual({ ok: false, refusal: 'disposalDue' });
    expect(publishabilityOf(run({ dispositionDueAt: at(PUBLICATION_DISPOSAL_MARGIN_MS + 1) }), NOW).ok).toBe(true);
    expect(publishabilityOf(run({ dispositionDueAt: null }), NOW).ok).toBe(true);
  });

  it('Θ4: έκδοση με τιμές δεν δημοσιεύεται ποτέ', () => {
    expect(publishabilityOf(run({ priced: true }), NOW)).toEqual({ ok: false, refusal: 'priced' });
  });
});

describe('supersededBy: τι αντικαθιστά μια νέα δημοσίευση', () => {
  const shelf = [
    { id: 'e1', ...edition() },
    { id: 'e2', ...edition({ audience: GROUP_A }) },
    { id: 'e3', ...edition({ shelfKey: 'cpubr_2' }) },
    { id: 'e4', ...edition({ status: 'superseded' }) },
  ];

  it('μόνο ισχύουσα, ίδιο ράφι, ίδιο κοινό', () => {
    expect(supersededBy(shelf, { shelfKey: 'cpubr_1', audience: ANONYMOUS }).map((e) => e.id)).toEqual(['e1']);
    expect(supersededBy(shelf, { shelfKey: 'cpubr_1', audience: GROUP_A }).map((e) => e.id)).toEqual(['e2']);
    expect(supersededBy(shelf, { shelfKey: 'cpubr_1', audience: GROUP_B })).toEqual([]);
  });

  it('το κλειδί κοινού είναι το ίδιο με των τιμών', () => {
    expect(editionAudienceKey(GROUP_A)).toBe('customerGroup:cgrp_a');
    expect(editionAudienceKey(ANONYMOUS)).toBe('anonymous');
  });
});

describe('restoredOnWithdrawal: ποια ξαναγίνεται ισχύουσα', () => {
  const at = (iso: string, patch: Partial<CatalogEditionDefinition>) => ({ ...edition(patch), publishedAt: iso });
  const withdrawnCurrent = { id: 'new', ...edition({ status: 'published' }) };

  it('ο νεότερος προκάτοχος που αντικατέστησε, ίδιο ράφι και κοινό', () => {
    const older = { id: 'o1', ...at('2026-01-01T00:00:00.000Z', { status: 'superseded', supersededBy: 'new' }) };
    const newer = { id: 'o2', ...at('2026-06-01T00:00:00.000Z', { status: 'superseded', supersededBy: 'new' }) };
    expect(restoredOnWithdrawal([older, newer], withdrawnCurrent)?.id).toBe('o2');
  });

  it('κανένας: άλλος διάδοχος, άλλο κοινό, ή η αποσυρμένη ήταν ήδη παλαιότερη', () => {
    const otherSuccessor = { id: 'o1', ...edition({ status: 'superseded', supersededBy: 'else' }) };
    const otherAudience = { id: 'o2', ...edition({ status: 'superseded', supersededBy: 'new', audience: GROUP_A }) };
    expect(restoredOnWithdrawal([otherSuccessor, otherAudience], withdrawnCurrent)).toBeNull();
    const wasSuperseded = { id: 'new', ...edition({ status: 'superseded' }) };
    expect(restoredOnWithdrawal([{ id: 'o3', ...edition({ status: 'superseded', supersededBy: 'new' }) }], wasSuperseded)).toBeNull();
  });
});

describe('latestVisibleEdition: το ισχύον του ραφιού για τον θεατή', () => {
  const anonymousNew = { id: 'a', ...edition({ publishedAt: '2026-06-01T00:00:00.000Z' }) };
  const groupOld = { id: 'g', ...edition({ audience: GROUP_A, publishedAt: '2026-01-01T00:00:00.000Z' }) };
  const shelf = [anonymousNew, groupOld];

  it('το πιο ειδικό κοινό κερδίζει τη νεότητα· ο ανώνυμος παίρνει το δικό του', () => {
    expect(latestVisibleEdition(shelf, buyerOf('cgrp_a'))?.id).toBe('g');
    expect(latestVisibleEdition(shelf, anonymous)?.id).toBe('a');
    expect(latestVisibleEdition(shelf, buyerOf('cgrp_b'))?.id).toBe('a');
  });

  it('μόνο ισχύουσες: παλαιότερη ή αποσυρμένη δεν είναι ποτέ «το ισχύον»', () => {
    expect(latestVisibleEdition([{ id: 's', ...edition({ status: 'superseded' }) }], anonymous)).toBeNull();
  });
});

describe('editionVisibleTo: ποιος βλέπει', () => {
  it('ανώνυμη: όλοι', () => {
    expect(editionVisibleTo(edition(), anonymous)).toBe(true);
    expect(editionVisibleTo(edition(), buyerOf(null))).toBe(true);
  });

  it('ομάδας Α: μόνο αγοραστής της Α, ποτέ ανώνυμος, ποτέ αγοραστής χωρίς ομάδα ή της Β', () => {
    const groupEdition = edition({ audience: GROUP_A });
    expect(editionVisibleTo(groupEdition, buyerOf('cgrp_a'))).toBe(true);
    expect(editionVisibleTo(groupEdition, buyerOf('cgrp_b'))).toBe(false);
    expect(editionVisibleTo(groupEdition, buyerOf(null))).toBe(false);
    expect(editionVisibleTo(groupEdition, anonymous)).toBe(false);
  });

  it('αποσυρμένη: κανείς', () => {
    expect(editionVisibleTo(edition({ status: 'withdrawn' }), anonymous)).toBe(false);
    expect(editionVisibleTo(edition({ status: 'withdrawn', audience: GROUP_A }), buyerOf('cgrp_a'))).toBe(false);
  });
});

describe('catalogEditionViewOf: τι μαθαίνει ο θεατής', () => {
  it('κλειστό σχήμα: καμία διαδρομή αρχείου, κανένα κοινό, κανένα πρόσωπο', () => {
    const view = catalogEditionViewOf('e1', edition(), new Set());
    expect(view && Object.keys(view).sort()).toEqual(
      ['id', 'language', 'pageCount', 'publishedAt', 'sizeBytes', 'status', 'supersededBy', 'title'],
    );
  });

  it('το «αντικαταστάθηκε από» σιωπά όταν ο διάδοχος δεν φαίνεται στον θεατή', () => {
    const old = edition({ status: 'superseded', supersededBy: 'e9' });
    expect(catalogEditionViewOf('e1', old, new Set())?.supersededBy).toBeNull();
    expect(catalogEditionViewOf('e1', old, new Set(['e9']))?.supersededBy).toBe('e9');
  });

  it('αποσυρμένη ⇒ ανύπαρκτη', () => {
    expect(catalogEditionViewOf('e1', edition({ status: 'withdrawn' }), new Set())).toBeNull();
  });
});

describe('catalogEditionAudienceSchema: ένα σχήμα κοινού, στενεμένο', () => {
  it('δέχεται ανώνυμο και ομάδα, αρνείται signedIn και partner', () => {
    expect(catalogEditionAudienceSchema.safeParse(ANONYMOUS).success).toBe(true);
    expect(catalogEditionAudienceSchema.safeParse(GROUP_A).success).toBe(true);
    expect(catalogEditionAudienceSchema.safeParse({ kind: 'signedIn' }).success).toBe(false);
    const partner = { kind: 'partner', party: { kind: 'workspace', companyId: 'comp_1' } };
    expect(catalogEditionAudienceSchema.safeParse(partner).success).toBe(false);
  });
});
