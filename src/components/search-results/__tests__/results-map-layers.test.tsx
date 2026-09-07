/**
 * @fileoverview ΑΓΚΥΡΕΣ ΣΤΟ ΣΥΝΟΡΟ ΜΕ ΤΟ MapLibre — **τι ΔΗΛΩΝΕΙ ο ζωγράφος**.
 * @related ADR-777 §8.63 · §8.64 · components/search-results/ResultsMapLayers.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΔΥΟ ΖΩΝΤΑΝΑ ΕΛΑΤΤΩΜΑΤΑ ΜΕ 32/32 ΜΕΤΑΛΛΑΞΕΙΣ ΠΡΑΣΙΝΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στο Βήμα 3, με **όλες** τις πύλες πράσινες, η οθόνη αποκάλυψε ότι η εξαγωγή των
 * `<Layer>` σε δικό τους συστατικό τα έβγαλε από **άμεσα παιδιά** του `<Source>` και
 * τους αφαίρεσε την πηγή: **8 σφάλματα κονσόλας** και **κανένα σχήμα αγγελίας** στον
 * χάρτη — ενώ οι πινακίδες τιμών ζωγραφίζονταν κανονικά, άρα **η οθόνη έμοιαζε
 * σωστή**. Το συμπέρασμα ήταν *«καμία σουίτα δεν αποδίδει MapLibre»*.
 *
 * 🔑 **Αυτό είναι αλήθεια — και δεν είναι δικαιολογία.** Δεν αποδίδουμε MapLibre·
 * **διαβάζουμε τη δήλωση** που του δίνουμε. Το συστατικό είναι καθαρή συνάρτηση από
 * ιδιότητες σε δέντρο στοιχείων: καλείται απευθείας, χωρίς χάρτη, και το δέντρο
 * επιθεωρείται. Ό,τι έλειπε τότε — το `source` — **δεν μπορεί να ξαναλείψει σιωπηλά**.
 *
 * ⚠️ **Τι ΔΕΝ αποδεικνύει**: ότι το MapLibre αποδίδει σωστά αυτό που του δηλώνουμε.
 * Αυτό μένει δουλειά της **οθόνης**, και η οθόνη παραμένει η αυθεντία.
 */

import React from 'react';

import { RADIUS, ResultsMapLayers, UNCERTAINTY_PX_LIMITS } from '../ResultsMapLayers';

// Το σύνορο αντικαθίσταται με σκέτο host component: μας ενδιαφέρει **η δήλωση**, όχι
// η βιβλιοθήκη. Έτσι η σουίτα δεν σέρνει το `maplibre-gl` μέσα στο jsdom.
jest.mock('@/lib/maps/maplibre', () => ({ Layer: 'maplibre-layer' }));

const SOURCE_ID = 'test-source';

interface LayerDeclaration {
  readonly source?: string;
  readonly id?: string;
  readonly type?: string;
  readonly filter?: unknown;
  readonly paint?: Record<string, unknown>;
}

function declaredLayers(
  focus: { peeked: string | null; selected: string | null } = { peeked: null, selected: null }
): readonly LayerDeclaration[] {
  const tree = ResultsMapLayers({ sourceId: SOURCE_ID, mark: '#123456', surface: '#ffffff', focus });
  return React.Children.toArray(tree.props.children)
    .filter((child): child is React.ReactElement<LayerDeclaration> => React.isValidElement(child))
    .map((child) => child.props);
}

function layerById(id: string): LayerDeclaration {
  const found = declaredLayers().find((layer) => layer.id === id);
  if (!found) throw new Error(`δεν δηλώθηκε επίπεδο με id "${id}"`);
  return found;
}

/** Είναι αυτή η τιμή έκφραση **σταθερού μεγέθους στον κόσμο**; */
function isMetricExpression(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value[0] === 'interpolate' &&
    JSON.stringify(value[2]) === JSON.stringify(['zoom'])
  );
}

// ============================================================================
// Κ1 — ΤΟ `source` ΔΙΝΕΤΑΙ ΡΗΤΑ  🔴 ΤΟ ΖΩΝΤΑΝΟ ΕΛΑΤΤΩΜΑ ΤΟΥ ΒΗΜΑΤΟΣ 3
// ============================================================================

describe('Κ1 — κάθε επίπεδο ξέρει την πηγή του', () => {
  it('κανένα επίπεδο δεν αφήνει το source να συναχθεί από τη δομή του δέντρου', () => {
    const layers = declaredLayers();
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) {
      expect(layer.source).toBe(SOURCE_ID);
    }
  });

  it('κάθε επίπεδο έχει ταυτότητα, και οι ταυτότητες είναι μοναδικές', () => {
    const ids = declaredLayers().map((layer) => layer.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================================================
// Κ2 — ΔΥΟ ΚΑΝΑΛΙΑ: Ο ΙΣΧΥΡΙΣΜΟΣ ΣΕ ΜΕΤΡΑ, ΤΟ ΣΗΜΑΔΙ ΣΕ PIXEL  🔴 ΚΡΙΣΙΜΗ
// ============================================================================

describe('Κ2 — η αβεβαιότητα μετριέται στον κόσμο, το σημάδι στην οθόνη', () => {
  it.each(['listing-city', 'listing-neighbourhood'])(
    'το "%s" ζωγραφίζεται σε ΜΕΤΡΑ, όχι σε σταθερά pixel',
    (id) => {
      const radius = layerById(id).paint?.['circle-radius'];
      expect(typeof radius).not.toBe('number');
      expect(isMetricExpression(radius)).toBe(true);
      // Ζητά τα πεδία του feature — αλλιώς κάθε αγγελία θα έπαιρνε την ίδια ακτίνα.
      expect(JSON.stringify(radius)).toContain('"uncertaintyM"');
      expect(JSON.stringify(radius)).toContain('"mercatorScale"');
    }
  );

  it.each(['listing-pin', 'listing-pin-ring'])(
    'το "%s" μένει ΣΗΜΑΔΙ σταθερού μεγέθους οθόνης',
    (id) => {
      // 🔑 Δεν είναι παράλειψη — είναι η διάκριση του Google Maps: η κουκκίδα έχει
      //    σταθερό μέγεθος οθόνης (για να είναι κλικαρίσιμη), ο κύκλος ακρίβειας
      //    σταθερό μέγεθος στον κόσμο (γιατί είναι ισχυρισμός γεωγραφίας).
      expect(typeof layerById(id).paint?.['circle-radius']).toBe('number');
    }
  );

  it('οι δύο κύκλοι αβεβαιότητας μοιράζονται ΤΗΝ ΙΔΙΑ έκφραση', () => {
    // Δύο κλήσεις με χωριστά ορίσματα θα ήταν δύο ευκαιρίες να αποκλίνουν.
    expect(JSON.stringify(layerById('listing-city').paint?.['circle-radius'])).toBe(
      JSON.stringify(layerById('listing-neighbourhood').paint?.['circle-radius'])
    );
  });

  it('το κατώφλι ορατότητας είναι ΜΕΓΑΛΥΤΕΡΟ από την πινέζα — η Α5 επιβιώνει στο ψαλίδι', () => {
    // Αλλιώς, σε ζουμ χώρας, η «κάπου στην πόλη» θα ήταν οπτικά **πινέζα**.
    expect(UNCERTAINTY_PX_LIMITS.min).toBeGreaterThan(RADIUS.pin);
    expect(UNCERTAINTY_PX_LIMITS.max).toBeGreaterThan(UNCERTAINTY_PX_LIMITS.min);
  });
});

// ============================================================================
// Κ3 — Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΒΑΨΙΜΟ
// ============================================================================

describe('Κ3 — οι σκιάσεις από κάτω, οι δακτύλιοι επισήμανσης από πάνω', () => {
  it('οι σκιασμένες περιοχές δηλώνονται ΠΡΙΝ από τις πινέζες', () => {
    const ids = declaredLayers().map((layer) => layer.id);
    expect(ids.indexOf('listing-city')).toBeLessThan(ids.indexOf('listing-pin'));
    expect(ids.indexOf('listing-neighbourhood')).toBeLessThan(ids.indexOf('listing-pin'));
  });

  it('οι δύο δακτύλιοι εστίασης δηλώνονται ΤΕΛΕΥΤΑΙΟΙ', () => {
    const ids = declaredLayers().map((layer) => layer.id);
    expect(ids.slice(-2)).toEqual(['listing-peek', 'listing-selected']);
  });

  it('η εστίαση φιλτράρει σε ΤΑΥΤΟΤΗΤΑ, και το «κανένα» δεν πιάνει τίποτα', () => {
    const layers = declaredLayers({ peeked: null, selected: 'prop_9' });
    const peek = layers.find((layer) => layer.id === 'listing-peek');
    const selected = layers.find((layer) => layer.id === 'listing-selected');

    // Το κενό αλφαριθμητικό — ποτέ NUL byte, ποτέ κενό διάστημα (ADR-777 §8.60).
    expect(peek?.filter).toEqual(['==', ['get', 'id'], '']);
    expect(selected?.filter).toEqual(['==', ['get', 'id'], 'prop_9']);
  });
});
