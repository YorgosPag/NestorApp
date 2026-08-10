/**
 * ADR-782 §17 — οι **πρώτες** άγκυρες του τρισδιάστατου υποβάθρου.
 *
 * 🔴 Μέχρι τις 2026-08-10 **κανένα** test δεν ανέφερε το `BasemapGroundLayer` (μετρημένο με grep).
 * Δηλαδή το «δουλεύει» δεν είχε αποδειχθεί ποτέ — και δεν δούλευε: η σκηνή είναι on-demand, τα
 * πλακίδια έρχονται από το δίκτυο **μετά** το πρώτο καρέ, και το στρώμα δεν ζητούσε δεύτερο.
 * Ήταν το **μόνο** σκηνικό στρώμα χωρίς `markDirty` και το **μόνο** με ασύγχρονο πόρο.
 *
 * ## Τι κλειδώνει εδώ, και τι όχι
 * Κλειδώνεται ο **κύκλος ειδοποίησης**: εγγραφή στην κατασκευή, αίτημα καρέ σε αλλαγή, παύση στο
 * `dispose()`. **ΔΕΝ** κλειδώνεται η ζωγραφική (θέλει WebGL) — αυτό είναι δηλωμένο όριο, όχι
 * παράλειψη: η κλάση της βλάβης ήταν «δεν ζητήθηκε καρέ», όχι «ζωγραφίστηκε λάθος».
 *
 * ⚠️ Η οδήγηση γίνεται μέσα από τα **πραγματικά** stores του υποβάθρου, όχι με mock της εγγραφής:
 * ένα mock θα απεδείκνυε ότι το στρώμα καλεί ό,τι του είπαμε να καλεί — ταυτολογία. Έτσι όπως
 * είναι, η αλυσίδα «store → `subscribeBasemapPaint` → `requestRedraw`» ελέγχεται ολόκληρη.
 */

import * as THREE from 'three';
import { BasemapGroundLayer } from '../BasemapGroundLayer';
import { resetBasemapStore, setBasemapEnabled } from '../../../../systems/basemap/basemap-store';
import { setApproximateAnchor } from '../../../../systems/basemap/basemap-availability';
import { resetBasemapAttributionSurfaces } from '../../../../systems/basemap/basemap-attribution-surface';

/** Καμβάς με ύψος — το jsdom δίνει `clientHeight === 0`, που θα έκρυβε κάθε υπολογισμό κλίμακας. */
function fakeCanvas(heightPx = 800): HTMLElement {
  return { clientHeight: heightPx, clientWidth: 1200 } as HTMLElement;
}

function buildLayer(requestRedraw: () => void): BasemapGroundLayer {
  return new BasemapGroundLayer(
    new THREE.Group(),
    () => new THREE.PerspectiveCamera(50, 1.5, 0.1, 5000),
    () => new THREE.Vector3(0, 0, 0),
    () => fakeCanvas(),
    requestRedraw,
  );
}

beforeEach(() => {
  resetBasemapStore();
  setApproximateAnchor(null);
  resetBasemapAttributionSurfaces();
});

describe('BasemapGroundLayer — ο κύκλος ειδοποίησης σε σκηνή on-demand (ADR-782 §17)', () => {
  it('🎯 Γ1: αλλαγή στο υπόβαθρο ΖΗΤΑΕΙ καρέ — χωρίς αυτό ο χάρτης δεν εμφανίζεται ποτέ', () => {
    const requestRedraw = jest.fn();
    const layer = buildLayer(requestRedraw);

    setBasemapEnabled(true);

    expect(requestRedraw).toHaveBeenCalled();
    layer.dispose();
  });

  it('🎯 Γ2: μετά το dispose ΔΕΝ ζητά άλλο καρέ — αλλιώς ξεχασμένος ακροατής ξυπνά νεκρή σκηνή', () => {
    const requestRedraw = jest.fn();
    const layer = buildLayer(requestRedraw);

    layer.dispose();
    requestRedraw.mockClear();
    setBasemapEnabled(true);

    expect(requestRedraw).not.toHaveBeenCalled();
  });

  it('Γ3: η κατασκευή από μόνη της δεν ζητά καρέ — το καρέ το ζητά η ΑΛΛΑΓΗ', () => {
    const requestRedraw = jest.fn();
    const layer = buildLayer(requestRedraw);

    expect(requestRedraw).not.toHaveBeenCalled();
    layer.dispose();
  });
});

/**
 * 🎯 Γ4 — το κενό της ΟΡΘΟΓΡΑΦΙΚΗΣ κάμερας, κλειδωμένο στην πηγή.
 *
 * Το `getPixelWorldSize` είναι SSoT και έχει **δικές του** άγκυρες και για τις δύο κάμερες
 * (`coordinate-transforms.test.ts`: «ortho: visible frustum height ÷ pixels, independent of
 * distance»). Το στρώμα είχε **αντίγραφο** του υπολογισμού με το σκέλος ortho να λείπει, οπότε σε
 * κάτοψη/όψεις/κανονικές γωνίες το υπόβαθρο έσβηνε **σιωπηλά**.
 *
 * Η άγκυρα είναι στην **πηγή** και όχι στη συμπεριφορά, με τον ίδιο λόγο που το `Α6` του
 * `basemap-attribution.test.ts` διαβάζει τα αρχεία των ζωγράφων: το ερώτημα δεν είναι «βγάζει
 * σωστό νούμερο;» — αυτό το απαντά ήδη ο SSoT — αλλά «**ρωτάει τον SSoT ή ξαναγράφει την
 * ερώτηση;**». Ένας δεύτερος υπολογισμός θα ήταν σωστός τη μέρα που γράφτηκε και θα απέκλινε την
 * επόμενη φορά που θα προστεθεί τύπος κάμερας.
 */
describe('BasemapGroundLayer — καμία δεύτερη μηχανή κλίμακας (N.18 / CHECK 3.28)', () => {
  const raw = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'BasemapGroundLayer.ts'),
    'utf8',
  ) as string;

  /**
   * ⚠️ Τα σχόλια αφαιρούνται, και ο λόγος είναι μάθημα άλλης πύλης (CHECK 3.50 άγκυρα `Κ7β`): η
   * επικεφαλίδα του αρχείου **τεκμηριώνει** το σφάλμα που διορθώθηκε, οπότε αναφέρει
   * ονομαστικά το παλιό λεξιλόγιο. Χωρίς την αφαίρεση, *ένα σχόλιο που εξηγεί τη βλάβη θα
   * μετριόταν ως η βλάβη* — και η μόνη «διόρθωση» θα ήταν να σβηστεί η εξήγηση.
   */
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('🎯 Γ4: ρωτά τον SSoT `getPixelWorldSize` αντί να ξαναγράφει τον υπολογισμό', () => {
    expect(source).toContain('getPixelWorldSize');
  });

  it('🎯 Γ5: δεν διακλαδίζει σε τύπο κάμερας — εκεί ζούσε το χαμένο σκέλος ortho', () => {
    expect(source).not.toContain('PerspectiveCamera');
    expect(source).not.toContain('camera.fov');
  });
});
