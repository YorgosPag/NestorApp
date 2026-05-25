/**
 * ADR-366 §C.1.b — SceneBboxProvider tests.
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  clearSceneBboxGetter,
  getSceneBbox,
  setSceneBboxGetter,
} from '../SceneBboxProvider';

afterEach(() => {
  clearSceneBboxGetter();
});

describe('SceneBboxProvider — registration lifecycle', () => {
  it('επιστρέφει null όταν δεν έχει registered getter', () => {
    expect(getSceneBbox()).toBeNull();
  });

  it('clearSceneBboxGetter επαναφέρει το state σε unregistered', () => {
    setSceneBboxGetter(() => new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)));
    expect(getSceneBbox()).not.toBeNull();
    clearSceneBboxGetter();
    expect(getSceneBbox()).toBeNull();
  });
});

describe('SceneBboxProvider — bbox conversion', () => {
  it('μετατρέπει Box3 σε SceneBbox με σωστά min/max coords', () => {
    const box = new THREE.Box3(
      new THREE.Vector3(-5, -10, -15),
      new THREE.Vector3(20, 30, 40),
    );
    setSceneBboxGetter(() => box);
    const bbox = getSceneBbox();
    expect(bbox).toEqual({
      min: { x: -5, y: -10, z: -15 },
      max: { x: 20, y: 30, z: 40 },
    });
  });

  it('επιστρέφει null όταν ο getter δίνει null', () => {
    setSceneBboxGetter(() => null);
    expect(getSceneBbox()).toBeNull();
  });

  it('επιστρέφει null όταν το bbox είναι empty (isEmpty=true)', () => {
    const empty = new THREE.Box3();
    setSceneBboxGetter(() => empty);
    expect(getSceneBbox()).toBeNull();
  });

  it('κάθε call καλεί ξανά τον getter (no caching)', () => {
    let counter = 0;
    setSceneBboxGetter(() => {
      counter += 1;
      return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(counter, counter, counter));
    });
    const first = getSceneBbox();
    const second = getSceneBbox();
    expect(first?.max.x).toBe(1);
    expect(second?.max.x).toBe(2);
  });
});

describe('SceneBboxProvider — re-registration', () => {
  it('επανα-register αντικαθιστά τον προηγούμενο getter', () => {
    setSceneBboxGetter(() => new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)));
    setSceneBboxGetter(() => new THREE.Box3(new THREE.Vector3(10, 10, 10), new THREE.Vector3(20, 20, 20)));
    const bbox = getSceneBbox();
    expect(bbox?.min.x).toBe(10);
    expect(bbox?.max.x).toBe(20);
  });
});
