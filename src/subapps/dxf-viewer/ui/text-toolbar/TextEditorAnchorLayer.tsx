'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-344 Φ-3D — TextEditorAnchorLayer: το ΚΟΙΝΟ imperative-positioning κέλυφος του
 * in-place text editor, για 2D **και** 3D.
 *
 * Είναι το ακριβές αδελφάκι του {@link ClashMarkerLayer} (ADR-435 Slice 1b) — ίδια αρχή,
 * άλλο περιεχόμενο: το παιδί αποδίδεται ΜΙΑ φορά από τον React, και μετά μετακινείται
 * **επιτακτικά** (ref + CSS `translate`) κάθε φορά που πυροδοτεί το `subscribe` του
 * καλούντος. Ποτέ re-render σε pan / zoom / orbit — ο ίδιος λόγος για τον οποίο οι
 * καμβάδες παρακάμπτουν τον React στα υψίσυχνα transforms (ADR-040).
 *
 * Αυτό που διαφέρει ανά προβολή είναι ΜΟΝΟ η προβολή, και εγχέεται:
 *   - 2D → world → screen μέσω του άμεσου 2D transform
 *   - 3D → world → screen μέσω της κάμερας (προβολή τύπου CSS2D)
 *
 * ### Γιατί ΔΕΝ κάνουμε CSS3DRenderer (ADR-344 Φ-3D, τεκμηριωμένη απόρριψη)
 * Ένα `contenteditable` πάνω σε `matrix3d` δείχνει εντυπωσιακό και είναι **λάθος**: σε
 * πλάγια γωνία το κείμενο γίνεται δυσανάγνωστο ακριβώς τη στιγμή που το διορθώνεις, και
 * τα caret / selection hit-boxes του browser σπάνε κάτω από προοπτικό transform. Η ίδια
 * η AutoCAD, στο ίδιο ακριβώς domain, το έχει ήδη απαντήσει: `MTEXTFIXED = 2` (η
 * **προεπιλογή** της) εμφανίζει κείμενο που θα ήταν δυσανάγνωστο — «πολύ μικρό, πολύ
 * μεγάλο, ή **περιστραμμένο**» — **οριζόντια και σε ευανάγνωστο μέγεθος». Άρα:
 * **θέση** από την προβολή, **μέγεθος + προσανατολισμός** σταθερά σε screen-space.
 *
 * ### Το clamping (πού ξεπερνάμε τους μεγάλους)
 * Το AutoCAD αγκυρώνει και ξεχνάει· ο Blender αφήνει την πλοήγηση ελεύθερη αλλά δεν έχει
 * DOM να χάσει. Εδώ ο editor **περιορίζεται μέσα στο viewport**: όσο κι αν κάνεις orbit,
 * ή ακόμη κι αν το κείμενο περάσει ΠΙΣΩ από την κάμερα (`project()` → `null`), το κουτί
 * που πληκτρολογείς δεν φεύγει ποτέ εκτός οθόνης. Χάνεις την αγκύρωση, δεν χάνεις τη
 * δουλειά σου.
 *
 * @see ../../components/dxf-layout/clash-markers/ClashMarkerLayer.tsx — το πρότυπο
 * @see ./TextEditorOverlay.tsx — το παιδί (TipTap)
 */

import React, { useEffect, useRef } from 'react';
import { useVisualViewport } from './responsive';

/** Πόσα px του editor μένουν υποχρεωτικά ορατά όταν το άγκυρο φεύγει εκτός οθόνης. */
const MIN_VISIBLE_PX = 48;

/**
 * Η αγκύρωση ενός in-place editor — ΤΟ συμβόλαιο που υλοποιούν χωριστά η 2D και η 3D
 * προβολή, και το μοναδικό σημείο όπου οι δύο διαστάσεις επιτρέπεται να διαφέρουν.
 *
 * @see ./text-editor-anchor-2d.ts — ο 2D resolver (άμεσο affine transform)
 * @see ../../bim-3d/text/text-edit-anchor-3d.ts — ο 3D resolver (προβολή κάμερας)
 */
export interface TextEditorAnchor {
  /** Άνω-αριστερή γωνία του editor σε client px, ή `null` όταν το άγκυρο δεν προβάλλεται. */
  readonly project: () => { x: number; y: number } | null;
  /** Δήλωσε callback επαναπροβολής (pan/zoom/orbit driver)· επίστρεψε τη συνάρτηση αποδέσμευσης. */
  readonly subscribe: (reproject: () => void) => () => void;
  /** Ελάχιστες διαστάσεις του κουτιού (px) — για το clamping και το αρχικό layout. */
  readonly size: { readonly width: number; readonly height: number };
  /**
   * ADR-739 Φ.Δ βήμα 3 — **ζωντανό** κουτί: μέγεθος, κλίση και τυπογραφία που ζουμάρουν
   * μαζί με τον καμβά, ανανεωμένα στον **ίδιο** χρόνο tick με τη θέση.
   *
   * Απόν ⇒ η ιστορική συμπεριφορά μένει **ακέραιη**: σταθερό κουτί σε px οθόνης, χωρίς
   * κλίση (AutoCAD `MTEXTFIXED`, δες την κεφαλίδα). Αυτή είναι η σωστή απάντηση για
   * **ελεύθερο** κείμενο, που μπορεί να είναι μικροσκοπικό ή ανάποδο. Ένα **κελί πίνακα**
   * όμως έχει δικό του ορθογώνιο, δική του γραμματοσειρά και δική του στοίχιση: εκεί το
   * «σταθερό σε px» σημαίνει «ένα ξένο κουτί πάνω στο κελί», που είναι ακριβώς το ελάττωμα
   * που ανέφερε ο Giorgio (2026-08-01). Γι' αυτό είναι **επιλογή ανά καταναλωτή** και όχι
   * καθολική αλλαγή.
   *
   * ADR-739 Φ.Δ βήμα 6 — δέχεται τη **θέση** του άγκυρου (client px) επειδή το μέγεθος
   * μπορεί να εξαρτάται από αυτήν: ένα κουτί που μεγαλώνει με το περιεχόμενο πρέπει να ξέρει
   * πόσος χώρος υπάρχει μέχρι την άκρη του παραθύρου. `null` όταν το άγκυρο δεν προβάλλεται.
   */
  readonly projectBox?: (anchor: { x: number; y: number } | null) => TextEditorAnchorBox | null;
}

/**
 * Το ζωντανό κουτί ενός in-place editor σε px οθόνης.
 *
 * `cssVars` είναι ο δρόμος με τον οποίο **παιδικά** στοιχεία (το `<input>` / το TipTap)
 * μαθαίνουν ζωντανά μεγέθη **χωρίς κανένα re-render**: το layer τις γράφει πάνω στο κουτί
 * και το παιδί τις καταναλώνει με `var()`. Χωρίς αυτό, κάθε καρέ zoom θα ήταν ένα
 * `setState` πάνω σε πεδίο κειμένου με ενεργό κέρσορα — ακριβώς το είδος συνδρομής που ο
 * ADR-040 απαγορεύει.
 */
export interface TextEditorAnchorBox {
  readonly widthPx: number;
  readonly heightPx: number;
  /** CSS ακτίνια (θετικά δεξιόστροφα)· 0 ⇒ καμία κλίση. */
  readonly rotationRad: number;
  /**
   * ADR-739 Φ.Δ βήμα 6 — μετατόπιση κατά μήκος του **τοπικού** άξονα x του κουτιού, δηλαδή
   * **μετά** την περιστροφή (px· αρνητική = προς τα αριστερά όπως το βλέπει το κουτί).
   *
   * 🔴 Γι' αυτό μπαίνει στο `transform` **μετά** το `rotate` και όχι στη θέση του άγκυρου:
   * σε στραμμένο πίνακα το κουτί πρέπει να απλωθεί κατά μήκος της **γραμμής του πίνακα**, όχι
   * οριζόντια στην οθόνη. Μια μετατόπιση σε άξονες οθόνης θα ξεκόλλαγε τον επεξεργαστή από
   * το κελί του μόλις ο πίνακας γύριζε έστω λίγο — και θα φαινόταν σωστή σε κάθε test με
   * γωνία μηδέν.
   */
  readonly offsetXPx?: number;
  /** Custom properties (`--…`) που γράφονται πάνω στο κουτί. */
  readonly cssVars?: Readonly<Record<string, string>>;
}

export interface TextEditorAnchorLayerProps extends TextEditorAnchor {
  readonly children: React.ReactNode;
}

/**
 * Περιόρισε την άνω-αριστερή γωνία ώστε τουλάχιστον {@link MIN_VISIBLE_PX} του editor να
 * μένουν μέσα στο παράθυρο. `keyboardInset` (κινητό soft keyboard) κόβει από το κάτω όριο.
 */
function clampToViewport(
  p: { x: number; y: number },
  size: { width: number; height: number },
  keyboardInset: number,
): { x: number; y: number } {
  const maxX = window.innerWidth - MIN_VISIBLE_PX;
  const usableHeight = window.innerHeight - keyboardInset;
  const maxY = Math.max(0, usableHeight - Math.min(size.height, MIN_VISIBLE_PX));
  return {
    x: Math.min(Math.max(p.x, MIN_VISIBLE_PX - size.width), maxX),
    y: Math.min(Math.max(p.y, 0), maxY),
  };
}

/** Γράφει το ζωντανό κουτί πάνω στο στοιχείο — μηδέν React, ένα tick. */
function applyBox(el: HTMLElement, box: TextEditorAnchorBox): void {
  el.style.width = `${box.widthPx}px`;
  el.style.height = `${box.heightPx}px`;
  if (box.cssVars) {
    for (const [name, value] of Object.entries(box.cssVars)) el.style.setProperty(name, value);
  }
}

/** Το κουτί ως αρχικό React style — ίδιες τιμές με το {@link applyBox}, πριν το πρώτο tick. */
function boxStyle(box: TextEditorAnchorBox): React.CSSProperties {
  return { width: box.widthPx, height: box.heightPx, ...box.cssVars } as React.CSSProperties;
}

export function TextEditorAnchorLayer(props: TextEditorAnchorLayerProps): React.ReactElement {
  const { project, subscribe, size, projectBox, children } = props;
  const { keyboardInset } = useVisualViewport();
  const ref = useRef<HTMLDivElement | null>(null);
  // ADR-040 — το `keyboardInset` διαβάζεται ΜΕΣΑ στο tick μέσω ref, όχι ως dependency του
  // effect: αλλιώς κάθε αλλαγή visual-viewport θα ξανάδενε τη συνδρομή του scheduler.
  const insetRef = useRef(keyboardInset);
  insetRef.current = keyboardInset;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const boxRef = useRef(projectBox);
  boxRef.current = projectBox;

  // Το κουτί της **πρώτης** απόδοσης: χωρίς αυτό, ο επεξεργαστής θα ζωγραφιζόταν ένα καρέ
  // με σταθερές προεπιλογές πριν προλάβει το tick — ένα ορατό τίναγμα ακριβώς τη στιγμή
  // που ο χρήστης κάνει διπλό κλικ. Καθαρή ανάγνωση (κλίμακα + διάταξη), καμία παρενέργεια.
  const initialBox = projectBox?.(project()) ?? null;

  useEffect(() => {
    const reproject = (): void => {
      const el = ref.current;
      if (!el) return;
      // 🔴 Και οι δύο **αναγνώσεις** πρώτα, οι **εγγραφές** μετά. Το `project()` διαβάζει
      // γεωμετρία από το DOM· το `applyBox` γράφει. Ανάγνωση μετά από εγγραφή στο ίδιο tick
      // αναγκάζει τον browser σε επιπλέον υπολογισμό διάταξης, 60 φορές το δευτερόλεπτο.
      //
      // Το άγκυρο εκτός προβολής (πίσω από την κάμερα) ΔΕΝ κρύβει τον editor — θα έσβηνε
      // το κουτί κάτω από τα δάχτυλα του χρήστη μεσοπληκτρολόγησης. Κρατιέται στην
      // τελευταία έγκυρη θέση, περιορισμένο στο viewport.
      const p = project();
      // Το ΜΕΓΕΘΟΣ πριν το clamping: αλλιώς ένα κελί που μεγάλωσε με το zoom θα περιοριζόταν
      // με το παλιό του πλάτος. Παίρνει τη θέση γιατί μπορεί να εξαρτάται από αυτήν.
      const box = boxRef.current?.(p) ?? null;
      if (box) applyBox(el, box);
      if (!p) return;
      const clampSize = box ? { width: box.widthPx, height: box.heightPx } : sizeRef.current;
      const c = clampToViewport(p, clampSize, insetRef.current);
      // Η περιστροφή μπαίνει ΜΕΤΑ τη μετατόπιση, με αρχή την πάνω-αριστερή γωνία
      // (`origin-top-left`): το κουτί γέρνει γύρω από το σημείο αγκύρωσής του, όπως ακριβώς
      // ο πίνακας γέρνει γύρω από τη δική του άγκυρα.
      //
      // Και η **τοπική** μετατόπιση τελευταία, δηλαδή μέσα στο ήδη γυρισμένο σύστημα
      // συντεταγμένων — δες {@link TextEditorAnchorBox.offsetXPx}.
      const rotate = box?.rotationRad ? ` rotate(${box.rotationRad}rad)` : '';
      const slide = box?.offsetXPx ? ` translate(${box.offsetXPx}px, 0)` : '';
      el.style.transform = `translate(${c.x}px, ${c.y}px)${rotate}${slide}`;
    };
    reproject();
    return subscribe(reproject);
  }, [project, subscribe]);

  // Με ζωντανό κουτί το `minWidth/minHeight` **αποκλείεται**: είναι στιγμιότυπο της στιγμής
  // που άνοιξε ο editor, και σε zoom-out θα κρατούσε το κουτί μεγαλύτερο από το κελί —
  // δηλαδή θα ακύρωνε ακριβώς αυτό που το ζωντανό κουτί υπάρχει για να λύσει.
  const style = initialBox
    ? boxStyle(initialBox)
    : { minWidth: size.width, minHeight: size.height };

  return (
    <div
      ref={ref}
      className="fixed left-0 top-0 z-40 origin-top-left will-change-transform"
      style={style}
    >
      {children}
    </div>
  );
}
