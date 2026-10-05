/**
 * ADR-899 §9 θέμα 8 — η μορφή μιας σκηνής αποφασίζεται από τα bytes, όχι από το `ext`.
 *
 * Μετάλλαξη που πρέπει να πιάσει: η ταξινόμηση απαντά πάντα `dxf` (= η συμπεριφορά πριν: JSON στον αναλυτή DXF).
 */

import { classifyScenePayloadHead } from '../scene-payload-kind';

describe('classifyScenePayloadHead', () => {
  it('🔴 η κεφαλή του `.scene.json` της παραγωγής είναι σκηνή, ΟΧΙ DXF', () => {
    expect(classifyScenePayloadHead('{"entities":[{"id":"line_0","type":"line","layerId":"lyr_cf8a0e3b"')).toBe('scene-json');
    expect(classifyScenePayloadHead('  \n{ "entities": [] }')).toBe('scene-json');
  });

  it('ASCII DXF: πρώτη γραμμή = κωδικός ομάδας (LF, CRLF, αρχικά κενά, σχόλιο 999)', () => {
    expect(classifyScenePayloadHead('0\nSECTION\n2\nHEADER\n')).toBe('dxf');
    expect(classifyScenePayloadHead('  0\r\nSECTION\r\n  2\r\nENTITIES\r\n')).toBe('dxf');
    expect(classifyScenePayloadHead('999\nDXF created by a tool\n0\nSECTION\n')).toBe('dxf');
  });

  it('BOM και κεφαλή UTF-16 (NUL ανά δεύτερο byte) δεν αλλάζουν την απάντηση', () => {
    expect(classifyScenePayloadHead('﻿0\nSECTION\n')).toBe('dxf');
    expect(classifyScenePayloadHead('0\u0000\r\u0000\n\u0000S\u0000E\u0000C\u0000')).toBe('dxf');
    expect(classifyScenePayloadHead('﻿{"entities":[]}')).toBe('scene-json');
  });

  it('δυαδικό DXF αναγνωρίζεται από τη σφραγίδα του', () => {
    expect(classifyScenePayloadHead('AutoCAD Binary DXF\r\n\u001a\u0000')).toBe('dxf');
  });

  it('🔴 ό,τι δεν είναι ούτε σκηνή ούτε DXF είναι `unknown` — ποτέ μαντεψιά', () => {
    expect(classifyScenePayloadHead('<!DOCTYPE html><html>')).toBe('unknown');
    expect(classifyScenePayloadHead('%PDF-1.7')).toBe('unknown');
    expect(classifyScenePayloadHead('[1,2,3]')).toBe('unknown');
    expect(classifyScenePayloadHead('SECTION\n0\n')).toBe('unknown');
    expect(classifyScenePayloadHead('')).toBe('unknown');
  });
});
