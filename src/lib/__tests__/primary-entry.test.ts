/**
 * @fileoverview 🔴 **«ΤΟ ΚΥΡΙΟ Ή ΤΟ ΠΡΩΤΟ» — ΜΙΑ ΔΙΑΤΥΠΩΣΗ, ΚΑΙ ΤΟ ΚΕΝΟ ΔΕΝ ΕΙΝΑΙ ΤΙΜΗ.**
 * @related ADR-332 **D24** · ADR-777 §8.33 *(`primaryEmailOf`)*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ — ΜΕΤΡΗΜΕΝΟ 2026-09-05
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `pending-ratchet-work.md` έγραφε *«αντιγραμμένο σε **τρία** domains»*. Η μέτρηση
 * βρήκε **~30 σημεία** — και, χειρότερα, ότι **δεν είναι όλα η ίδια ερώτηση**:
 *
 * 1. «το κύριο, **αλλιώς το πρώτο**» — `find(isPrimary) ?? list[0]`
 * 2. «το κύριο **που είναι και χρήσιμο**» — `find(e => e.isPrimary && e.email)`
 * 3. «το κύριο, **αυστηρά**» — `find(isPrimary)`, **χωρίς** fallback
 *
 * ⚠️ Μια «γενική» αφαίρεση που τις κατάπινε και τις τρεις θα **άλλαζε συμπεριφορά
 * σιωπηλά**. Εδώ κεντρικοποιείται **μόνο η #1**· η #2 **συντίθεται** *(φιλτράρισμα
 * πρώτα)*· η #3 **μένει ως έχει**, γιατί «δεν όρισε κανείς κύριο» είναι υπαρκτή
 * απάντηση σε μερικά σημεία *(η πινακίδα δεν μαντεύει διεύθυνση)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ ΒΡΕΘΗΚΕ **ΣΦΑΛΜΑ**, ΟΧΙ ΜΟΝΟ ΔΙΠΛΟΤΥΠΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `extractPrimaryEmail` *(διαδρομή **ειδοποιήσεων**)* τελείωνε σε
 * `emails[0]?.email ?? null` — **χωρίς έλεγχο κενού**. Μια επαφή με `{ email: '' }`
 * *(μισοσυμπληρωμένη φόρμα, συνηθισμένο)* επέστρεφε `''`, που **δεν είναι `null`** ⇒
 * περνούσε κάθε έλεγχο «υπάρχει;» και έφτανε στον πάροχο ως παραλήπτης. Το ίδιο για
 * τα τηλέφωνα.
 *
 * 🔑 **Η παγίδα ήταν ΗΔΗ ΟΝΟΜΑΣΜΕΝΗ** στην κεφαλίδα του `primaryEmailOf` (ADR-777
 * §8.33) — απλώς κανείς δεν είχε συνδέσει τα δύο σημεία. **Ένα SSoT που δεν το καλεί
 * κανείς είναι τεκμηρίωση, όχι φρουρός** — και γι' αυτό το ΜΕΡΟΣ Β **εκτελεί** τους
 * πραγματικούς εξαγωγείς, αντί να ελέγχει μόνο τη νέα συνάρτηση.
 */

import {
  extractPrimaryEmail,
  extractPrimaryPhone,
  extractPrimaryAddress,
} from '@/app/api/notifications/professional-assigned/hierarchy-resolver';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { primaryOrFirst } from '@/lib/primary-entry';

describe('ADR-332 D24 — «το κύριο ή το πρώτο», μία διατύπωση', () => {
  // ===========================================================================
  describe('ΜΕΡΟΣ Α — η επιλογή', () => {
    it('🔴 το ΚΥΡΙΟ κερδίζει ακόμη κι όταν ΔΕΝ είναι πρώτο', () => {
      const entries = [{ id: 'a' }, { id: 'b', isPrimary: true }, { id: 'c' }];

      expect(primaryOrFirst(entries)?.id).toBe('b');
    });

    it('χωρίς κύριο, το ΠΡΩΤΟ — η σειρά της λίστας είναι σειρά ΚΑΤΑΧΩΡΗΣΗΣ', () => {
      expect(primaryOrFirst([{ id: 'a' }, { id: 'b' }])?.id).toBe('a');
    });

    it('κενή λίστα · `undefined` · `null` ⇒ `undefined` — ΠΟΤΕ πέταγμα', () => {
      expect(primaryOrFirst([])).toBeUndefined();
      expect(primaryOrFirst(undefined)).toBeUndefined();
      expect(primaryOrFirst(null)).toBeUndefined();
    });

    /**
     * 🔴 **Truthy ΔΕΝ αρκεί.** Ωμά έγγραφα από παλιές φόρμες κουβαλούν `'false'`, `1`,
     * `'no'` — τιμές που ένα truthy `if` θα διάβαζε ως *«αυτό είναι το κύριο»* χωρίς
     * κανείς να το έχει πει. Η αυστηρή σύγκριση είναι η **υπάρχουσα** αυθεντία του
     * `primaryEmailOf`, όχι νέα αυστηρότητα.
     */
    it.each([['false'], [1], ['yes'], [{}]])('τιμή truthy αλλά όχι `true` (%p) ΔΕΝ είναι κύριο', (value) => {
      const entries = [{ id: 'a' }, { id: 'b', isPrimary: value }];

      expect(primaryOrFirst(entries)?.id).toBe('a');
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Β — ΤΟ ΚΕΝΟ ΔΕΝ ΕΙΝΑΙ ΤΙΜΗ *(οι πραγματικοί εξαγωγείς, εκτελεσμένοι)*', () => {
    it('🔴 επαφή με ΜΟΝΟ κενό email ⇒ `null`, ΠΟΤΕ `\'\'`', () => {
      expect(extractPrimaryEmail({ emails: [{ email: '' }] })).toBeNull();
      expect(extractPrimaryEmail({ emails: [{ email: '   ' }] })).toBeNull();
    });

    it('🔴 κύριο ΚΕΝΟ + δεύτερο έγκυρο ⇒ το έγκυρο — το φιλτράρισμα προηγείται', () => {
      const emails = [{ email: '', isPrimary: true }, { email: 'nikos@example.gr' }];

      expect(extractPrimaryEmail({ emails })).toBe('nikos@example.gr');
    });

    it('το κύριο ΕΓΚΥΡΟ κερδίζει το πρώτο έγκυρο', () => {
      const emails = [{ email: 'palio@example.gr' }, { email: 'kyrio@example.gr', isPrimary: true }];

      expect(extractPrimaryEmail({ emails })).toBe('kyrio@example.gr');
    });

    it('το ΠΑΛΑΙΟ μονό πεδίο `contact.email` προηγείται — η σειρά ΔΕΝ αντιστρέφεται', () => {
      const data = { email: 'mono@example.gr', emails: [{ email: 'lista@example.gr', isPrimary: true }] };

      expect(extractPrimaryEmail(data)).toBe('mono@example.gr');
    });

    it('🔴 ΤΟ ΙΔΙΟ ισχύει για τα ΤΗΛΕΦΩΝΑ — κενό ⇒ `null`', () => {
      expect(extractPrimaryPhone({ phones: [{ number: '' }] })).toBeNull();
      expect(
        extractPrimaryPhone({ phones: [{ number: '', isPrimary: true }, { number: '2101234567' }] }),
      ).toBe('2101234567');
    });

    it('η ΔΙΕΥΘΥΝΣΗ διαλέγει την κύρια, και κενή λίστα δίνει `null`', () => {
      const addresses = [{ street: 'Πρώτη', city: 'Αθήνα' }, { street: 'Κύρια', city: 'Πάτρα', isPrimary: true }];

      expect(extractPrimaryAddress({ addresses })).toContain('Κύρια');
      expect(extractPrimaryAddress({ addresses: [] })).toBeNull();
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Γ — το ΑΝΤΙ-ΠΑΡΑΔΕΙΓΜΑ: η γραφή όπως ήταν πριν τη διόρθωση', () => {
    /** Η **ακριβής** προηγούμενη υλοποίηση, αντιγραμμένη από το git. */
    function extractPrimaryEmailBefore(contactData: Record<string, unknown>): string | null {
      const directEmail = contactData.email as string | undefined;
      if (directEmail) return directEmail;

      const emails = contactData.emails as Array<{ email?: string; isPrimary?: boolean }> | undefined;
      if (!emails || emails.length === 0) return null;

      const primary = emails.find((e) => e.isPrimary && e.email);
      if (primary?.email) return primary.email;

      return emails[0]?.email ?? null;
    }

    it('🔴 ΕΠΕΣΤΡΕΦΕ `\'\'` — αλλιώς το ΜΕΡΟΣ Β δεν αποδεικνύει ότι κάτι διορθώθηκε', () => {
      expect(extractPrimaryEmailBefore({ emails: [{ email: '' }] })).toBe('');
      expect(extractPrimaryEmailBefore({ emails: [{ email: '' }] })).not.toBeNull();
    });

    it('🔴 και το κενό ΠΕΡΝΟΥΣΕ τον έλεγχο «υπάρχει;» — γι\' αυτό ήταν αόρατο', () => {
      const before = extractPrimaryEmailBefore({ emails: [{ email: '' }] });

      // Ο τυπικός φρουρός κάθε ειδοποιητή: «έχουμε διεύθυνση;»
      expect(before !== null).toBe(true);
      expect(extractPrimaryEmail({ emails: [{ email: '' }] }) !== null).toBe(false);
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Δ — το υπάρχον SSoT ΚΑΛΕΙ τον κοινό, δεν τον αγνοεί', () => {
    it('το `primaryEmailOf` συμφωνεί με τον εξαγωγέα ειδοποιήσεων σε ΚΑΘΕ περίπτωση', () => {
      const cases = [
        [{ email: '' }],
        [{ email: 'a@b.gr' }],
        [{ email: '', isPrimary: true }, { email: 'c@d.gr' }],
        [{ email: 'e@f.gr' }, { email: 'g@h.gr', isPrimary: true }],
      ];

      for (const emails of cases) {
        expect(extractPrimaryEmail({ emails })).toBe(primaryEmailOf(emails));
      }
    });
  });
});
