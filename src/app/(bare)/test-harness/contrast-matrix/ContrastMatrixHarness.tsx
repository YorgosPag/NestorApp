'use client';

/**
 * ADR-770 **Στρώμα 2β** — το πλέγμα επιφανειών, ως **αριθμομηχανή**.
 *
 * ΤΙ ΕΙΝΑΙ: μια σελίδα που **εκτελεί** κάθε δήλωση χρώματος των token modules και
 * αφήνει τον browser να τη λύσει, ώστε το Node να διαβάσει **υπολογισμένα** rgb αντί
 * για parsed hex. Έτσι κλείνουν τα ρητά δηλωμένα όρια Κ5–Κ7 του CHECK 3.39: `rgba()`,
 * `hsl(var(--x))`, `color-mix()`, indirection μέσω `var()` — ό,τι ο AST **δεν** λύνει.
 *
 * 🔑 ΓΙΑΤΙ ΑΥΤΟ ΚΑΙ ΟΧΙ ΣΑΡΩΣΗ ΔΙΑΔΡΟΜΩΝ (μετρήθηκε 2026-08-07, δείγμα 20/140):
 * χωρίς αυθεντικοποίηση, οι `/`, `/contacts`, `/projects`, `/buildings` βάφουν
 * **ταυτόσημα 33 στοιχεία / 452 χαρακτήρες** — μόνο το sidebar. Μια σάρωση διαδρομών θα
 * μέτραγε **το ίδιο sidebar τέσσερις φορές** και θα ονόμαζε το αποτέλεσμα «κάλυψη».
 * Επιπλέον 17/20 μετρήθηκαν σε σκοτεινό και 2 σε φωτεινό θέμα ⇒ **μη επαναλήψιμο**.
 *
 * 🔑 ΓΙΑΤΙ ΤΟ ΦΟΝΤΟ ΕΔΩ **ΔΕΝ** ΕΙΝΑΙ ΤΕΧΝΗΤΟ: δεν διαλέγουμε «ένα εύλογο φόντο».
 * Επιστρέφουμε **κάθε** επιφάνεια που ορίζει το `globals.css`, και ο κριτής παράγει το
 * πλήρες γινόμενο. Πέρασε σε **όλες** ⇒ αναγνώσιμο όπου κι αν το βάλει κανείς. Αυτό
 * είναι αυστηρότερο από το ζευγάρωμα `on-*` του Material 3, που εγγυάται μόνο τα ζεύγη
 * που **δήλωσε** ο σχεδιαστής.
 *
 * ⚠️ ΜΗΔΕΜΙΑ ΚΡΙΣΗ ΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Ούτε κατώφλι, ούτε ρόλος, ούτε φίλτρο
 * σημασιολογίας, ούτε λόγος αντίθεσης. Ο κριτής υπάρχει **ήδη** και είναι ο ίδιος του
 * CHECK 3.39 (`wcag-contrast.js` + `theme-pairing.js`). Ένα κατώφλι γραμμένο εδώ θα
 * ήταν δεύτερη αυθεντία για ερώτημα που έχει απάντηση.
 *
 * ⚠️ ΤΟ ΘΕΜΑ ΕΠΙΒΑΛΛΕΤΑΙ ΚΑΙ **ΕΠΑΛΗΘΕΥΕΤΑΙ**, δεν το περιμένουμε. Η επιστροφή κουβαλά
 * `themeVerified` — αν η κλάση δεν ισχύει, ο κριτής **σκάει** (fail-closed) αντί να
 * αναφέρει αριθμό που ανήκει στο άλλο θέμα. Το «`dark: false` αμέσως μετά τη φόρτωση»
 * είναι race, όχι φωτεινό θέμα (ADR-770 §Γ πρακτικό 4).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as designTokens from '@/styles/design-tokens';
import { collectColorLeaves, type TokenLeaf } from './token-color-leaves';
import styles from './contrast-matrix.module.css';

/** Τα δύο sentinel χρώματα — ΠΡΕΠΕΙ να συμφωνούν με το `.groupA` / `.groupB` του CSS. */
const SENTINEL_A = 'rgb(1, 2, 3)';
const SENTINEL_B = 'rgb(4, 5, 6)';

/**
 * Μια τιμή που περιέχει `}`, `;`, `<`, `>` ή `@` δεν μπαίνει σε παραγόμενο CSS. Οι τιμές
 * έρχονται από τον δικό μας κώδικα, αλλά ένα παραγόμενο stylesheet που εμπιστεύεται
 * την είσοδό του είναι ελάττωμα σχεδίασης ανεξάρτητα από την προέλευση (N.1). Οι
 * απορριφθείσες **αναφέρονται** — δεν εξαφανίζονται.
 */
const CSS_SAFE = /^[^{}<>;@]+$/;

/** Πώς λύθηκε μια δήλωση — τρεις καταστάσεις, καμία σιωπηλή. */
export type ResolutionState = 'color' | 'not-a-color' | 'disagreement';

interface ResolvedDeclaration {
  readonly path: string;
  readonly raw: string;
  /** Το υπολογισμένο χρώμα, ή `''` όταν `state !== 'color'`. */
  readonly computed: string;
  readonly state: ResolutionState;
}

interface MatrixSnapshot {
  readonly theme: 'light' | 'dark';
  readonly themeVerified: boolean;
  readonly declarations: readonly ResolvedDeclaration[];
  readonly customProperties: Readonly<Record<string, string>>;
  readonly aliases: readonly { path: string; canonical: string }[];
  readonly skipped: {
    readonly functions: readonly string[];
    readonly nonColorStrings: number;
    readonly cssUnsafe: readonly string[];
    readonly truncatedAtDepth: readonly string[];
  };
  readonly unreadableStylesheets: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __contrastMatrix: ((theme: 'light' | 'dark') => MatrixSnapshot) | undefined;
}

/**
 * Απαρίθμηση **όλων** των CSS custom properties από τα φορτωμένα stylesheets.
 *
 * 🔑 Η αυθεντία είναι το **φορτωμένο CSS**, όχι μια λίστα ονομάτων σε TypeScript. Δύο
 * χειρόγραφες λίστες που αποκλίνουν είναι το ακριβές σχήμα του CHECK 3.34 (63 namespaces
 * διαφορά) και του CHECK 3.37 (18 έναντι 26 πυλών). Εδώ δεν υπάρχει δεύτερη λίστα.
 *
 * Δεν φιλτράρει «ποιο είναι επιφάνεια» — αυτό το ξέρει ο κριτής (`surfaceTokens`).
 */
function readAllCustomProperties(): { props: string[]; unreadable: number } {
  const names = new Set<string>();
  let unreadable = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // cross-origin stylesheet: μετριέται, δεν αγνοείται σιωπηλά
      unreadable++;
      continue;
    }
    const visit = (list: CSSRuleList): void => {
      for (const rule of Array.from(list)) {
        if (rule instanceof CSSStyleRule) {
          for (const prop of Array.from(rule.style)) {
            if (prop.startsWith('--')) names.add(prop);
          }
        }
        const nested = (rule as CSSGroupingRule).cssRules;
        if (nested) visit(nested);
      }
    };
    visit(rules);
  }
  return { props: [...names].sort(), unreadable };
}

export default function ContrastMatrixHarness() {
  const [mounted, setMounted] = useState(false);

  const collected = useMemo(
    () => collectColorLeaves(designTokens as unknown as Record<string, unknown>),
    [],
  );

  const { probes, cssUnsafe } = useMemo(() => {
    const ok: TokenLeaf[] = [];
    const bad: string[] = [];
    for (const leaf of collected.leaves) {
      if (CSS_SAFE.test(leaf.raw)) ok.push(leaf);
      else bad.push(leaf.path);
    }
    return { probes: ok, cssUnsafe: bad };
  }, [collected]);

  /**
   * Το παραγόμενο stylesheet: ένας κανόνας ανά δήλωση, στοχευμένος με attribute
   * selector. Χρησιμοποιεί ΜΟΝΟ `color` — ένα rgb είναι rgb, ανεξάρτητα από την
   * ιδιότητα που το ζήτησε, οπότε δεν χρειάζονται χωριστά probes για
   * κείμενο/επιφάνεια/περίγραμμα. Ο **ρόλος** κρίνεται στο Node, από το όνομα.
   */
  const generatedCss = useMemo(
    () => probes.map((p) => `[data-token-path="${p.path}"]{color:${p.raw}}`).join('\n'),
    [probes],
  );

  const readSnapshot = useCallback(
    (theme: 'light' | 'dark'): MatrixSnapshot => {
      const root = document.documentElement;
      root.classList.toggle('dark', theme === 'dark');
      // Επιβεβαίωση, όχι ελπίδα: η κλάση ή ισχύει ή ο κριτής σκάει.
      const themeVerified = root.classList.contains('dark') === (theme === 'dark');

      const declarations = probes.map((p): ResolvedDeclaration => {
        const a = document.querySelector<HTMLElement>(`[data-group="A"][data-token-path="${p.path}"]`);
        const b = document.querySelector<HTMLElement>(`[data-group="B"][data-token-path="${p.path}"]`);
        const ca = a ? getComputedStyle(a).color : '';
        const cb = b ? getComputedStyle(b).color : '';

        // Και οι δύο κληρονόμησαν το sentinel του γονέα τους ⇒ το declaration ήταν
        // άκυρο (invalid at computed-value time). Το token ΔΕΝ κρατά χρώμα.
        if (ca === SENTINEL_A && cb === SENTINEL_B) {
          return { path: p.path, raw: p.raw, computed: '', state: 'not-a-color' };
        }
        // Ίδιο αποτέλεσμα κάτω από διαφορετικούς γονείς ⇒ η τιμή είναι αυτοτελής.
        if (ca && ca === cb) {
          return { path: p.path, raw: p.raw, computed: ca, state: 'color' };
        }
        // Ό,τι απομένει εξαρτάται από τα συμφραζόμενα (`currentColor`, μερική
        // κληρονομιά). Δηλώνεται — δεν χωράει σε καμία από τις δύο πρώτες.
        return { path: p.path, raw: p.raw, computed: '', state: 'disagreement' };
      });

      const { props, unreadable } = readAllCustomProperties();
      const rootStyle = getComputedStyle(root);
      const customProperties: Record<string, string> = {};
      for (const name of props) {
        customProperties[name] = rootStyle.getPropertyValue(name).trim();
      }

      return {
        theme,
        themeVerified,
        declarations,
        customProperties,
        aliases: collected.aliases as MatrixSnapshot['aliases'],
        skipped: {
          functions: collected.skippedFunctions,
          nonColorStrings: collected.skippedNonColorStrings,
          cssUnsafe,
          truncatedAtDepth: collected.truncatedAtDepth,
        },
        unreadableStylesheets: unreadable,
      };
    },
    [probes, collected, cssUnsafe],
  );

  useEffect(() => {
    globalThis.__contrastMatrix = readSnapshot;
    setMounted(true);
    return () => {
      globalThis.__contrastMatrix = undefined;
    };
  }, [readSnapshot]);

  return (
    <main className={styles.harness} data-contrast-matrix-ready={mounted ? 'true' : 'false'}>
      {/* eslint-disable-next-line react/no-danger -- παραγόμενο CSS από τις ΙΔΙΕΣ τις
          δηλώσεις των token modules, φιλτραρισμένο με CSS_SAFE. Είναι ο λόγος ύπαρξης
          του harness: το χρώμα πρέπει να λυθεί από τον browser, όχι από εμάς. */}
      <style dangerouslySetInnerHTML={{ __html: generatedCss }} />
      {(['A', 'B'] as const).map((group) => (
        <section
          key={group}
          className={`${styles.grid} ${group === 'A' ? styles.groupA : styles.groupB}`}
          data-probe-group={group}
        >
          {probes.map((p) => (
            <span key={p.path} className={styles.probe} data-group={group} data-token-path={p.path}>
              Ag
            </span>
          ))}
        </section>
      ))}
    </main>
  );
}
