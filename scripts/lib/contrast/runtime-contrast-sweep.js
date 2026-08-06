/**
 * ΕΠΙΠΕΔΟ 3 — ζωντανή μέτρηση αντίθεσης, μέσα στη σελίδα.
 *
 * ΔΕΝ τρέχει στο Node. Είναι απόσπασμα για την ΚΟΝΣΟΛΑ του φυλλομετρητή (ή για
 * `javascript_tool` μέσω Claude in Chrome). Επικολλάς ΟΛΟ το αρχείο μία φορά ανά καρτέλα:
 *
 *     __contrastSweep()        // → σύνοψη + οι χειρότερες γραμμές
 *     __contrastSweep().rows   // → κάθε αποτυχία, με αιτία
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ ΣΤΑΤΙΚΟ ΣΑΡΩΤΗ:
 * ο στατικός σαρωτής αποδεικνύει ΒΛΑΒΗ (ποια κλάση ζητά ποιο token), δεν αποδεικνύει ΥΓΕΙΑ —
 * το φόντο ενός στοιχείου είναι ερώτημα ΠΡΟΓΟΝΩΝ, δηλαδή runtime. Αυτό εδώ απαντά το
 * συμπληρωματικό ερώτημα: «τι ΔΕΝ ΒΛΕΠΕΙ ο μηχανικός σε ΑΥΤΗ την οθόνη, και γιατί».
 *
 * ⚠️ Μετρά ΟΤΙ βάφεται, όχι μόνο το `text-primary`. Αυτό είναι σκόπιμο: στην πρώτη εκτέλεση
 * (ADR-759 §4.12.1) αποδείχθηκε ότι το `text-primary` ήταν 1 στα 15 και 2 στα 13 των
 * πραγματικά αόρατων στοιχείων — ένα όργανο που κοίταζε μόνο το `text-primary` θα είχε
 * αναφέρει «βρήκα το πρόβλημα» ενώ έβλεπε το ένα έβδομο.
 *
 * Πρότυπα: WCAG 2.1 §1.4.3 (κείμενο ≥ 4.5:1) και §1.4.11 (εικονίδια/μη-κείμενο ≥ 3:1).
 * Κατώφλι αναφοράς: 3.0 — κάτω από αυτό δεν είναι «χαμηλή αντίθεση», είναι αόρατο.
 */

/* eslint-env browser */
/* global window */

(function installContrastSweep() {
  'use strict';

  const REPORT_BELOW = 3.0;

  const parseColor = (css) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(css || '');
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };

  const luminance = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const ratio = (x, y) => {
    const a = luminance(x), b = luminance(y);
    const [hi, lo] = a >= b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  };

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  /**
   * Το ΠΡΑΓΜΑΤΙΚΟ φόντο: ανεβαίνει τους προγόνους μαζεύοντας ΚΑΘΕ ημιδιαφανές στρώμα και
   * τα συνθέτει, μέχρι το πρώτο αδιαφανές. Το να σταματήσει κανείς στο πρώτο μη-διαφανές
   * `backgroundColor` δίνει λάθος αριθμό όποτε υπάρχει `bg-primary/20` — που είναι ακριβώς
   * το σχήμα στο οποίο κρύβεται η βλάβη.
   */
  const effectiveBackground = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) { layers.push(bg); if (bg.a === 1) break; }
      node = node.parentElement;
    }
    if (layers.length === 0) return { rgb: { r: 255, g: 255, b: 255, a: 1 }, assumed: true };
    let acc = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) acc = over(layers[i], acc);
    return { rgb: acc, assumed: layers[layers.length - 1].a < 1 };
  };

  const paintsOwnText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  };

  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const classNameOf = (el) =>
    (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '');

  /**
   * Η ΑΙΤΙΑ — γιατί ένας αριθμός χωρίς αιτία δεν οδηγεί σε καμία απόφαση.
   * Η σειρά των ελέγχων είναι σημαντική: το inline style ΝΙΚΑΕΙ την κλάση, οπότε όταν
   * συνυπάρχουν, ο ένοχος είναι το inline (μετρημένο: επικεφαλίδα με σωστό `--text-success`
   * βαμμένη 1.01:1 από inline `color`).
   */
  const diagnose = (cls, styleAttr) => {
    if (/color\s*:/.test(styleAttr)) return 'inline-style (νικάει το token)';
    if (/(^|\s|:)text-primary(?![-\w])/.test(cls)) return 'text-primary (σύγκρουση token)';
    if (/text-(blue|gray|slate|zinc|green|red|amber|indigo|neutral|stone|orange|yellow)-\d/.test(cls)) {
      return 'σκληροκωδικοποιημένη κλίμακα Tailwind (χρώμα φωτεινού θέματος)';
    }
    return 'άλλο (css-module / κληρονομημένο)';
  };

  function sweep() {
    const rows = [];
    for (const el of document.querySelectorAll('body *')) {
      const isIcon = el.tagName.toLowerCase() === 'svg';
      if (!paintsOwnText(el) && !isIcon) continue;
      if (!isVisible(el)) continue;
      const fg = parseColor(getComputedStyle(el).color);
      if (!fg || fg.a === 0) continue;
      const { rgb: bg, assumed } = effectiveBackground(el);
      const composited = fg.a < 1 ? over(fg, bg) : fg;
      const cr = ratio(composited, bg);
      if (cr >= REPORT_BELOW) continue;
      const cls = classNameOf(el);
      rows.push({
        cause: diagnose(cls, el.getAttribute('style') || ''),
        ratio: +cr.toFixed(2),
        isIcon,
        text: (el.textContent || '').trim().slice(0, 40),
        cls: cls.slice(0, 70),
        color: `rgb(${[composited.r, composited.g, composited.b].map(Math.round)})`,
        bg: `rgb(${[bg.r, bg.g, bg.b].map(Math.round)})`,
        assumedBg: assumed,
      });
    }
    rows.sort((a, b) => a.ratio - b.ratio);
    const byCause = rows.reduce((acc, r) => { acc[r.cause] = (acc[r.cause] || 0) + 1; return acc; }, {});
    return {
      path: location.pathname,
      theme: document.documentElement.className.includes('dark') ? 'dark' : 'light',
      scanned: document.querySelectorAll('body *').length,
      failing: rows.length,
      icons: rows.filter((r) => r.isIcon).length,
      textNodes: rows.filter((r) => !r.isIcon).length,
      byCause,
      worst: rows.slice(0, 12),
      rows,
    };
  }

  /**
   * Η ΑΠΟΔΕΙΞΗ ΜΕ ΤΟ ΜΑΤΙ: βάφει κόκκινο ό,τι απέτυχε. Αν εμφανιστεί κείμενο εκεί που
   * έβλεπες κενό, το βρήκες. (Καθαρίζει με `__contrastSweep.unpaint()`.)
   */
  sweep.paint = () => {
    const touched = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!paintsOwnText(el) && el.tagName.toLowerCase() !== 'svg') continue;
      if (!isVisible(el)) continue;
      const fg = parseColor(getComputedStyle(el).color);
      if (!fg) continue;
      const { rgb: bg } = effectiveBackground(el);
      if (ratio(fg.a < 1 ? over(fg, bg) : fg, bg) >= REPORT_BELOW) continue;
      el.dataset.contrastPrev = el.style.color || '';
      el.style.color = 'red';
      touched.push(el);
    }
    return `βάφτηκαν ${touched.length}`;
  };

  sweep.unpaint = () => {
    for (const el of document.querySelectorAll('[data-contrast-prev]')) {
      el.style.color = el.dataset.contrastPrev;
      delete el.dataset.contrastPrev;
    }
    return 'καθαρό';
  };

  window.__contrastSweep = sweep;
  return 'installed ✓ — τρέξε __contrastSweep()';
})();
