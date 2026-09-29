/**
 * CHECK 3.95 — Κ3: Η ΣΤΟΙΒΑ ΤΩΝ ΕΤΙΚΕΤΩΝ ΤΗΣ ΕΦΑΡΜΟΓΗΣ (ADR-891 §9.5)
 *
 * «Ζητά κάθε `symbol` layer που γράφει κείμενο (`text-field`) τη στοίβα του ΜΗΤΡΩΟΥ — ή αφήνει τη MapLibre
 * να ζητήσει μια που κανένας glyph server μας δεν σερβίρει;»
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ (μετρημένο 2026-09-28)**: η στρώση `listing-cluster-count` δεν είχε `text-font` ⇒ η MapLibre
 * ζήτησε την προεπιλογή `Open Sans Regular,Arial Unicode MS Regular` ⇒ **404** από τον διακομιστή μας, 2 ανά προβολή.
 * Οι αριθμοί φαίνονταν **μόνο** επειδή η MapLibre 5.15 ζωγραφίζει τοπικά (TinySDF) όταν αποτύχει εύρος — δηλαδή με
 * τη γραμματοσειρά του **browser**. Πράσινο που σήμαινε «δεν κοίταξα».
 *
 * 🔑 **ΤΟ ΜΗΤΡΩΟ ΑΠΑΝΤΑ, Η ΠΥΛΗ ΡΩΤΑ ΤΟ ΟΝΟΜΑ.** Η τιμή του `text-font` πρέπει να είναι το αναγνωριστικό
 * `BASEMAP_OVERLAY_TEXT_FONT`. Ότι η στοίβα **σερβίρεται** από κάθε glyph server και **καλύπτει** κάθε σύμβολο, το
 * αποδεικνύει η δίδυμη άγκυρα `src/lib/maps/__tests__/overlay-glyph-coverage.test.ts` — εδώ δεν ξαναγράφεται.
 *
 * ⚠️ **`layout` που δεν είναι κυριολεκτικό αντικείμενο = εύρημα**: η πύλη δεν μαντεύει τι έχει μια μεταβλητή.
 * Στρώση `symbol` **μόνο με εικονίδιο** (χωρίς `text-field`) δεν ζητά γραμματοσειρά και δεν κρίνεται.
 *
 * @module scripts/lib/basemap-sources/symbol-fonts
 */

'use strict';

const ts = require('typescript');

const { OVERLAY_TEXT_FONT_NAME } = require('./contract.js');

/** Όνομα ιδιότητας αντικειμένου ή χαρακτηριστικού JSX (`'text-font'`, `layout`, `type`). */
function nameOf(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function unwrap(expression) {
  let node = expression;
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))) {
    node = node.expression;
  }
  return node;
}

function isSymbolLiteral(expression) {
  const node = unwrap(expression);
  return Boolean(node) && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text === 'symbol';
}

/** `BASEMAP_OVERLAY_TEXT_FONT` ή `x.BASEMAP_OVERLAY_TEXT_FONT`. */
function isCatalogFont(expression) {
  const node = unwrap(expression);
  if (!node) return false;
  if (ts.isIdentifier(node)) return node.text === OVERLAY_TEXT_FONT_NAME;
  return ts.isPropertyAccessExpression(node) && node.name.text === OVERLAY_TEXT_FONT_NAME;
}

function propertyOf(objectLiteral, name) {
  return objectLiteral.properties.find((p) => ts.isPropertyAssignment(p) && nameOf(p.name) === name);
}

/** Η κρίση ενός `layout` — `null` όταν είναι εντάξει. */
function judgeLayout(layoutExpression) {
  const layout = unwrap(layoutExpression);
  if (!layout || !ts.isObjectLiteralExpression(layout)) {
    return 'το `layout` δεν είναι κυριολεκτικό αντικείμενο — η πύλη δεν μπορεί να δει αν ζητά γραμματοσειρά';
  }
  if (!propertyOf(layout, 'text-field')) return null;
  const font = propertyOf(layout, 'text-font');
  if (!font) return '`text-field` χωρίς `text-font` ⇒ η MapLibre ζητά στοίβα που δεν σερβίρεται (404 + γραμματοσειρά browser)';
  if (!isCatalogFont(font.initializer)) return `\`text-font\` που δεν είναι το \`${OVERLAY_TEXT_FONT_NAME}\` του μητρώου`;
  return null;
}

/** `<Layer type="symbol" layout={…}>` → το `layout`, ή `undefined` αν δεν είναι στρώση symbol. */
function jsxSymbolLayout(node) {
  const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
  const typeAttr = attributes.find((a) => nameOf(a.name) === 'type');
  if (!typeAttr || !typeAttr.initializer) return undefined;
  const typeValue = ts.isJsxExpression(typeAttr.initializer) ? typeAttr.initializer.expression : typeAttr.initializer;
  if (!isSymbolLiteral(typeValue)) return undefined;
  const layoutAttr = attributes.find((a) => nameOf(a.name) === 'layout');
  if (!layoutAttr) return null; // symbol χωρίς layout ⇒ χωρίς κείμενο
  return layoutAttr.initializer && ts.isJsxExpression(layoutAttr.initializer) ? layoutAttr.initializer.expression : layoutAttr.initializer;
}

/** `{ type: 'symbol', layout: {…} }` → το `layout`, ή `undefined` αν δεν είναι στρώση symbol. */
function objectSymbolLayout(node) {
  const type = propertyOf(node, 'type');
  if (!type || !isSymbolLiteral(type.initializer)) return undefined;
  const layout = propertyOf(node, 'layout');
  return layout ? layout.initializer : null;
}

/**
 * Κάθε στρώση `symbol` του αρχείου και η κρίση της.
 * @returns {{ layers: number, findings: Array<{ line: number, why: string }> }}
 */
function judgeSymbolFonts(fileName, text) {
  if (!/['"`]symbol['"`]/.test(text)) return { layers: 0, findings: [] };
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const findings = [];
  let layers = 0;
  const visit = (node) => {
    let layout;
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) layout = jsxSymbolLayout(node);
    else if (ts.isObjectLiteralExpression(node)) layout = objectSymbolLayout(node);
    if (layout !== undefined) {
      layers += 1;
      const why = layout === null ? null : judgeLayout(layout);
      if (why) findings.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, why });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { layers, findings };
}

module.exports = { judgeSymbolFonts };
