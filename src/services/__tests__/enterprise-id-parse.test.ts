/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α36.9 του ADR-866 Φ1.1** — ο ΕΝΑΣ κριτής «έγκυρη ταυτότητα ΑΥΤΟΥ του είδους».
 * @related services/enterprise-id-parse.ts · ADR-866 §2.8 (N.0.2: ήταν δύο χειρόγραφα αντίγραφα)
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | μόνο `isValidEnterpriseId` (χωρίς έλεγχο προθέματος) | «ταυτότητα αγγελίας δεν είναι φάκελος» ⇒ 🔴 |
 * | μόνο έλεγχος προθέματος (χωρίς uuid v4) | «πρόθεμα χωρίς v4» ⇒ 🔴 |
 * | `trim` μέσα στο αυστηρό | «το αυστηρό δεν κανονικοποιεί» ⇒ 🔴 |
 */

import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { enterpriseIdFromRequest, isEnterpriseIdOfPrefix } from '@/services/enterprise-id-parse';

const DOSSIER = ENTERPRISE_ID_PREFIXES.PROPERTY_DOSSIER;

describe('🏆 Α36.9 — `isEnterpriseIdOfPrefix` · `enterpriseIdFromRequest`', () => {
  const dossierId = enterpriseIdService.generatePropertyDossierId();

  it('το πρόθεμα του φακέλου είναι `pdos` και ο γεννήτορας το σέβεται', () => {
    expect(DOSSIER).toBe('pdos');
    expect(isEnterpriseIdOfPrefix(dossierId, DOSSIER)).toBe(true);
  });

  it('🔴 έγκυρη ταυτότητα ΑΛΛΟΥ είδους δεν είναι φάκελος', () => {
    expect(isEnterpriseIdOfPrefix(enterpriseIdService.generateOwnerPropertyId(), DOSSIER)).toBe(false);
  });

  it('🔴 γνωστό πρόθεμα ΔΕΝ αρκεί — χρειάζεται πραγματικό uuid v4', () => {
    expect(isEnterpriseIdOfPrefix('pdos_not-a-uuid', DOSSIER)).toBe(false);
    expect(isEnterpriseIdOfPrefix('pdos_00000000-0000-1000-8000-000000000000', DOSSIER)).toBe(false);
  });

  it('το αυστηρό ΔΕΝ κανονικοποιεί· το «από αίτημα» κάνει `trim` και επιστρέφει την καθαρή ταυτότητα', () => {
    expect(isEnterpriseIdOfPrefix(` ${dossierId} `, DOSSIER)).toBe(false);
    expect(enterpriseIdFromRequest(` ${dossierId} `, DOSSIER)).toBe(dossierId);
  });

  it.each([[undefined], [null], [42], [''], ['   ']])('μη ταυτότητα (%p) ⇒ `null`', (value) => {
    expect(enterpriseIdFromRequest(value, DOSSIER)).toBeNull();
  });
});
