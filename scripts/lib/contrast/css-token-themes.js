/**
 * Reads the design-token declarations out of `src/app/globals.css`.
 *
 * Answers exactly three questions and refuses to guess beyond them:
 *   1. What is every token's literal HSL value in `:root` (light) and `.dark`?
 *   2. Which selectors RE-POINT a token away from its theme value (scoped overrides)?
 *   3. Which of those tokens are painted as a SURFACE (i.e. can sit behind text)?
 *
 * ⚠️ A token whose value is `var(--other)` is NOT resolved here — it is reported as
 * `indirect`. Silently resolving one level would create the illusion of resolving all
 * of them; the caller must decide what an indirect token means for its question.
 */

'use strict';

const fs = require('fs');
const { parseHslToken } = require('./wcag-contrast');

const GLOBALS_CSS = 'src/app/globals.css';

/**
 * Token roles that are painted BEHIND text somewhere in this app.
 * Derived by reading globals.css, not guessed: every `--bg-*` is a surface by name,
 * and the shadcn core surfaces are the classic six.
 */
const SURFACE_TOKEN_PATTERN =
  /^--(background|card|popover|muted|secondary|accent|primary|destructive|bg-[a-z-]+|sidebar(-background)?)$/;

/**
 * Split a CSS file into `{ selector, body }` blocks at brace depth 1 or 2 (@layer-aware).
 *
 * ⚠️ Comments are stripped FIRST, on purpose. `globals.css:55` contains the literal text
 * `COLOR_BRIDGE.bg.{success,error,warning,info,purple}Solid` inside a comment — brace-naive
 * splitting tore the whole `:root` block in half there and silently returned ZERO light-theme
 * tokens. A CSS comment may contain any character; it is not CSS until it is removed.
 */
function extractRuleBlocks(css) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let m;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim().split('\n').map((s) => s.trim()).filter(Boolean).pop() || '';
    if (selector.startsWith('@')) continue;
    blocks.push({ selector, body: m[2] });
  }
  return blocks;
}

/** Pull `--name: value;` declarations out of a rule body, comments stripped. */
function extractCustomProps(body) {
  const props = new Map();
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    props.set(m[1], m[2].trim());
  }
  return props;
}

/** Merge every block matching `selectorTest` into one token map (later wins, as CSS does). */
function collectTheme(blocks, selectorTest) {
  const tokens = new Map();
  for (const { selector, body } of blocks) {
    if (!selectorTest(selector)) continue;
    for (const [name, value] of extractCustomProps(body)) tokens.set(name, value);
  }
  return tokens;
}

/**
 * Selectors that re-point `--primary` (or any watched token) for their subtree.
 * These are the ONLY places where `text-primary` can mean something other than the theme value.
 */
function findScopedOverrides(blocks, tokenName) {
  return blocks
    .filter(({ selector }) => selector !== ':root' && selector !== '.dark' && !selector.includes('*'))
    .filter(({ body }) => extractCustomProps(body).has(tokenName))
    .map(({ selector, body }) => ({
      selector,
      value: extractCustomProps(body).get(tokenName),
      cssClass: (selector.match(/\.([a-z0-9-]+)/i) || [])[1] || null,
    }));
}

/** Classify a raw token value: literal HSL, `var(--x)` indirection, or something else. */
function describeValue(value) {
  const hsl = parseHslToken(value);
  if (hsl) return { kind: 'literal', hsl };
  const indirect = /^var\((--[a-z0-9-]+)\)$/i.exec(value);
  if (indirect) return { kind: 'indirect', points_at: indirect[1] };
  return { kind: 'unparsed', raw: value };
}

/** Read globals.css and return both themes plus every scoped override of `--primary`. */
function readThemes(repoRoot = process.cwd()) {
  const css = fs.readFileSync(`${repoRoot}/${GLOBALS_CSS}`, 'utf8');
  const blocks = extractRuleBlocks(css);
  return {
    source: GLOBALS_CSS,
    light: collectTheme(blocks, (s) => s === ':root'),
    dark: collectTheme(blocks, (s) => s === '.dark'),
    primaryOverrides: findScopedOverrides(blocks, '--primary'),
  };
}

/** The subset of a theme's tokens that can legitimately sit behind text. */
function surfaceTokens(theme) {
  return tokensMatching(theme, SURFACE_TOKEN_PATTERN);
}

/**
 * Token roles that are painted ON TOP of a surface (text, icons, labels).
 *
 * Needed by CHECK 3.39 to judge a HARDCODED surface: a fixed `#ffffff` background is a
 * light island in the dark theme, and the thing that becomes unreadable on it is the
 * *themed* foreground the app puts there. Asking only "is this surface fixed?" cannot
 * express that; asking "does the verdict against `--foreground` flip between themes?" can.
 */
const FOREGROUND_TOKEN_PATTERN = /^--([a-z-]*foreground|text-[a-z-]+)$/;

/** The subset of a theme's tokens that are painted on top of a surface. */
function foregroundTokens(theme) {
  return tokensMatching(theme, FOREGROUND_TOKEN_PATTERN);
}

/** Shared filter: named tokens whose value parses to a literal HSL triple. */
function tokensMatching(theme, pattern) {
  const out = [];
  for (const [name, value] of theme) {
    if (!pattern.test(name)) continue;
    const described = describeValue(value);
    if (described.kind !== 'literal') continue;
    out.push({ name, value, hsl: described.hsl });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  readThemes,
  surfaceTokens,
  foregroundTokens,
  describeValue,
  SURFACE_TOKEN_PATTERN,
  FOREGROUND_TOKEN_PATTERN,
  GLOBALS_CSS,
};
