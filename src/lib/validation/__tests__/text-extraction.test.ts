/**
 * @fileoverview Εξαντλητική εξαγωγή στοιχείων επικοινωνίας από ελεύθερο κείμενο.
 *
 * Το δείγμα δεν είναι φανταστικό: είναι η γραμμή γραφείου της πινακίδας του
 * `G753_ergasia F.dxf` — «ΕΔΡΑ ΝΕΟΧΩΡΟΥΔΑ 2310-788493 κιν 6949727121». Το σταθερό
 * τηλέφωνο είναι γραμμένο **με παύλα**, που ο αγκυρωμένος ελεγκτής απορρίπτει· αν ο
 * καθαρισμός φύγει, χάνεται σιωπηλά μισή γραμμή επικοινωνίας.
 */

import { extractAllUrlsFromText } from '../email-validation';
import { extractAllEmailsFromText, extractAllPhonesFromText } from '../phone-validation';

describe('extractAllPhonesFromText', () => {
  it('βρίσκει ΚΑΙ τα δύο τηλέφωνα της πραγματικής γραμμής γραφείου', () => {
    expect(extractAllPhonesFromText('ΕΔΡΑ ΝΕΟΧΩΡΟΥΔΑ 2310-788493 κιν 6949727121')).toEqual([
      '2310788493',
      '6949727121',
    ]);
  });

  it('το σταθερό με παύλα δεν περνά χωρίς καθαρισμό — γι᾽ αυτό υπάρχει ο καθαρισμός', () => {
    expect(extractAllPhonesFromText('2310-788493')).toEqual(['2310788493']);
    expect(extractAllPhonesFromText('2310 788493')).toEqual(['2310788493']);
  });

  it('δύο αριθμοί χωρισμένοι ΜΟΝΟ με κενό δεν χάνονται μαζί', () => {
    expect(extractAllPhonesFromText('2310788493 6949727121')).toEqual([
      '2310788493',
      '6949727121',
    ]);
  });

  it('δεν επινοεί τηλέφωνα από αριθμούς σχεδίου', () => {
    expect(extractAllPhonesFromText('Ο.Τ. Γ 753 - ΟΙΚ.: 01β - 1:200')).toEqual([]);
    expect(extractAllPhonesFromText('ΙΟΥΛΙΟΣ 2026')).toEqual([]);
  });

  it('χωρίς επαναλήψεις, με τη σειρά εμφάνισης', () => {
    expect(extractAllPhonesFromText('6949727121 και ξανά 6949727121')).toEqual(['6949727121']);
  });
});

describe('extractAllEmailsFromText', () => {
  it('βρίσκει το e-mail της πινακίδας, πεζό', () => {
    expect(extractAllEmailsFromText('e-mail: Info@Nikolaou.com.gr')).toEqual([
      'info@nikolaou.com.gr',
    ]);
  });

  it('δεν βλέπει e-mail εκεί που υπάρχουν μόνο συντομογραφίες', () => {
    expect(extractAllEmailsFromText('ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.')).toEqual([]);
  });
});

describe('extractAllUrlsFromText', () => {
  it('βρίσκει τον ιστότοπο χωρίς πρωτόκολλο, με `www.`', () => {
    expect(extractAllUrlsFromText('site: www.nikolaou.com.gr')).toEqual(['www.nikolaou.com.gr']);
  });

  it('🔴 ΔΕΝ μπερδεύει τον τομέα ενός e-mail με ιστότοπο', () => {
    // Χωρίς τον όρο «σχήμα ή www.», το `nikolaou.com.gr` του e-mail θα γινόταν ιστότοπος
    // και η ίδια πληροφορία θα καταγραφόταν δύο φορές ως δύο διαφορετικά πράγματα.
    expect(extractAllUrlsFromText('e-mail: info@nikolaou.com.gr')).toEqual([]);
  });

  it('🔴 ΔΕΝ βλέπει ιστότοπο σε ελληνικές συντομογραφίες με τελείες', () => {
    expect(extractAllUrlsFromText('Π.Ε. 39 - Ο.Τ. Γ 753 - Δ.Ε. ΕΥΟΣΜΟΥ - Α.Π.Θ.')).toEqual([]);
  });

  it('δέχεται και πλήρη διεύθυνση με πρωτόκολλο', () => {
    expect(extractAllUrlsFromText('βλ. https://nestorconstruct.gr/plans ευχαριστώ')).toEqual([
      'https://nestorconstruct.gr/plans',
    ]);
  });
});
