/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α37.8 του ADR-866 Φ1.2** — το κέλυφος ADR-588 μαθαίνει τη θεματοφυλακή **από τη σύνδεση**.
 * @related ADR-866 §2.9.3 Κ1 · ADR-588 · entity-media-binding.ts · EntityMediaFilesTab.tsx
 *
 * Μοκάρεται **μόνο** το `EntityFilesManager` (για να διαβαστούν τα props που του δόθηκαν) και οι πηγές ταυτότητας.
 * Οι συνδέσεις (`propertyDossierMediaBinding` · `parkingMediaBinding`) και το κέλυφος εκτελούνται **πραγματικά**.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | επαναφορά `custody={{ companyId }}` στο κέλυφος | «προσωπική ⇒ `{ userId }`» ⇒ 🔴 |
 * | ο προσωπικός κλάδος ρωτά `useEntityFilesTabSession` | «ΚΑΜΙΑ ερώτηση εταιρείας» ⇒ 🔴 |
 * | η σύνδεση φακέλου δηλώνει `session-company` | «προσωπική ⇒ `{ userId }`» ⇒ 🔴 |
 */

import React from 'react';
import { render } from '@testing-library/react';

import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

const managerProps = jest.fn<void, [Record<string, unknown>]>();
const sessionCalls = jest.fn<void, []>();
let signedInUid: string | undefined = 'owner-1';

jest.mock('@/components/shared/files/EntityFilesManager', () => ({
  EntityFilesManager: (props: Record<string, unknown>) => {
    managerProps(props);
    return null;
  },
}));

jest.mock('@/components/shared/files/useEntityFilesTabSession', () => ({
  useEntityFilesTabSession: () => {
    sessionCalls();
    return { companyId: 'comp-session', currentUserId: 'employee-1', companyName: 'Γραφείο' };
  },
}));

jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuth: () => ({ user: signedInUid === undefined ? null : { uid: signedInUid } }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: '' } }),
}));

const { EntityMediaFilesTab } = require('../EntityMediaFilesTab') as typeof import('../EntityMediaFilesTab');
const { parkingMediaBinding, propertyDossierMediaBinding } = require('../entity-media-binding') as
  typeof import('../entity-media-binding');
const { PHOTOS_MEDIA_CONFIG } = require('../media-tab-configs') as typeof import('../media-tab-configs');

const DOSSIER = { id: 'pdos_test', label: 'Το σπίτι μου', userId: 'owner-1' };

beforeEach(() => {
  managerProps.mockReset();
  sessionCalls.mockReset();
  signedInUid = 'owner-1';
});

describe('🏆 Α37.8 — προσωπική σύνδεση (φάκελος ακινήτου)', () => {
  it('ο διαχειριστής παίρνει `{ userId: <κάτοχος φακέλου> }` και τύπο `property_dossier`', () => {
    render(<EntityMediaFilesTab binding={propertyDossierMediaBinding(DOSSIER)} media={PHOTOS_MEDIA_CONFIG} />);

    expect(managerProps).toHaveBeenCalledTimes(1);
    expect(managerProps.mock.calls[0][0]).toEqual(expect.objectContaining({
      custody: { userId: 'owner-1' },
      currentUserId: 'owner-1',
      entityType: 'property_dossier',
      entityId: 'pdos_test',
      purpose: 'dossier-photo',
    }));
  });

  it('ΚΑΜΙΑ ερώτηση εταιρείας — ούτε για ετικέτα (ο προσωπικός χώρος δεν διευρύνεται προς το γραφείο)', () => {
    render(<EntityMediaFilesTab binding={propertyDossierMediaBinding(DOSSIER)} media={PHOTOS_MEDIA_CONFIG} />);

    expect(sessionCalls).not.toHaveBeenCalled();
    expect(managerProps.mock.calls[0][0].companyName).toBeUndefined();
  });

  it('χωρίς ταυτότητα ⇒ μήνυμα σύνδεσης, κανένας διαχειριστής', () => {
    signedInUid = undefined;

    const { container } = render(<EntityMediaFilesTab binding={propertyDossierMediaBinding(DOSSIER)} media={PHOTOS_MEDIA_CONFIG} />);

    expect(managerProps).not.toHaveBeenCalled();
    expect(container.textContent).toBe(PHOTOS_MEDIA_CONFIG.signInKey);
  });
});

describe('🏆 Α37.8 — εταιρική σύνδεση (Parking) — ΑΜΕΤΑΒΛΗΤΗ', () => {
  it('ο διαχειριστής παίρνει την εταιρεία της ΣΥΝΕΔΡΙΑΣ, όπως πριν τη Φ1.2', () => {
    const parking = { id: 'park_1', number: 'P-12', projectId: 'proj_1' } as unknown as ParkingSpot;

    render(<EntityMediaFilesTab binding={parkingMediaBinding(parking)} media={PHOTOS_MEDIA_CONFIG} />);

    expect(sessionCalls).toHaveBeenCalled();
    expect(managerProps.mock.calls[0][0]).toEqual(expect.objectContaining({
      custody: { companyId: 'comp-session' },
      currentUserId: 'employee-1',
      entityType: 'parking_spot',
      companyName: 'Γραφείο',
    }));
  });
});
