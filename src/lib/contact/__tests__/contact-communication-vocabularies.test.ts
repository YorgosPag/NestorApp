/**
 * ΑΓΚΥΡΑ — **ΕΝΑ λεξιλόγιο ανά είδος επικοινωνίας** (email · ιστοσελίδα · social), υποσύνολα ανά κάτοχο, και κάθε
 * γραφέας μένει μέσα στο υποσύνολο του κατόχου (ADR-327 §8.5.4, 2026-10-29 — ίδια κλάση με το ☎️).
 *
 * Μετρημένο: το AI έγραφε email `work` σε εταιρεία, το `resolve` έγραφε `general`/`info` σε πρόσωπο, ο
 * `EnterpriseContactSaver` ιστοσελίδα `company` σε εταιρεία ΚΑΙ υπηρεσία — τρεις διαδρομές προς την ίδια κενή λίστα
 * «Τύπος». Οι ισχυρισμοί είναι **παραμετρικοί ανά λεξιλόγιο**: ένα τέταρτο λεξιλόγιο μπαίνει με μία γραμμή στον πίνακα.
 */

/* global describe, it, expect */

import type { ContactOwnerKind } from '../contact-owner-kind';
import { contactOwnerKindOf } from '../contact-owner-kind';
import {
  DEFAULT_EMAIL_TYPE, EMAIL_TYPES, EMAIL_TYPES_BY_OWNER, inferEmailType, isEmailType, isEmailTypeOfferedFor,
} from '../email-type-vocabulary';
import { DEFAULT_WEBSITE_TYPE, WEBSITE_TYPES, WEBSITE_TYPES_BY_OWNER, isWebsiteTypeOfferedFor } from '../website-type-vocabulary';
import {
  DEFAULT_SOCIAL_MEDIA_TYPE, SOCIAL_MEDIA_TYPES, SOCIAL_MEDIA_TYPES_BY_OWNER, isSocialMediaTypeOfferedFor, isSocialPlatform,
} from '../social-media-type-vocabulary';
import { emailEntriesFromAddresses } from '../email-entries';
import { getEntityAwareCommunicationConfig } from '@/components/contacts/dynamic/communication/config/CommunicationConfigs';
import {
  communicationItemsToEmails, communicationItemsToSocial, communicationItemsToWebsites,
} from '@/components/contacts/dynamic/communication/utils/communication-item-mappers';
import { buildEnterpriseContactArrays } from '@/utils/contactForm/extractors/arrays';
import EnterpriseContactSaver from '@/utils/contacts/EnterpriseContactSaver';
import type { ContactFormData } from '@/types/ContactFormTypes';

const OWNERS: readonly ContactOwnerKind[] = ['individual', 'company', 'service'];

interface VocabularyCase {
  readonly comm: 'email' | 'website' | 'social';
  readonly root: readonly string[];
  readonly byOwner: Readonly<Record<ContactOwnerKind, readonly string[]>>;
  readonly defaults: Readonly<Record<ContactOwnerKind, string>>;
  readonly offeredFor: (type: unknown, owner: ContactOwnerKind) => boolean;
  readonly toStored: (type: string, owner: ContactOwnerKind) => string | undefined;
}

const VOCABULARIES: readonly VocabularyCase[] = [
  {
    comm: 'email', root: EMAIL_TYPES, byOwner: EMAIL_TYPES_BY_OWNER, defaults: DEFAULT_EMAIL_TYPE,
    offeredFor: isEmailTypeOfferedFor,
    toStored: (type, owner) => communicationItemsToEmails([{ type, email: 'a@b.gr' }], owner)[0]?.type,
  },
  {
    comm: 'website', root: WEBSITE_TYPES, byOwner: WEBSITE_TYPES_BY_OWNER, defaults: DEFAULT_WEBSITE_TYPE,
    offeredFor: isWebsiteTypeOfferedFor,
    toStored: (type, owner) => communicationItemsToWebsites([{ type, url: 'https://b.gr' }], owner)[0]?.type,
  },
  {
    comm: 'social', root: SOCIAL_MEDIA_TYPES, byOwner: SOCIAL_MEDIA_TYPES_BY_OWNER, defaults: DEFAULT_SOCIAL_MEDIA_TYPE,
    offeredFor: isSocialMediaTypeOfferedFor,
    toStored: (type, owner) => communicationItemsToSocial([{ type, username: 'b' }], owner)[0]?.type,
  },
];

describe.each(VOCABULARIES)('λεξιλόγιο $comm', (v) => {
  it('Ε1 — κάθε υποσύνολο ⊆ ρίζα· η προεπιλογή κάθε κατόχου προσφέρεται από τον ίδιο', () => {
    for (const owner of OWNERS) {
      for (const type of v.byOwner[owner]) expect(v.root).toContain(type);
      expect(v.offeredFor(v.defaults[owner], owner)).toBe(true);
    }
  });

  it('Ε2 — η φόρμα κάθε κατόχου προσφέρει ΑΚΡΙΒΩΣ το υποσύνολό του, με την προεπιλογή του και ετικέτα i18n', () => {
    for (const owner of OWNERS) {
      const config = getEntityAwareCommunicationConfig(v.comm, owner);
      expect(config.types.map((o) => o.value)).toEqual([...v.byOwner[owner]]);
      expect(config.defaultType).toBe(v.defaults[owner]);
      for (const option of config.types) expect(option.label).toMatch(/^communication\./);
    }
  });

  it('Ε3 — γραμμή φόρμας → αποθήκευση: έγκυρη τιμή ΔΙΑΤΗΡΕΙΤΑΙ, άγνωστη ⇒ προεπιλογή του κατόχου (όχι τυφλό `as`)', () => {
    for (const owner of OWNERS) {
      expect(v.toStored('other', owner)).toBe('other');
      expect(v.toStored('bogus', owner)).toBe(v.defaults[owner]);
      expect(v.toStored('constructor', owner)).toBe(v.defaults[owner]);
    }
  });
});

describe('inferEmailType — ο ΕΝΑΣ κανόνας', () => {
  const ADDRESSES = ['info@x.gr', 'sales@x.gr', 'support@x.gr', 'hr@x.gr', 'secretariat@x.gr', 'nikos@x.gr', '', 'constructor@x.gr'];

  it('Ε4 — ΚΛΑΣΗ: για κάθε κάτοχο × διεύθυνση η απάντηση ανήκει στο υποσύνολο του κατόχου', () => {
    for (const owner of OWNERS) {
      for (const address of ADDRESSES) expect(isEmailTypeOfferedFor(inferEmailType(address, owner, 'work'), owner)).toBe(true);
    }
  });

  it('Ε5 — εταιρεία: ρόλος από το τοπικό μέρος· υπηρεσία χωρίς «πωλήσεις» ⇒ προεπιλογή· πρόσωπο ⇒ ό,τι λέει ο καλών', () => {
    expect(inferEmailType('Info@macon.gr', 'company')).toBe('info');
    expect(inferEmailType('sales@x.gr', 'company')).toBe('sales');
    expect(inferEmailType('sales@x.gr', 'service')).toBe('general');
    expect(inferEmailType('secretariat@x.gr', 'service')).toBe('secretariat');
    expect(inferEmailType('nikos@x.gr', 'company')).toBe('general');
    // Το `info@` ενός μηχανικού είναι το ΔΙΚΟ του email εργασίας — όχι «Πληροφορίες» (που η φόρμα του δεν έχει).
    expect(inferEmailType('info@nikolaou.com.gr', 'individual', 'work')).toBe('work');
    expect(inferEmailType('info@nikolaou.com.gr', 'individual')).toBe('personal');
  });
});

describe('γραφείς', () => {
  it('Ε6 — φόρμα με μόνο πεδίο `email` ⇒ τύπος μέσα στο υποσύνολο του ΚΑΤΟΧΟΥ (όχι `work` για όλους)', () => {
    const form = { phone: '', email: 'info@macon.gr' } as unknown as ContactFormData;
    expect(buildEnterpriseContactArrays(form, 'company').emails[0]?.type).toBe('info');
    expect(buildEnterpriseContactArrays(form, 'service').emails[0]?.type).toBe('info');
    expect(buildEnterpriseContactArrays(form, 'individual').emails[0]?.type).toBe('work');
  });

  it('Ε7 — ιστοσελίδα από επίπεδο πεδίο ⇒ η προεπιλογή του κατόχου (το `company` δεν το προσφέρει ούτε εταιρεία ούτε υπηρεσία)', () => {
    for (const owner of OWNERS) {
      const type = EnterpriseContactSaver.getWebsiteTypeForContactType(owner);
      expect(type).toBe(DEFAULT_WEBSITE_TYPE[owner]);
      expect(isWebsiteTypeOfferedFor(type, owner)).toBe(true);
    }
  });

  it('Ε8 — σάρωση προσφοράς: ίδια διεύθυνση ΚΡΑΤΑ τύπο+ετικέτα· νέα ⇒ κανόνας· ξένος τύπος δεν επιβιώνει', () => {
    const existing = [
      { email: 'Info@Macon.gr', type: 'info' as const, isPrimary: true, label: 'Κεντρικό' },
      { email: 'old@macon.gr', type: 'work' as const, isPrimary: false },
    ];
    const out = emailEntriesFromAddresses(['info@macon.gr', 'sales@macon.gr', 'old@macon.gr'], existing, 'company');
    expect(out).toEqual([
      { email: 'info@macon.gr', type: 'info', isPrimary: true, label: 'Κεντρικό' },
      { email: 'sales@macon.gr', type: 'sales', isPrimary: false },
      { email: 'old@macon.gr', type: 'general', isPrimary: false },
    ]);
  });
});

describe('σύνορα', () => {
  it('Ε9 — `isEmailType` / `isSocialPlatform` / `contactOwnerKindOf`', () => {
    expect(isEmailType('info')).toBe(true);
    expect(isEmailType('billing')).toBe(false);
    expect(isSocialPlatform('tiktok')).toBe(true);
    expect(isSocialPlatform('myspace')).toBe(false);
    expect(communicationItemsToSocial([{ platform: 'myspace', username: 'u' }], 'company')[0]?.platform).toBe('other');
    expect(contactOwnerKindOf('service')).toBe('service');
    expect(contactOwnerKindOf(undefined)).toBe('individual');
  });
});
