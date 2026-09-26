/**
 * **Χωράει;** — οι δύο μετρήσεις του CHECK 3.94 (ADR-797 §Φ.Ρ), σε **ένα** πέρασμα με **ένα** σύνολο εξαιρέσεων.
 *
 *   1. `offscreen` — «βγαίνει κάποιο στοιχείο έξω από την **ΟΘΟΝΗ**;» (§Φ.Ρ.1)
 *   2. `clipped`   — «κόβει κάποιο κουτί ό,τι **ΒΛΕΠΕΙ ή ΠΑΤΑ** ο άνθρωπος μέσα του;» (§Φ.Ρ.3 · W3C ACT 59br37+)
 *
 * ⚠️ **ΤΡΕΧΕΙ ΜΕΣΑ ΣΤΟΝ BROWSER** (`page.evaluate`): καμία εισαγωγή, κανένα κλείσιμο πάνω σε
 * εξωτερικές μεταβλητές — ό,τι χρειάζεται έρχεται ως όρισμα. 🔑 **Γι' αυτό είναι ΜΙΑ συνάρτηση**:
 * δύο συναρτήσεις θα χρειάζονταν η καθεμία το δικό της αντίγραφο των εξαιρέσεων (το `evaluate`
 * σειριοποιεί μόνο το σώμα της). Οι βοηθοί ζουν ως κλεισίματα — δηλωμένη εξαίρεση του ορίου των
 * 40 γραμμών (N.7.1), με λόγο τον περιορισμό του `evaluate`, όχι γούστο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΧΙ `scrollWidth > clientWidth` — ΑΥΤΟ ΗΤΑΝ Ο ΔΕΙΚΤΗΣ ΠΟΥ ΕΛΕΓΕ ΨΕΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-09-25 στα 390 px: `document.documentElement.scrollWidth` = **390** — «καμία
 * υπερχείλιση» — ενώ **πέντε** μπλοκ έφταναν ως τα **436 px** και κόβονταν. Ο καθολικός κανόνας
 * `:where(header, main, section, .flex, .grid) { overflow-x: clip }` του `globals.css` ψαλιδίζει
 * ό,τι περισσεύει **χωρίς** να γεννά κύλιση. Και για τη **δεύτερη** ερώτηση το `scrollWidth` ενός
 * στοιχείου είναι επίσης λάθος όργανο: λέει «κάποιο παιδί περισσεύει», όχι «**χάνεται κάτι ορατό**»,
 * και δεν λέει **ποιος** ψαλιδίζει. Γι' αυτό μετράμε το **ίδιο το κείμενο** (`Range.getClientRects`)
 * έναντι του padding box του προγόνου που το ψαλιδίζει — το κριτήριο του W3C ACT 59br37 και του
 * `textClipped` του Apple XCUI (axe-core και Lighthouse δεν έχουν κανόνα· Chromatic/Percy συγκρίνουν pixel) —
 * **και** το περίγραμμα χειριστηρίων, γραφικών και κουτιών με ορατό όριο: το «περιεχόμενο **ή
 * λειτουργικότητα**» του WCAG 1.4.10, που το ACT (μόνο κείμενο) δεν πιάνει (§Φ.Ρ.3).
 *
 * ⛔ **ΔΕΝ ΕΞΑΙΡΕΙΤΑΙ ό,τι ψαλιδίζεται από πρόγονο με `clip`/`hidden`** — αυτή η εξαίρεση θα ήταν
 * ακριβώς το κάλυμμα που έκρυψε το ελάττωμα. Το **ΚΛΕΙΣΤΟ** σύνολο εξαιρέσεων, κοινό στις δύο:
 *   (α) απόγονοι **δηλωμένης** κύλισης (`overflow-x: auto | scroll`) — εκεί το «πέρα από την
 *       άκρη» είναι σχεδιασμός, και ο χρήστης το φτάνει σύροντας (λωρίδα καρτελών, πίνακες)·
 *   (β) απόγονοι ενός **κλειστού** συνόλου επιφανειών που τοποθετούν παιδιά έξω από το πλαίσιο
 *       **εκ κατασκευής** (χάρτες) — δηλωμένο στο spec με λόγο, ποτέ μαντεμένο εδώ·
 *   (γ) σκηνές **ολόκληρες** εκτός οθόνης που ο συγγραφέας δήλωσε `inert` + `aria-hidden` (βλ. παρακάτω)·
 *   (δ) αόρατα (μηδενικό κουτί · `visibility: hidden` · `sr-only` ≤ 1×1).
 * Και για τη δεύτερη ερώτηση:
 *   (ε) **δηλωμένη αποκοπή** (μόνο κείμενο) — ο πρόγονος που ψαλιδίζει έχει `text-overflow` ≠ `clip` **και**
 *       `white-space: nowrap` (το `truncate`), ή `-webkit-line-clamp`: ο συγγραφέας **είπε** «κόψε
 *       εδώ και δείξε ότι κόπηκε»· αυτό δεν είναι σιωπηλή απώλεια·
 *   (στ) το **κείμενο** πεδίων φόρμας (`input` · `textarea` · `select` · `option`) — κυλά μέσα στο πεδίο·
 *        το **ίδιο** το πεδίο ΜΕΤΡΑ·
 *   (ζ) πρόγονος `aria-hidden="true"` (ACT) — το φόντο ενός διαλόγου μετριέται στο δικό του test.
 * Ο ίδιος ο κυλιόμενος/χάρτης **ΜΕΤΡΑΕΙ**: αν η λωρίδα είναι φαρδύτερη από την οθόνη, είναι βλάβη.
 */

export interface OverflowOffender {
  readonly tag: string;
  /** Ό,τι ταυτοποιεί το στοιχείο χωρίς ονόματα κλάσεων: ρόλος · aria-label · id · κείμενο. */
  readonly label: string;
  readonly left: number;
  readonly right: number;
}

/**
 * Κάτι ορατό (κείμενο · χειριστήριο · γραφικό · κουτί με ορατό όριο) που κόβεται σιωπηλά από το κουτί
 * ενός προγόνου — αναφέρεται **ο πρόγονος που ψαλιδίζει**, γιατί εκεί ζει η απόφαση που πρέπει να αλλάξει.
 */
export interface ClippedContent {
  readonly clipTag: string;
  readonly clipLabel: string;
  /** Το πρώτο κομμένο πράγμα κάτω από αυτόν τον πρόγονο: `«κείμενο»` ή `<tag> ετικέτα`. */
  readonly what: string;
  /** Πόσα px λείπουν (το μεγαλύτερο κάτω από αυτόν τον πρόγονο). */
  readonly hiddenPx: number;
}

export interface ReflowFindings {
  readonly offscreen: OverflowOffender[];
  readonly clipped: ClippedContent[];
}

/**
 * @param allowedSurfaces Επιλογείς CSS των επιφανειών (β) — έρχονται από το spec, με λόγο.
 * @returns Μόνο οι **ανώτατοι** παραβάτες: ένα φαρδύ μπλοκ δεν αναφέρεται μαζί με τα 40 παιδιά του,
 *          ένα κουτί που ψαλιδίζει δεν αναφέρεται μαζί με τους προγόνους του που ψαλιδίζουν το ίδιο κείμενο.
 */
export function collectReflowFindings(allowedSurfaces: readonly string[]): ReflowFindings {
  // `clientWidth`, όχι `innerWidth`: αφαιρεί την κάθετη μπάρα κύλισης όπου υπάρχει.
  const viewport = document.documentElement.clientWidth;
  const TOLERANCE = 0.5;

  const scrollsX = (el: Element): boolean => {
    const overflowX = getComputedStyle(el).overflowX;
    return overflowX === 'auto' || overflowX === 'scroll';
  };
  const clipsX = (el: Element): boolean => {
    const overflowX = getComputedStyle(el).overflowX;
    return overflowX === 'hidden' || overflowX === 'clip';
  };
  /** (α) + (β): κάποιος πρόγονος ΑΥΣΤΗΡΑ πάνω από το `el` κυλά, ή είναι επιφάνεια χάρτη. */
  const exempt = (el: Element): boolean => {
    for (let p = el.parentElement; p !== null && p !== document.body; p = p.parentElement) {
      if (scrollsX(p)) return true;
      if (allowedSurfaces.some((selector) => p.matches(selector))) return true;
    }
    return false;
  };
  /**
   * (γ) **Σκηνή εκτός οθόνης, δηλωμένη από τον συγγραφέα** — π.χ. ο κρυφός χάρτης των στιγμιοτύπων
   * (`ListingMapSnapshotStage`, `fixed -left-[10000px]`): το WebGL θέλει πραγματικό μέγεθος, άρα ούτε
   * `display: none` ούτε μηδενικό κουτί. ΔΥΟ όροι, και οι δύο αναγκαίοι:
   *   · `inert` ΚΑΙ `aria-hidden="true"` (στο ίδιο ή σε πρόγονο) — «ούτε το αγγίζεις ούτε το αντιλαμβάνεσαι».
   *     Ένα μόνο δεν αρκεί: το Radix βάζει `aria-hidden` στο φόντο κάθε διαλόγου, κι εκείνο το φόντο ΜΕΤΡΑ.
   *   · το κουτί είναι **ΟΛΟ** έξω από την οθόνη. Κάτι μισοκομμένο είναι βλάβη αναδιάταξης, όποια δήλωση κι αν φέρει.
   */
  const declaredOffscreenStage = (el: Element, rect: DOMRect): boolean => {
    if (rect.right > TOLERANCE && rect.left < viewport - TOLERANCE) return false;
    for (let p: Element | null = el; p !== null && p !== document.body; p = p.parentElement) {
      if (p.hasAttribute('inert') && p.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  };
  /** (δ) Το `sr-only` (clip 1×1) δεν είναι διάταξη που βλέπει άνθρωπος. */
  const invisible = (el: Element, rect: DOMRect): boolean => {
    if (rect.width === 0 || rect.height === 0) return true;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'contents') return true;
    return rect.width <= 1 && rect.height <= 1;
  };
  const labelOf = (el: Element): string => {
    const aria = el.getAttribute('aria-label');
    const role = el.getAttribute('role');
    const id = el.id ? `#${el.id}` : '';
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return [role && `role=${role}`, aria && `aria-label=${aria}`, id, text && `«${text}»`]
      .filter(Boolean)
      .join(' ');
  };

  // ── 1. offscreen ─────────────────────────────────────────────────────────
  const offending = new Set<Element>();
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const rect = el.getBoundingClientRect();
    if (invisible(el, rect)) continue;
    if (rect.right <= viewport + TOLERANCE && rect.left >= -TOLERANCE) continue;
    if (exempt(el) || declaredOffscreenStage(el, rect)) continue;
    offending.add(el);
  }
  const offscreen = Array.from(offending)
    .filter((el) => el.parentElement === null || !offending.has(el.parentElement))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), label: labelOf(el), left: Math.round(rect.left), right: Math.round(rect.right) };
    });

  // ── 2. clipped (ACT 59br37 + χειριστήρια/γραφικά/κουτιά, οριζόντια) ─────
  /** (ε) Ο συγγραφέας ΔΗΛΩΣΕ την αποκοπή — και ο αναγνώστης βλέπει ότι κόπηκε. */
  const declaresTruncation = (el: Element): boolean => {
    const style = getComputedStyle(el);
    const clamp = style.getPropertyValue('-webkit-line-clamp');
    if (clamp !== '' && clamp !== 'none') return true;
    return style.textOverflow !== 'clip' && style.whiteSpace === 'nowrap';
  };
  /** (στ) + (ζ): ό,τι δεν ανήκει στη διάταξη που ελέγχουμε. */
  const outOfScope = (el: Element): boolean => el.closest('[aria-hidden="true"]') !== null;
  /**
   * 🔑 **Ό,τι ΒΛΕΠΕΙ ή ΠΑΤΑ ο άνθρωπος** — το «περιεχόμενο ή λειτουργικότητα» του WCAG 1.4.10.
   * Μετρημένο 2026-09-26: το ACT κοιτά μόνο **κείμενο**, και στο `/pro` @320 το κείμενο χωρούσε
   * ενώ το πεδίο «Ειδικότητα» έχανε 32 px — το δεξί του περίγραμμα και το ▾. Στο `/stay` οι κάρτες
   * έχαναν 16 px. Άρα μετρούν ΚΑΙ: χειριστήρια · γραφικά · κουτιά με ορατό όριο (περίγραμμα, φόντο, σκιά).
   * Ένα κουτί **χωρίς** τίποτα ορατό (σκέτο flex) δεν μετρά: η υπερχείλισή του δεν φαίνεται.
   */
  const CONTROL_OR_GRAPHIC =
    'img, svg, video, canvas, iframe, button, input, select, textarea, a[href], [role="button"], ' +
    '[role="combobox"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="link"]';
  const transparent = (color: string): boolean =>
    color === 'transparent' || /,\s*0\)$|\/\s*0\)$/.test(color);
  const paintsBoundary = (style: CSSStyleDeclaration): boolean =>
    !transparent(style.backgroundColor) ||
    style.backgroundImage !== 'none' ||
    style.boxShadow !== 'none' ||
    (style.borderRightStyle !== 'none' && parseFloat(style.borderRightWidth) > 0 && !transparent(style.borderRightColor)) ||
    (style.borderLeftStyle !== 'none' && parseFloat(style.borderLeftWidth) > 0 && !transparent(style.borderLeftColor));
  const visibleThing = (el: Element): boolean => {
    // Τα εσωτερικά ενός SVG ανήκουν στο SVG — μετρά το ίδιο το `<svg>`.
    if (el.parentElement?.closest('svg')) return false;
    return el.matches(CONTROL_OR_GRAPHIC) || paintsBoundary(getComputedStyle(el));
  };

  /**
   * 🔑 **ΠΟΙΟΣ ΜΠΟΡΕΙ ΝΑ ΨΑΛΙΔΙΣΕΙ ΤΙ** — η αλυσίδα των containing block, **όχι** του DOM.
   * Κατά το CSS, το `overflow` ενός στοιχείου ψαλιδίζει μόνο απογόνους των οποίων το containing
   * block είναι το ίδιο ή μέσα του. Ένα `absolute` παιδί με containing block **πάνω** από τον
   * πρόγονο που ψαλιδίζει, **δεν** ψαλιδίζεται. Μετρημένο 2026-09-26: χωρίς αυτό, στο
   * `/search/results` @768 η μπάρα «Αναζήτηση καθώς μετακινώ τον χάρτη» (`absolute`, containing
   * block ο `div.relative` του πλέγματος) κατηγορήθηκε ότι κόβεται **125 px** από το `<section>`
   * του χάρτη — ενώ φαινόταν ολόκληρη. Ψευδώς θετικό, όχι βλάβη.
   */
  const containingBlockOf = (el: Element): Element | null => {
    const position = getComputedStyle(el).position;
    if (position !== 'absolute' && position !== 'fixed') return el.parentElement;
    for (let p = el.parentElement; p !== null; p = p.parentElement) {
      const style = getComputedStyle(p);
      const establishesForAll =
        style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none' ||
        /paint|layout|strict|content/.test(style.contain) || style.willChange.includes('transform');
      if (establishesForAll || (position === 'absolute' && style.position !== 'static')) return p;
    }
    return null; // το αρχικό containing block — τίποτα από πάνω δεν ψαλιδίζει
  };

  const clipHits = new Map<Element, { what: string; hiddenPx: number }>();
  /**
   * Ο **ΠΛΗΣΙΕΣΤΕΡΟΣ** (στην αλυσίδα containing block, από το `first` και πάνω) που ψαλιδίζει και
   * κρύβει κάτι από το `[left, right]` είναι ο υπεύθυνος. Σταματά σε κύλιση (α) και σε `sr-only` (δ).
   * `truncatable` = κείμενο ή inline περιεχόμενο: μόνο εκεί η δηλωμένη αποκοπή (ε) δικαιώνει τον πρόγονο.
   */
  const recordClip = (first: Element | null, left: number, right: number, what: string, truncatable: boolean): void => {
    for (let p = first; p !== null && p !== document.body; p = containingBlockOf(p)) {
      if (scrollsX(p)) return;
      if (!clipsX(p)) continue;
      const box = p.getBoundingClientRect();
      if (invisible(p, box)) return;
      const clipLeft = box.left + p.clientLeft;
      const hiddenPx = Math.max(right - (clipLeft + p.clientWidth), clipLeft - left);
      if (hiddenPx <= TOLERANCE) continue;
      if (truncatable && declaresTruncation(p)) return;
      const previous = clipHits.get(p);
      if (previous === undefined || hiddenPx > previous.hiddenPx) {
        clipHits.set(p, { what: previous?.what ?? what, hiddenPx });
      }
      return;
    }
  };

  // 2α. Κείμενο — τα ορθογώνια των ΓΡΑΜΜΩΝ του, όχι του κουτιού του (ACT 59br37). Ρέει μέσα στο `host`,
  //     άρα η αλυσίδα ξεκινά από τον ΙΔΙΟ τον `host`.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const host = node.parentElement;
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (host === null || text === '' || exempt(host) || outOfScope(host)) continue;
    // (στ) Το κείμενο ενός πεδίου κυλά μέσα στο πεδίο· το ΙΔΙΟ το πεδίο μετρά στο 2β.
    if (host.closest('input, textarea, select, option')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const lines = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (lines.length === 0) continue;
    const left = Math.min(...lines.map((r) => r.left));
    const right = Math.max(...lines.map((r) => r.right));
    recordClip(host, left, right, `«${text.slice(0, 40)}»`, true);
  }

  // 2β. Χειριστήρια · γραφικά · κουτιά με ορατό όριο — το ΠΕΡΙΓΡΑΜΜΑ τους.
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const rect = el.getBoundingClientRect();
    if (invisible(el, rect) || exempt(el) || outOfScope(el) || !visibleThing(el)) continue;
    // Ένα inline `<a>` μέσα σε `truncate` ΕΙΝΑΙ το κείμενο που αποκόπηκε δηλωμένα (ε) — όχι κουτί που χάθηκε.
    const inline = getComputedStyle(el).display === 'inline';
    recordClip(containingBlockOf(el), rect.left, rect.right, `<${el.tagName.toLowerCase()}> ${labelOf(el)}`.trim(), inline);
  }

  const clipped = Array.from(clipHits.entries())
    .filter(([el]) => {
      for (let p = el.parentElement; p !== null; p = p.parentElement) if (clipHits.has(p)) return false;
      return true;
    })
    .map(([el, hit]) => ({
      clipTag: el.tagName.toLowerCase(),
      clipLabel: labelOf(el),
      what: hit.what,
      hiddenPx: Math.round(hit.hiddenPx),
    }));

  return { offscreen, clipped };
}
