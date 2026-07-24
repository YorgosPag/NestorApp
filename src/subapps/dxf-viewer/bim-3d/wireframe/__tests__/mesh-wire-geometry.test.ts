/**
 * ADR-689 Φ3 — `getWireReadyGeometry`: **ΕΝΑ** παράγωγο buffer ανά asset, όχι ανά instance.
 *
 * Αυτό είναι το τεστ που φυλάει το κέρδος απόδοσης της Φ3. Ο `bimMeshCache` δίνει
 * `template.clone(true)`, οπότε 40 καρέκλες δείχνουν στην ίδια γεωμετρία· αν το cache αστοχούσε,
 * θα ξαναχτίζαμε 40 buffers — ακριβώς το πρόβλημα της Φ2 με άλλο όνομα.
 */

import * as THREE from 'three';
import { getWireReadyGeometry, hasWireCodes } from '../mesh-wire-geometry';
import { WIRE_CODE_ATTRIBUTE } from '../mesh-wire-encoding';
import { MESH_WIRE_FEATURE_ANGLE_DEG } from '../../../config/bim-visual-style';

const ANGLE = MESH_WIRE_FEATURE_ANGLE_DEG;

/** Non-indexed μονό τρίγωνο. */
function triangle(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  return geo;
}

describe('getWireReadyGeometry', () => {
  it('προσθέτει το aWireCode, ένα float ανά κορυφή', () => {
    const wire = getWireReadyGeometry(triangle(), 'feature', ANGLE)!;

    const codes = wire.getAttribute(WIRE_CODE_ATTRIBUTE);
    expect(codes.itemSize).toBe(1);
    expect(codes.count).toBe(3);
    expect(hasWireCodes(wire)).toBe(true);
  });

  it('ΔΕΝ μολύνει την πηγή — το template μένει καθαρό για τα υπόλοιπα στυλ', () => {
    const source = triangle();

    getWireReadyGeometry(source, 'feature', ANGLE);

    expect(hasWireCodes(source)).toBe(false);
  });

  it('δεύτερη κλήση με ίδια πηγή+mode → ΤΟ ΙΔΙΟ αντικείμενο (το cache που κρατά τη Φ3 γρήγορη)', () => {
    const source = triangle();

    const first = getWireReadyGeometry(source, 'feature', ANGLE);
    const second = getWireReadyGeometry(source, 'feature', ANGLE);

    expect(second).toBe(first);
  });

  it('διαφορετικό mode → ξεχωριστή παραλλαγή, χωρίς να διώχνει την πρώτη', () => {
    const source = triangle();

    const feature = getWireReadyGeometry(source, 'feature', ANGLE);
    const full = getWireReadyGeometry(source, 'full', ANGLE);

    expect(full).not.toBe(feature);
    expect(getWireReadyGeometry(source, 'feature', ANGLE)).toBe(feature);
  });

  it('non-indexed πηγή → μοιράζεται τα attributes της (μηδενική αντιγραφή δεδομένων)', () => {
    const source = triangle();

    const wire = getWireReadyGeometry(source, 'feature', ANGLE)!;

    expect(wire).not.toBe(source);
    expect(wire.getAttribute('position')).toBe(source.getAttribute('position'));
  });

  it('indexed πηγή → ξεδιπλώνεται σε non-indexed (η βαρυκεντρική τεχνική το απαιτεί)', () => {
    const source = new THREE.BoxGeometry(1, 1, 1);
    expect(source.getIndex()).not.toBeNull();

    const wire = getWireReadyGeometry(source, 'feature', ANGLE)!;

    expect(wire.getIndex()).toBeNull();
    expect(wire.getAttribute(WIRE_CODE_ATTRIBUTE).count).toBe(36);
  });

  it('κενή γεωμετρία → null (ο caller αφήνει το mesh ως έχει)', () => {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position', new THREE.Float32BufferAttribute([], 3));

    expect(getWireReadyGeometry(empty, 'feature', ANGLE)).toBeNull();
  });

  it('γεωμετρία χωρίς θέσεις → null αντί για εξαίρεση', () => {
    expect(getWireReadyGeometry(new THREE.BufferGeometry(), 'feature', ANGLE)).toBeNull();
  });
});
