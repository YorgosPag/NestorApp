/**
 * ADR-923 §5.13 Σ7 — ποια μοντέλα παίρνουν τυπωμένο QR: ο ίδιος αναγνώστης με το `/q/<id>`, και η άρνηση της απόφασης 4.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/services/public-catalog/public-catalog.reader', () => ({ readPublicModelTarget: jest.fn() }));

import { publicationLinkReader, type PublicModelProbe } from '../publication-links.server';

const PUBLIC = 'https://nestorconstruct.gr';
const probeOf = (shown: readonly string[]): jest.Mock<ReturnType<PublicModelProbe>, Parameters<PublicModelProbe>> =>
  jest.fn(async (id: string) => (shown.includes(id) ? `/suppliers/aries/p/x-${id}` : null));

describe('publicationLinkReader', () => {
  it('🔒 μόνο ό,τι βλέπει ο ανώνυμος παίρνει QR, πάντα στο `/q/<id>`', async () => {
    const read = publicationLinkReader('final', { probe: probeOf(['cpm_a']), origin: () => PUBLIC });
    const links = await read(['cpm_a', 'cpm_hidden']);
    expect([...links.urls]).toEqual([['cpm_a', `${PUBLIC}/q/cpm_a`]]);
    expect(links.refusedModelIds).toEqual([]);
  });

  it('κανένα δημόσιο μοντέλο ⇒ ούτε QR ούτε άρνηση, ακόμη και χωρίς βάση', async () => {
    const read = publicationLinkReader('final', { probe: probeOf([]), origin: () => 'http://localhost:3000' });
    await expect(read(['cpm_a'])).resolves.toEqual({ urls: new Map(), refusedModelIds: [] });
  });

  it.each(['http://localhost:3000', 'http://nestorconstruct.gr', null])('🔒 απόφαση 4: τελική έκδοση με βάση %s ⇒ άρνηση, κανένα QR', async (origin) => {
    const read = publicationLinkReader('final', { probe: probeOf(['cpm_a', 'cpm_b']), origin: () => origin });
    await expect(read(['cpm_a', 'cpm_b'])).resolves.toEqual({ urls: new Map(), refusedModelIds: ['cpm_a', 'cpm_b'] });
  });

  it('η προεπισκόπηση πάνω σε localhost δείχνει το QR και δεν αρνείται', async () => {
    const read = publicationLinkReader('preview', { probe: probeOf(['cpm_a']), origin: () => 'http://localhost:3000' });
    const links = await read(['cpm_a']);
    expect(links.urls.get('cpm_a')).toBe('http://localhost:3000/q/cpm_a');
    expect(links.refusedModelIds).toEqual([]);
  });

  it('η προεπισκόπηση χωρίς βάση βγαίνει χωρίς QR', async () => {
    const read = publicationLinkReader('preview', { probe: probeOf(['cpm_a']), origin: () => null });
    await expect(read(['cpm_a'])).resolves.toEqual({ urls: new Map(), refusedModelIds: [] });
  });

  it('εκατοντάδες μοντέλα: κάθε ένα ρωτιέται ακριβώς μία φορά, σε παρτίδες', async () => {
    const ids = Array.from({ length: 40 }, (_, index) => `cpm_${index}`);
    const probe = probeOf(ids.filter((_, index) => index % 2 === 0));
    const links = await publicationLinkReader('final', { probe, origin: () => PUBLIC })(ids);
    expect(probe).toHaveBeenCalledTimes(40);
    expect(links.urls.size).toBe(20);
  });

  it('🔑 βλάβη του αναγνώστη ρίχνει: όχι σιωπηλά κατάλογος χωρίς QR', async () => {
    const probe: PublicModelProbe = async () => { throw new Error('firestore down'); };
    await expect(publicationLinkReader('final', { probe, origin: () => PUBLIC })(['cpm_a'])).rejects.toThrow('firestore down');
  });
});
