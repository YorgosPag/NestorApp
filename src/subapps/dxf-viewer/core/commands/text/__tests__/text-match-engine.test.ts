/**
 * ADR-344 Phase 6.A — Tests for the find/replace match engine.
 */

import { describe, it, expect } from '@jest/globals';
import { findMatches, replaceAll, replaceAt } from '../text-match-engine';
import { makeNode, makeParagraph, makeRun } from './test-fixtures';

const PLAIN_OPTS = { caseSensitive: false, wholeWord: false, regex: false };

describe('findMatches', () => {
  it('returns [] for an empty pattern', () => {
    const node = makeNode();
    expect(findMatches(node, '', PLAIN_OPTS)).toEqual([]);
  });

  it('finds every occurrence across runs and paragraphs', () => {
    const node = makeNode({
      paragraphs: [
        makeParagraph([makeRun('foo bar foo')]),
        makeParagraph([makeRun('baz foo')]),
      ],
    });
    const matches = findMatches(node, 'foo', PLAIN_OPTS);
    expect(matches).toHaveLength(3);
  });

  it('respects case-sensitive mode', () => {
    const node = makeNode({ paragraphs: [makeParagraph([makeRun('Foo foo')])] });
    expect(findMatches(node, 'foo', { ...PLAIN_OPTS, caseSensitive: true })).toHaveLength(1);
    expect(findMatches(node, 'foo', PLAIN_OPTS)).toHaveLength(2);
  });

  it('respects whole-word mode', () => {
    const node = makeNode({ paragraphs: [makeParagraph([makeRun('cat catalog')])] });
    expect(findMatches(node, 'cat', { ...PLAIN_OPTS, wholeWord: true })).toHaveLength(1);
    expect(findMatches(node, 'cat', PLAIN_OPTS)).toHaveLength(2);
  });

  it('uses regex mode when enabled', () => {
    const node = makeNode({ paragraphs: [makeParagraph([makeRun('a1 b22 c333')])] });
    const matches = findMatches(node, '\\d+', { ...PLAIN_OPTS, regex: true });
    expect(matches).toHaveLength(3);
  });
});

describe('replaceAll', () => {
  it('returns the original node when no match is found', () => {
    const node = makeNode();
    const out = replaceAll(node, 'nope', 'X', PLAIN_OPTS);
    expect(out.count).toBe(0);
    expect(out.node).toBe(node);
  });

  it('replaces every occurrence and reports the count', () => {
    const node = makeNode({
      paragraphs: [makeParagraph([makeRun('foo bar foo')])],
    });
    const out = replaceAll(node, 'foo', 'X', PLAIN_OPTS);
    expect(out.count).toBe(2);
    const run0 = out.node.paragraphs[0].runs[0] as { text: string };
    expect(run0.text).toBe('X bar X');
  });

  it('does not mutate the input node', () => {
    const node = makeNode({ paragraphs: [makeParagraph([makeRun('foo')])] });
    replaceAll(node, 'foo', 'X', PLAIN_OPTS);
    const run0 = node.paragraphs[0].runs[0] as { text: string };
    expect(run0.text).toBe('foo');
  });
});

describe('replaceAt', () => {
  it('replaces a single match at the requested location', () => {
    const node = makeNode({ paragraphs: [makeParagraph([makeRun('hello world')])] });
    const out = replaceAt(node, { paragraphIndex: 0, runIndex: 0, start: 6, end: 11 }, 'Giorgio');
    expect(out.replaced).toBe(true);
    const run0 = out.node.paragraphs[0].runs[0] as { text: string };
    expect(run0.text).toBe('hello Giorgio');
  });

  it('returns replaced=false for an invalid range', () => {
    const node = makeNode({ paragraphs: [makeParagraph([makeRun('hi')])] });
    const out = replaceAt(node, { paragraphIndex: 0, runIndex: 0, start: 5, end: 10 }, 'x');
    expect(out.replaced).toBe(false);
    expect(out.node).toBe(node);
  });

  it('returns replaced=false when the paragraph index is out of range', () => {
    const node = makeNode();
    const out = replaceAt(node, { paragraphIndex: 99, runIndex: 0, start: 0, end: 1 }, 'x');
    expect(out.replaced).toBe(false);
  });
});
