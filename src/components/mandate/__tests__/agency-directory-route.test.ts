/**
 * @fileoverview Άγκυρες της **δημόσιας διεύθυνσης** της βιτρίνας (ADR-827 §9.15 α/β).
 * @related components/mandate/agency-directory-route · lib/workspace/workspace-scope
 *
 * 🔴 **Γιατί υπάρχει**: η διεύθυνση είναι **τυπωμένη σε κάρτες**. Μια αλλαγή
 * προθέματος δεν σπάει τίποτα ορατά στο δέντρο — σπάει **χαρτιά που κυκλοφορούν**.
 * Και το §9.6 έγραφε επί μία συνεδρία `/o/<ψευδώνυμο>`, διεύθυνση **μη
 * κατασκευάσιμη**, χωρίς να το πιάσει τίποτα.
 */

import { AGENCY_DIRECTORY_ROUTE, agencyProfileRoute } from '../agency-directory-route';
import { OUTSIDE_WORKSPACE } from '@/lib/workspace/workspace-scope';
import { extractWorkspaceSegment } from '@/lib/workspace/workspace-path';

describe('Δ. Η δημόσια διεύθυνση της βιτρίνας', () => {
  it('Δ1 — ο κατάλογος ζει στο `/pro`', () => {
    expect(AGENCY_DIRECTORY_ROUTE).toBe('/pro');
  });

  it('Δ2 — το προφίλ είναι `/pro/<ψευδώνυμο>`', () => {
    expect(agencyProfileRoute('pagonis')).toBe('/pro/pagonis');
  });

  it('Δ3 🔑 — το πρόθεμα είναι ΔΗΛΩΜΕΝΟ ΕΚΤΟΣ χώρου, με λόγο', () => {
    // 🔴 Χωρίς αυτή τη δήλωση το σύνορο πλοήγησης (CHECK 3.61) θα παρήγαγε
    //    `/o/<ψευδώνυμο>/pro/…` — διεύθυνση ΧΩΡΙΣ σελίδα. Ταυτόσημο σχήμα με τα
    //    περιστατικά `/unauthorized` και `/workspace/new` του ADR-787.
    const segment = AGENCY_DIRECTORY_ROUTE.slice(1);
    expect(Object.keys(OUTSIDE_WORKSPACE)).toContain(segment);
    // Και ο λόγος δεν επιτρέπεται να είναι κενός: δήλωση χωρίς λόγο είναι
    // παράκαμψη με άλλο όνομα.
    expect(OUTSIDE_WORKSPACE[segment].length).toBeGreaterThan(80);
  });

  it('Δ4 — ΠΑΡΟΝΟΜΑΣΤΗΣ: η διεύθυνση ΔΕΝ ονομάζει χώρο', () => {
    // Αν κάποιος μετακινούσε τη βιτρίνα κάτω από το `/o/`, αυτό θα κοκκίνιζε —
    // και εκεί ζει ο φρουρός που κάνει τη σελίδα ΑΠΡΟΣΠΕΛΑΣΤΗ σε ανώνυμο.
    expect(extractWorkspaceSegment(AGENCY_DIRECTORY_ROUTE)).toBeNull();
    expect(extractWorkspaceSegment(agencyProfileRoute('pagonis'))).toBeNull();
  });

  it('Δ5 — ψευδώνυμο με ειδικούς χαρακτήρες κωδικοποιείται', () => {
    // ⚠️ Το `alias` έρχεται από **δεδομένα**, όχι από σταθερά. Ένα ωμό
    //    `${route}/${alias}` θα παρήγαγε σπασμένη διεύθυνση για ό,τι δεν είναι
    //    ήδη ασφαλές — και το ψευδώνυμο κρίνεται αλλού, όχι εδώ.
    expect(agencyProfileRoute('a b')).toBe('/pro/a%20b');
    expect(agencyProfileRoute('a/b')).toBe('/pro/a%2Fb');
  });
});
