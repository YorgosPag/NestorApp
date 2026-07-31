/**
 * ADR-742 Φάση Δ — ο φύλακας ιδιοκτησίας του στρώματος του πράκτορα.
 *
 * Το κρίσιμο ερώτημα δεν είναι «μπλοκάρει;» αλλά **«μπορεί ο καλών να ξεχωρίσει
 * το ξένο από το ανύπαρκτο;»**. Γι' αυτό σχεδόν κάθε test εδώ είναι `toEqual`
 * μεταξύ των δύο κλάδων — όχι έλεγχος μηνύματος.
 *
 * @see src/services/ai-pipeline/tools/tool-tenant-guard.ts
 */

import { resolveOwnedToolDoc, type TenantDocSnapshot } from '../tool-tenant-guard';
import type { AgenticContext, ToolResult } from '../executor-shared-types';

const OWNER = 'co-1';
const INTRUDER = 'co-2';

const ctx = { companyId: OWNER, channel: 'telegram', requestId: 'req-1' } as AgenticContext;

const subject = { resource: 'FileRecord', resourceId: 'file-9' };

/** Το γνήσιο «δεν βρέθηκε» ενός υποθετικού handler. */
const notFound = (): ToolResult => ({ success: false, error: 'FileRecord "file-9" not found.' });

/** Στιγμιότυπο που υπάρχει, με το `companyId` που του δίνεις. */
function snapWith(companyId: unknown): TenantDocSnapshot {
  return { exists: true, data: () => ({ companyId, filename: 'a.pdf' }) };
}

const ABSENT: TenantDocSnapshot = { exists: false, data: () => undefined };

describe('resolveOwnedToolDoc — δικό μας έγγραφο', () => {
  it('περνά και επιστρέφει τα δεδομένα', () => {
    const out = resolveOwnedToolDoc({ snap: snapWith(OWNER), ctx, subject, notFound });

    expect(out.ok).toBe(true);
    // Ο αρνητικός κλάδος δεν έχει `data` — γι' αυτό η ένωση είναι διακριτή.
    if (!out.ok) throw new Error('αναμενόταν ok');
    expect(out.data.filename).toBe('a.pdf');
  });
});

describe('🔴 ξένο και ανύπαρκτο είναι ΔΥΣΔΙΑΚΡΙΤΑ', () => {
  it('ξένο έγγραφο δίνει ΑΚΡΙΒΩΣ το γνήσιο «δεν βρέθηκε»', () => {
    const foreign = resolveOwnedToolDoc({ snap: snapWith(INTRUDER), ctx, subject, notFound });
    const absent = resolveOwnedToolDoc({ snap: ABSENT, ctx, subject, notFound });

    expect(foreign.ok).toBe(false);
    expect(absent.ok).toBe(false);
    if (foreign.ok || absent.ok) throw new Error('αναμενόταν άρνηση');

    // ΟΧΙ «μοιάζει» — ίσο. Αν αποκλίνει έστω και σε ένα πεδίο, το σχήμα
    // γίνεται το μαντείο (ADR-742 §3.4).
    expect(foreign.result).toEqual(absent.result);
  });

  it('η ταυτότητα κρατά και όταν το γνήσιο είναι ΕΠΙΤΥΧΙΑ με κενό σώμα', () => {
    // Το σχήμα του `firestore_get_document`: το γνήσιο κενό είναι
    // `{success:true, data:null, count:0}`. Ακριβώς εδώ έσπασε πριν η
    // μεταμφίεση — το `success` flag ξεχώριζε τα δύο χωρίς καμία λέξη.
    const emptyOk = (): ToolResult => ({ success: true, data: null, count: 0 });

    const foreign = resolveOwnedToolDoc({
      snap: snapWith(INTRUDER),
      ctx,
      subject,
      notFound: emptyOk,
    });
    const absent = resolveOwnedToolDoc({ snap: ABSENT, ctx, subject, notFound: emptyOk });

    if (foreign.ok || absent.ok) throw new Error('αναμενόταν άρνηση');
    expect(foreign.result).toEqual(absent.result);
    expect(foreign.result.success).toBe(true);
  });

  it('καμία λέξη της άρνησης δεν διαρρέει στον καλούντα', () => {
    const out = resolveOwnedToolDoc({ snap: snapWith(INTRUDER), ctx, subject, notFound });
    if (out.ok) throw new Error('αναμενόταν άρνηση');

    const wire = JSON.stringify(out.result).toLowerCase();
    // Τα ακριβή strings που έφευγαν στο μοντέλο πριν τη Φάση Δ.
    expect(wire).not.toContain('access denied');
    expect(wire).not.toContain('different company');
    expect(wire).not.toContain('another company');
    expect(wire).not.toContain(INTRUDER);
  });
});

describe('🔴 η παγίδα του κενού `companyId` (ADR-742 §4)', () => {
  it('έγγραφο χωρίς companyId δεν ανήκει σε κανέναν', () => {
    for (const missing of [undefined, null, '']) {
      const out = resolveOwnedToolDoc({ snap: snapWith(missing), ctx, subject, notFound });
      expect(out.ok).toBe(false);
    }
  });

  it('καλών με χαλασμένο token (companyId κενό) δεν παίρνει τίποτα', () => {
    const broken = { companyId: '', channel: 'telegram', requestId: 'r' } as AgenticContext;

    // Με σκέτο `===` αυτό περνούσε: `'' === ''` ⇒ true.
    const out = resolveOwnedToolDoc({ snap: snapWith(''), ctx: broken, subject, notFound });
    expect(out.ok).toBe(false);
  });

  it('υπαρκτό έγγραφο με κενό tenant είναι δυσδιάκριτο από ανύπαρκτο', () => {
    const empty = resolveOwnedToolDoc({ snap: snapWith(''), ctx, subject, notFound });
    const absent = resolveOwnedToolDoc({ snap: ABSENT, ctx, subject, notFound });
    if (empty.ok || absent.ok) throw new Error('αναμενόταν άρνηση');
    expect(empty.result).toEqual(absent.result);
  });
});

describe('οριακά στιγμιότυπα', () => {
  it('exists:true αλλά data() === undefined ⇒ άρνηση, όχι κατάρρευση', () => {
    const weird: TenantDocSnapshot = { exists: true, data: () => undefined };
    const out = resolveOwnedToolDoc({ snap: weird, ctx, subject, notFound });
    expect(out.ok).toBe(false);
  });

  it('μη-string companyId δεν ταιριάζει ποτέ', () => {
    // `{companyId: 0}` και καλών `''` δεν πρέπει να «συμπέσουν» σε καμία
    // χαλαρή σύγκριση.
    const out = resolveOwnedToolDoc({ snap: snapWith(0), ctx, subject, notFound });
    expect(out.ok).toBe(false);
  });
});
