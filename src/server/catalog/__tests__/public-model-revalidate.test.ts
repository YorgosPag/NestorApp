/**
 * Η ακύρωση μνήμης της βιτρίνας (ADR-923 §5.13 Δ4, σχέδιο §4.5). Το jest δεν αποδεικνύει καθαρισμό ISR: εδώ κλειδώνονται
 * τα tags και το ότι μια βλάβη της μνήμης δεν ρίχνει ποτέ την πράξη που ήδη γράφτηκε.
 */

import { revalidatePublicCompany, revalidatePublicModel } from '../public/public-model-revalidate.server';

const revalidateTag = jest.fn();
jest.mock('next/cache', () => ({ revalidateTag: (tag: string) => revalidateTag(tag) }));

beforeEach(() => {
  revalidateTag.mockReset();
});

describe('revalidatePublicCompany', () => {
  it('χτυπά μόνο το tag του χώρου', () => {
    revalidatePublicCompany('comp-a');
    expect(revalidateTag.mock.calls).toEqual([['public-catalog:company:comp-a']]);
  });

  it('βλάβη της μνήμης δεν ρίχνει την πράξη', () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('no store');
    });
    expect(() => revalidatePublicCompany('comp-a')).not.toThrow();
  });
});

describe('revalidatePublicModel', () => {
  it('χτυπά το μοντέλο και τον χώρο', () => {
    revalidatePublicModel('comp-a', 'model-1');
    expect(revalidateTag.mock.calls).toEqual([['public-catalog:model:model-1'], ['public-catalog:company:comp-a']]);
  });

  it('βλάβη της μνήμης δεν ρίχνει την πράξη', () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('no store');
    });
    expect(() => revalidatePublicModel('comp-a', 'model-1')).not.toThrow();
  });
});
