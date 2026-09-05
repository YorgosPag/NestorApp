/**
 * @fileoverview **Ο ΚΑΝΟΝΙΚΟΠΟΙΗΤΗΣ ΤΡΕΧΕΙ** — και η σύγκριση λέει την αλήθεια.
 * @related lib/contact/channel-email.ts · ADR-844
 *
 * 🔑 **Γιατί υπάρχει**: αυτή η μία γραμμή είναι ο λόγος που ο **πελάτης** και ο
 * **διακομιστής** συμφωνούν για το τι είναι «η ίδια διεύθυνση». Αν αποκλίνουν, ο
 * άνθρωπος με **αποδεδειγμένο** email παίρνει περιττή πρόσκληση — ή, χειρότερα, ο
 * φρουρός λέει *«αποδεδειγμένο»* για διεύθυνση που **δεν** αποδείχθηκε.
 */

import { normaliseChannelEmail, sameChannelEmail } from '@/lib/contact/channel-email';

describe('Α — η κανονική μορφή', () => {
  it('🔑 Α1 — κεφαλαία και κενά φεύγουν', () => {
    expect(normaliseChannelEmail('  Maria@Example.COM ')).toBe('maria@example.com');
  });

  it('🔑 Α2 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ήδη κανονική μένει ίδια (ιδεμποτησία)', () => {
    // ⚠️ Χωρίς αυτό, μια συνάρτηση που π.χ. κόβει τον τελευταίο χαρακτήρα θα περνούσε
    //    το Α1 (το `.COM` θα γινόταν `.co`… και κανείς δεν θα το έβλεπε).
    expect(normaliseChannelEmail('maria@example.com')).toBe('maria@example.com');
  });

  it('🔴 Α3 — ΔΕΝ αφαιρεί τελείες ούτε `+tag` — δύο ΔΙΑΦΟΡΕΤΙΚΟΙ άνθρωποι', () => {
    // 🔴 Η «εξυπνάδα» της Gmail (`m.a.r.i.a+spiti@` = `maria@`) είναι
    //    **προμηθευτο-ειδική** και **λάθος** για τους περισσότερους διακομιστές. Αν
    //    εφαρμοζόταν, δύο άνθρωποι με νόμιμα διαφορετικές διευθύνσεις θα μοιράζονταν
    //    πρόσκληση — και ο ένας θα έπαιρνε τον σύνδεσμο του άλλου.
    expect(normaliseChannelEmail('maria.k+spiti@gmail.com')).toBe('maria.k+spiti@gmail.com');
  });

  it('⛔ Α4 — ΔΕΝ επικυρώνει: δέχεται ό,τι του δώσεις', () => {
    // Το «είναι email;» το απαντά το `isValidEmail`. Ένας κανονικοποιητής που κρίνει
    // θα ήταν δεύτερος ορισμός του τι είναι email.
    expect(normaliseChannelEmail('  ΟΧΙ EMAIL ')).toBe('οχι email');
  });
});

describe('Β — «είναι η ίδια διεύθυνση;»', () => {
  it('🔑 Β1 — ίδια με διαφορετική μορφή ⇒ ΝΑΙ', () => {
    expect(sameChannelEmail(' Maria@Example.COM ', 'maria@example.com')).toBe(true);
  });

  it('🔑 Β2 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: διαφορετικές ⇒ ΟΧΙ', () => {
    // ⚠️ Χωρίς αυτό, ένα `return true` θα περνούσε κάθε άλλο σκέλος — και ο φρουρός
    //    του διαλόγου θα έλεγε «αποδεδειγμένο» για **κάθε** διεύθυνση.
    expect(sameChannelEmail('maria@example.com', 'kostas@example.com')).toBe(false);
  });

  it('🔴 Β3 — ΤΟ ΚΕΝΟ ΔΕΝ ΤΑΥΤΙΖΕΤΑΙ ΜΕ ΤΙΠΟΤΑ, ΟΥΤΕ ΜΕ ΑΛΛΟ ΚΕΝΟ', () => {
    // 🔴 **Το πιο επικίνδυνο σκέλος του αρχείου.** Λογαριασμός χωρίς email (σύνδεση με
    //    τηλέφωνο) + κενή φόρμα θα «ταίριαζαν» — και ο φρουρός θα έλεγε
    //    *«αποδεδειγμένο κανάλι»* για κανάλι που **δεν υπάρχει**, στέλνοντας την πράξη
    //    χωρίς καμία απόδειξη.
    expect(sameChannelEmail('', '')).toBe(false);
    expect(sameChannelEmail('   ', '')).toBe(false);
    expect(sameChannelEmail(null, null)).toBe(false);
    expect(sameChannelEmail(undefined, undefined)).toBe(false);
  });

  it('🔴 Β4 — ούτε το κενό με γεμάτο, προς καμία κατεύθυνση', () => {
    expect(sameChannelEmail(null, 'maria@example.com')).toBe(false);
    expect(sameChannelEmail('maria@example.com', null)).toBe(false);
  });
});
