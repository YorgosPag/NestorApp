/**
 * Άγκυρες μοντέλου — η διεύθυνση επαφής **κουβαλά** ταυτότητα και θέση (ADR-332 D27 Β-ΙΙ Φ1)
 *
 * Κάθε μεταφορά ανάμεσα σε σχήματα (φόρμα ⇄ αυθεντική λίστα ⇄ παράγωγο `addresses[]`) που
 * ξεχνά `id` ή θέση **σβήνει σιωπηλά** την πινέζα του ανθρώπου στο επόμενο save. Εδώ τρέχουν
 * οι **πραγματικοί** κατασκευαστές (saver, builder, reader, mapper δημιουργίας).
 */

import type { Contact } from '@/types/contacts';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { EnterpriseContactSaver } from '../EnterpriseContactSaver';
import { resolveContactAddresses } from '../contact-addresses-reader';
import { isBlankContactAddress, pruneBlankContactAddresses } from '../contact-address-blankness';
import { mapCompanyFormData } from '@/utils/contactForm/mappers/company';

const HUMAN_POINT = { lat: 40.6617, lng: 22.9204 };

function hq(partial: Partial<CompanyAddress> = {}): CompanyAddress {
  return {
    type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη',
    ...partial,
  };
}

function blankBranch(partial: Partial<CompanyAddress> = {}): CompanyAddress {
  return { type: 'branch', street: '', number: '', postalCode: '', city: '', ...partial };
}

function form(addresses: CompanyAddress[]): ContactFormData {
  return { ...initialFormData, type: 'company', companyName: 'ALFA', companyAddresses: addresses };
}

describe('ADR-332 D27 Β-ΙΙ Φ1 — ταυτότητα στην πρώτη αποθήκευση', () => {
  it('κάθε εγγραφή φεύγει με id· όσες είχαν, το κρατούν (ιδεμποτεντικό)', () => {
    const data = EnterpriseContactSaver.convertToEnterpriseStructure(
      form([hq({ id: 'addr_keep' }), hq({ type: 'branch', street: 'Μοναστηρίου' })]),
    );

    const list = data.customFields?.companyAddresses ?? [];
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('addr_keep');
    expect(list[1].id).toEqual(expect.stringMatching(/^addr_/));
    // Το παράγωγο κουβαλά την ΙΔΙΑ ταυτότητα.
    expect(data.addresses?.map((a) => a.id)).toEqual(list.map((a) => a.id));
  });

  it('η δημιουργία εταιρείας γράφει τη λίστα του saver — κλαδεμένη, με ταυτότητες', () => {
    const mapped = mapCompanyFormData(form([hq(), blankBranch()]));

    const written = mapped.customFields.companyAddresses ?? [];
    expect(written).toHaveLength(1);
    expect(written[0].id).toEqual(expect.stringMatching(/^addr_/));
  });
});

describe('ADR-332 D27 Β-ΙΙ Φ1 — η θέση επιβιώνει κάθε μεταφορά', () => {
  const positioned = hq({
    id: 'addr_hq',
    coordinates: HUMAN_POINT,
    source: 'dragged',
    verifiedAt: 1_757_000_000_000,
  });

  it('αυθεντική λίστα → παράγωγο → ανακατασκευή: ίδια ταυτότητα, ίδια θέση', () => {
    const data = EnterpriseContactSaver.convertToEnterpriseStructure(form([positioned]));
    const derivedOnly = { id: 'cont_x', type: 'company', addresses: data.addresses } as unknown as Contact;

    const [rebuilt] = resolveContactAddresses(derivedOnly, 'company');

    expect(rebuilt.id).toBe('addr_hq');
    expect(rebuilt.coordinates).toEqual(HUMAN_POINT);
    expect(rebuilt.source).toBe('dragged');
    expect(rebuilt.verifiedAt).toBe(1_757_000_000_000);
  });

  it('η λίστα του διακομιστή γίνεται αυθεντική ΚΑΙ παράγωγο από την ίδια πηγή', () => {
    const base = EnterpriseContactSaver.convertToEnterpriseStructure(form([hq({ id: 'addr_hq' })]));
    const resolved = EnterpriseContactSaver.withResolvedAddresses(base, [positioned]);

    expect(resolved.customFields?.companyAddresses?.[0].coordinates).toEqual(HUMAN_POINT);
    expect(resolved.addresses?.[0].coordinates).toEqual(HUMAN_POINT);
    expect(resolved.addresses?.[0].source).toBe('dragged');
  });
});

describe('ADR-332 D27 Β-ΙΙ Φ1 — D20: θέση ΕΙΝΑΙ περιεχόμενο', () => {
  it('εγγραφή μόνο με σημείο (χωρίς κείμενο) δεν είναι κενή', () => {
    expect(isBlankContactAddress(blankBranch({ coordinates: HUMAN_POINT, source: 'dragged' }))).toBe(false);
  });

  it('σημείο NaN δεν είναι θέση — η εγγραφή μένει κενή', () => {
    expect(isBlankContactAddress(blankBranch({ coordinates: { lat: Number.NaN, lng: 22 } }))).toBe(true);
  });

  it('υποκατάστημα «Μόνο η θέση» επιβιώνει το κλάδεμα· κενό χωρίς θέση όχι', () => {
    const kept = pruneBlankContactAddresses([
      hq(),
      blankBranch({ coordinates: HUMAN_POINT, source: 'dragged' }),
      blankBranch(),
    ]);
    expect(kept).toHaveLength(2);
    expect(kept[1].coordinates).toEqual(HUMAN_POINT);
  });
});
