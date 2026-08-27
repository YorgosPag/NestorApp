/**
 * ΑΓΚΥΡΕΣ — **ΣΥΝΟΧΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΡΟΛΩΝ** (ADR-823 §13)
 *
 * ## Η ερώτηση
 *
 * > Υπάρχει ρόλος που βλέπει **ακίνητα** αλλά **όχι** τους χώρους τους —
 * > δηλαδή που η εφαρμογή του δείχνει πόρτα και του κλείνει τον τοίχο;
 *
 * ## 🔴 Το περιστατικό (μετρημένο 2026-08-27)
 *
 * Η μετονομασία `units` → `properties` (**ADR-269**) **δεν ολοκληρώθηκε**:
 *
 * | Διαδρομή | Ζητά |
 * |---|---|
 * | `/api/properties` | `properties:properties:view` *(νέο)* |
 * | `/api/parking` · `/api/storages` · `/api/spaces/batch-resolve` | `units:units:view` *(**παλιό**)* |
 *
 * Ο `internal_user` προστέθηκε **μετά** τη μετονομασία και πήρε **μόνο το νέο**
 * όνομα. Αποτέλεσμα, ζωντανά στον browser:
 *
 * ```
 * GET /api/parking → 403 {"requiredPermission":"units:units:view"}
 * Σφάλμα φόρτωσης — Permission denied
 * ```
 *
 * …ενώ η αριστερή πλοήγηση **έδειχνε** κανονικά το «Χώροι». **Πόρτα σε τοίχο.**
 *
 * ⚠️ **Και ο `viewer` — ο ΧΑΜΗΛΟΤΕΡΟΣ ρόλος του καταλόγου — το είχε.** Δηλαδή ο
 * υπάλληλος της εταιρείας είχε **λιγότερα από τον θεατή**. Αυτό δεν είναι
 * πολιτική· είναι κενό, και **κανένα test δεν το έβλεπε**.
 *
 * ## Τι κλειδώνει
 *
 * Το ζευγάρωμα των δύο ονομάτων, με **ρητή** λίστα εξαιρέσεων. Κάθε νέα εξαίρεση
 * πρέπει να γραφτεί **με λόγο** — δεν περνά σιωπηλά.
 *
 * @see ADR-823 §13 · ADR-269 (η μετονομασία) · ADR-801 §2.11 (ο κατάλογος = δεδομένα)
 */

import { PREDEFINED_ROLES } from '../role-catalogue';

/** Το **νέο** και το **παλιό** όνομα της ίδιας ερώτησης «βλέπω τους χώρους;». */
const NEW_NAME = 'properties:properties:view';
const LEGACY_NAME = 'units:units:view';

/**
 * Ρόλοι που κρατούν **μόνο** το νέο όνομα — **με γραμμένο λόγο**.
 *
 * ⚠️ Η προσθήκη ονόματος εδώ είναι **απόφαση**, όχι διόρθωση κόκκινου test.
 * Αν προσθέτεις ρόλο, γράψε **γιατί** η εφαρμογή δεν του δείχνει «Χώροι».
 */
const DECLARED_EXCEPTIONS: Readonly<Record<string, string>> = {
  external_user:
    'Εξωτερικός συνεργάτης: συνολικά ΔΥΟ δικαιώματα (projects:view + properties:view). ' +
    'Δεν του δείχνεται καθόλου ο χώρος εργασίας της εταιρείας — δεν υπάρχει πόρτα να ' +
    'οδηγήσει σε τοίχο.',
};

const roles = Object.entries(PREDEFINED_ROLES);

describe('κατάλογος ρόλων — συνοχή ανάμεσα στο ΠΑΛΙΟ και το ΝΕΟ όνομα', () => {
  it('ο κατάλογος δεν είναι άδειος (αλλιώς κάθε test παρακάτω είναι κενό)', () => {
    // ⚠️ Χωρίς αυτό, μια αλλαγή στο σχήμα του καταλόγου θα άφηνε ΟΛΑ τα
    // επόμενα πράσινα πάνω σε μηδέν ρόλους — φρουρός που δεν φυλάει.
    expect(roles.length).toBeGreaterThan(5);
    expect(roles.some(([, r]) => r.permissions.includes(NEW_NAME))).toBe(true);
    expect(roles.some(([, r]) => r.permissions.includes(LEGACY_NAME))).toBe(true);
  });

  it('🔴 όποιος βλέπει ΑΚΙΝΗΤΑ βλέπει και ΧΩΡΟΥΣ — ή είναι δηλωμένη εξαίρεση', () => {
    const offenders = roles
      .filter(([name, role]) =>
        role.permissions.includes(NEW_NAME) &&
        !role.permissions.includes(LEGACY_NAME) &&
        !(name in DECLARED_EXCEPTIONS),
      )
      .map(([name]) => name);

    expect(offenders).toEqual([]);
  });

  it('ο internal_user συγκεκριμένα — ο ρόλος του περιστατικού', () => {
    const permissions = PREDEFINED_ROLES.internal_user!.permissions;
    expect(permissions).toContain(NEW_NAME);
    expect(permissions).toContain(LEGACY_NAME);
  });

  it('ΔΕΝ του δόθηκε γραφή — παραμένει ρόλος ΑΝΑΓΝΩΣΗΣ', () => {
    // 🔑 Η διόρθωση έπρεπε να είναι **ελάχιστη**. Αν κάποιος «στρογγυλέψει» τα
    // δικαιώματα προσθέτοντας create/update/delete, αυτό κοκκινίζει.
    const permissions = PREDEFINED_ROLES.internal_user!.permissions;
    for (const forbidden of [
      'units:units:create', 'units:units:update', 'units:units:delete',
      'properties:properties:create', 'properties:properties:update', 'properties:properties:delete',
    ]) {
      expect(permissions).not.toContain(forbidden);
    }
  });

  it('ο viewer εξακολουθεί να μην ξεπερνά τον υπάλληλο σε αυτό το πεδίο', () => {
    // Το σύμπτωμα που αποκάλυψε το κενό: ο χαμηλότερος ρόλος είχε ΠΕΡΙΣΣΟΤΕΡΑ.
    const viewer = PREDEFINED_ROLES.viewer!.permissions;
    const internal = PREDEFINED_ROLES.internal_user!.permissions;
    const viewerHasThatInternalLacks = viewer.filter(
      (p) => p.endsWith(':view') && !internal.includes(p),
    );
    expect(viewerHasThatInternalLacks).not.toContain(LEGACY_NAME);
  });

  it('κάθε δηλωμένη εξαίρεση έχει ΠΡΑΓΜΑΤΙΚΟ λόγο, όχι κενό string', () => {
    for (const [name, reason] of Object.entries(DECLARED_EXCEPTIONS)) {
      expect(Object.keys(PREDEFINED_ROLES)).toContain(name);
      expect(reason.trim().length).toBeGreaterThan(40);
    }
  });
});
