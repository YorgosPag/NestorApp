/**
 * @jest-environment node
 *
 * =============================================================================
 * ADR-744 §15 (Φ4) — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΑΦΑΙΡΕΣΗΣ
 * =============================================================================
 *
 * Το per-route slice είναι **ΑΦΑΙΡΕΣΗ**: κρατά μόνο ό,τι το κέλυφος δεν απαντά
 * ήδη. Αν η αφαίρεση σπάσει προς τα **πάνω** (κρατά περισσότερα), κάθε σελίδα
 * ξανακουβαλά τα κοινά κλειδιά και το «per-route» γίνεται **ΜΕΓΑΛΥΤΕΡΟ** από το
 * σημερινό. Αν σπάσει προς τα **κάτω** (κρατά λιγότερα), βγαίνει ωμό κλειδί.
 * Καμία από τις δύο δεν φαίνεται χωρίς άγκυρα — γι' αυτό υπάρχει αυτό το αρχείο.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RS = require('../lib/i18n-shell-slice/route-slices');

const REPO = path.resolve(__dirname, '..', '..');

describe('Α — η ταυτότητα της διαδρομής', () => {
  it('Α1: το route group ΔΕΝ μπαίνει στο id (είναι φάκελος, όχι URL)', () => {
    expect(RS.routeIdFor('src/app/(app)/test-harness/listing-shapes/page.tsx')).toBe('test-harness__listing-shapes');
    expect(RS.routeUrlFor('src/app/(app)/test-harness/listing-shapes/page.tsx')).toBe('/test-harness/listing-shapes');
  });

  it('Α2: τα δυναμικά τμήματα χάνουν τις αγκύλες στο ΟΝΟΜΑ ΑΡΧΕΙΟΥ, όχι στη διεύθυνση', () => {
    expect(RS.routeIdFor('src/app/(light)/listing/[id]/page.tsx')).toBe('listing__id');
    expect(RS.routeUrlFor('src/app/(light)/listing/[id]/page.tsx')).toBe('/listing/[id]');
  });

  it('Α3: η ρίζα έχει όνομα, δεν γίνεται κενό', () => {
    expect(RS.routeIdFor('src/app/(light)/page.tsx')).toBe('root');
    expect(RS.routeUrlFor('src/app/(light)/page.tsx')).toBe('/');
  });
});

describe('Σ — η αφαίρεση', () => {
  it('Σ1: κλειδί που ΥΠΑΡΧΕΙ στο κέλυφος αφαιρείται', () => {
    const route = { ns: { a: 'ΑΛΦΑ', b: 'ΒΗΤΑ' } };
    const shell = { ns: { a: 'ΑΛΦΑ' } };
    expect(RS.subtractShell(route, shell, [])).toEqual({ ns: { b: 'ΒΗΤΑ' } });
  });

  it('Σ2: namespace που ταξιδεύει ΟΛΟΚΛΗΡΟ στο κέλυφος φεύγει εντελώς', () => {
    const route = { common: { x: 'Χ' }, other: { y: 'Υ' } };
    expect(RS.subtractShell(route, {}, ['common'])).toEqual({ other: { y: 'Υ' } });
  });

  it('Σ3: η αφαίρεση είναι ΑΝΑΔΡΟΜΙΚΗ — φωλιασμένα κλειδιά κρίνονται ξεχωριστά', () => {
    const route = { ns: { map: { basemap: { map: 'Χάρτης', satellite: 'Δορυφόρος' } } } };
    const shell = { ns: { map: { basemap: { map: 'Χάρτης' } } } };
    expect(RS.subtractShell(route, shell, [])).toEqual({ ns: { map: { basemap: { satellite: 'Δορυφόρος' } } } });
  });

  it('Σ4: κλάδος που αδειάζει ΕΞΑΦΑΝΙΖΕΤΑΙ — κανένα κενό αντικείμενο', () => {
    const route = { ns: { map: { basemap: { map: 'Χάρτης' } } } };
    const shell = { ns: { map: { basemap: { map: 'Χάρτης' } } } };
    expect(RS.subtractShell(route, shell, [])).toEqual({});
  });

  it('Σ5: namespace που ΔΕΝ υπάρχει καθόλου στο κέλυφος περνά ΑΘΙΚΤΟ', () => {
    const route = { 'geo-canvas': { map: { basemap: { map: 'Χάρτης' } } } };
    expect(RS.subtractShell(route, { common: {} }, [])).toEqual(route);
  });

  it('Σ6: διαφορετική ΤΙΜΗ στο ίδιο κλειδί ΔΕΝ επιβιώνει — το κέλυφος είναι η αυθεντία', () => {
    // Αν το route slice κρατούσε τη δική του τιμή, θα υπήρχαν ΔΥΟ αλήθειες για
    // το ίδιο κλειδί, και ποια κερδίζει θα το έκρινε η σειρά εγκατάστασης.
    const route = { ns: { a: 'ΔΙΑΦΟΡΕΤΙΚΟ' } };
    const shell = { ns: { a: 'ΚΕΛΥΦΟΣ' } };
    expect(RS.subtractShell(route, shell, [])).toEqual({});
  });
});

/**
 * ⚠️ **ΤΟ ΣΥΝΟΛΟ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΗ ΔΗΛΩΣΗ, ΟΧΙ ΑΠΟ ΛΙΣΤΑ ΕΔΩ.** Μια δεύτερη
 * χειρόγραφη λίστα διαδρομών μέσα στο test θα απέκλινε από το
 * `.i18n-shell-slice.json` — ακριβώς το σχήμα που αυτό το ADR υπάρχει για να
 * καταργήσει. Νέα διαδρομή στη δήλωση ⇒ ελέγχεται **αυτόματα**.
 */
describe('Π — τα πραγματικά artifacts στο δέντρο', () => {
  const config = JSON.parse(fs.readFileSync(path.join(REPO, '.i18n-shell-slice.json'), 'utf8'));
  const declared = Object.keys(config.routeSlices || {});
  const shell = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.el.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.manifest.json'), 'utf8'));
  const wholeRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'src/i18n/generated/shell-slice.whole.json'), 'utf8'));
  const wholeNs = Array.isArray(wholeRaw) ? wholeRaw : Object.keys(wholeRaw);

  it('Π0: υπάρχει τουλάχιστον μία δηλωμένη διαδρομή — αλλιώς τα Π από κάτω δεν ασκούνται', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  it.each(declared)('Π1 [%s]: το artifact υπάρχει και δεν είναι κενό', page => {
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, RS.routeIdFor(page), 'el');
    expect(fs.existsSync(path.join(REPO, rel))).toBe(true);
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'))).length).toBeGreaterThan(0);
  });

  it.each(declared)('Π2 [%s]: κανένα namespace που το κέλυφος ταξιδεύει ΟΛΟΚΛΗΡΟ', page => {
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, RS.routeIdFor(page), 'el');
    const slice = JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));
    expect(Object.keys(slice).filter(ns => wholeNs.includes(ns))).toEqual([]);
  });

  it.each(declared)('Π3 [%s]: το manifest ΤΟ ΥΠΟΓΡΑΦΕΙ — αλλιώς κανένας φρουρός δεν το βλέπει', page => {
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, RS.routeIdFor(page), 'el');
    expect(Object.keys(manifest.artifacts)).toContain(rel);
  });

  it('Π4: το κέλυφος ΔΕΝ κατάπιε το geo-canvas (θα ήταν σιωπηλή ένωση)', () => {
    expect(shell['geo-canvas']).toBeUndefined();
    // …και το slice είναι κλάσμα του πλήρους locale — αλλιώς δεν κερδίσαμε τίποτα.
    const rel = RS.sliceFileFor({ outputDir: 'src/i18n/generated' }, 'test-harness__listing-shapes', 'el');
    const sliceBytes = fs.statSync(path.join(REPO, rel)).size;
    const localeBytes = fs.statSync(path.join(REPO, 'src/i18n/locales/el/geo-canvas.json')).size;
    expect(sliceBytes).toBeLessThan(localeBytes / 5);
  });
});
