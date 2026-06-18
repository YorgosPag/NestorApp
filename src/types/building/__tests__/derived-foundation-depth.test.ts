/**
 * ADR-488 §6.2 — Δυναμικό βάθος θεμελίωσης (pure engine) tests.
 *
 * Επαληθεύει: thickness-driven, όρος συνδετήριας, όρος εδαφόπλακας, γεωτεχνικό ελάχιστο,
 * module στρογγυλοποίηση, seed bootstrap, μη-κυκλικότητα (το input ΔΕΝ έχει elevation).
 */

import {
  resolveDerivedFoundationDepthMm,
  seedDerivedFoundationDepthMm,
  FOUNDATION_FROST_MIN_MM,
  DEFAULT_TIE_BEAM_RISE_MM,
  FOUNDATION_SOIL_COVER_MM,
} from '../derived-foundation-depth';

describe('resolveDerivedFoundationDepthMm (ADR-488 §6.2)', () => {
  it('seed (τυπικό πέδιλο 500 + συνδετήριες + κάλυψη) = 1200mm', () => {
    expect(seedDerivedFoundationDepthMm()).toBe(1200);
    // 500 (pad) + 500 (tie rise) + 200 (cover) = 1200
    expect(DEFAULT_TIE_BEAM_RISE_MM + FOUNDATION_SOIL_COVER_MM + 500).toBe(1200);
  });

  it('thickness-driven: παχύτερο πέδιλο → βαθύτερη θεμελίωση', () => {
    const thin = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [500], hasTieBeam: false });
    const thick = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [1000], hasTieBeam: false });
    expect(thick).toBeGreaterThan(thin);
    // max(1000 + 0 + 200, frost 800) = 1200
    expect(thick).toBe(1200);
  });

  it('μέγιστο πάχος μεταξύ πολλών πεδίλων οδηγεί', () => {
    const d = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [400, 900, 500], hasTieBeam: false });
    expect(d).toBe(1100); // 900 + 200 cover
  });

  it('όρος συνδετήριας προστίθεται πάνω από το πέδιλο (πάνω από το frost floor)', () => {
    // Παχύ πέδιλο (800) ώστε ΚΑΙ τα δύο σκέλη να ξεπερνούν το frost min → η διαφορά = tie rise.
    const withTie = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [800], hasTieBeam: true });
    const noTie = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [800], hasTieBeam: false });
    expect(withTie - noTie).toBe(DEFAULT_TIE_BEAM_RISE_MM);
  });

  it('όρος εδαφόπλακας μετράει όταν είναι ο βαθύτερος', () => {
    const d = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [300], hasTieBeam: false, groundSlabThicknessMm: 1200 });
    expect(d).toBe(1400); // 1200 slab + 200 cover > 300+200 & > frost 800
  });

  it('γεωτεχνικό ελάχιστο (frost) ως κάτω όριο σε ρηχά στοιχεία', () => {
    const d = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [300], hasTieBeam: false });
    expect(d).toBe(FOUNDATION_FROST_MIN_MM); // 300+200=500 < 800 → frost
  });

  it('κενά πέδιλα → πέφτει στο seed πάχος (bootstrap)', () => {
    const d = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [], hasTieBeam: false });
    expect(d).toBe(FOUNDATION_FROST_MIN_MM); // assumed 500 + 200 = 700 < 800 → frost
  });

  it('στρογγυλοποίηση ΠΡΟΣ ΤΑ ΠΑΝΩ σε module 50mm', () => {
    const d = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [530], hasTieBeam: false });
    expect(d % 50).toBe(0);
    expect(d).toBe(800); // 530+200=730 < frost 800
    const d2 = resolveDerivedFoundationDepthMm({ footingThicknessesMm: [680], hasTieBeam: false });
    expect(d2).toBe(900); // 680+200=880 → ceil to 900
  });
});
