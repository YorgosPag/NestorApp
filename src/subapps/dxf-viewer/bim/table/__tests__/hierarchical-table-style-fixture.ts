/**
 * **Στυλ πίνακα ΜΕ ιεραρχία** — το δείγμα που χρειάζονται τα tests «μεικτής σειράς».
 *
 * ## Γιατί υπάρχει
 * Μέχρι την 2026-08-04 το built-in `standard` διαφοροποιούσε τις τρεις κλάσεις γραμμής
 * (τίτλος 4mm έντονος · κεφαλίδα 3mm έντονη με γέμισμα `#EDEDED` · δεδομένα 2,8mm
 * κανονικά) και τέσσερα διαφορετικά test suites το δανείζονταν ως βολικό δείγμα «στήλης
 * που περνά από ανόμοια κελιά»: ελάχιστο/μέγιστο ύψους κειμένου, μεικτό έντονο, συλλογή
 * γεμισμάτων, ταξίδι του γεμίσματος ως την εξαγωγή DXF.
 *
 * Με απόφαση του Giorgio το `standard` έγινε **ουδέτερο** (κάθε κελί ισάξιο — ο χρήστης
 * του καμβά φτιάχνει τον δικό του πίνακα και δεν θέλει προαποφασισμένη έμφαση). Τα
 * παραπάνω tests όμως **δεν** ελέγχουν το preset· ελέγχουν τι κάνει η μηχανή όταν τα κελιά
 * μιας σειράς διαφέρουν. Με ομοιόμορφο δείγμα θα έμεναν πράσινα **χωρίς να ρωτούν τίποτα**
 * — η χειρότερη κατάληξη για δίχτυ ασφαλείας.
 *
 * ## Γιατί ΕΝΑ αρχείο και όχι τέσσερα αντίγραφα
 * Το ίδιο ακριβώς παράγωγο στυλ θα γραφόταν τέσσερις φορές — ακριβώς το σχήμα που ο N.18
 * (jscpd / ADR-584) απαγορεύει: αδελφά κλωνάκια που αποκλίνουν σιωπηλά. Μία πηγή, τέσσερις
 * καταναλωτές.
 *
 * ⚠️ Οι τιμές είναι **παγωμένες επίτηδες**: είναι το ιστορικό δείγμα, όχι αντίγραφο του
 * preset. Αν το `standard` αλλάξει ξανά, αυτό το αρχείο **δεν** πρέπει να το ακολουθήσει —
 * αλλιώς τα tests ξαναγίνονται όμηροι μιας απόφασης εμφάνισης.
 *
 * @module subapps/dxf-viewer/bim/table/__tests__/hierarchical-table-style-fixture
 * @see ../table-style-presets.ts — `standardRowClass()`, το ουδέτερο κελί
 */

import type { TableStyle } from '../table-style';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';

/** Το γέμισμα κεφαλίδας που είχε ιστορικά το `standard` — και που τα tests χρειάζονται. */
export const FIXTURE_HEADER_FILL_HEX = '#EDEDED';

/**
 * 🔴 Το **ρητό** χρώμα κειμένου του δείγματος — ADR-739 §38.
 *
 * ## Η διαρροή που απέδειξε ότι η προειδοποίηση από πάνω δεν ήταν εκτελεσμένη
 * Η κεφαλίδα αυτού του αρχείου έγραφε ήδη «οι τιμές είναι **παγωμένες επίτηδες**… αν το
 * `standard` αλλάξει ξανά, αυτό το αρχείο **δεν** πρέπει να το ακολουθήσει». Ίσχυε όμως μόνο
 * για ό,τι δηλωνόταν **ρητά**: το `textColorHex` περνούσε αυτούσιο από το `{ ...data }`, άρα
 * ήταν κρυφό αντίγραφο του preset — ακριβώς αυτό που η προειδοποίηση απαγόρευε.
 *
 * Τη στιγμή που το `standard` πήρε αυτόματο μελάνι, **επτά** tests του
 * `table-drawing-colors.test.ts` κοκκίνισαν — και για **λάθος λόγο**: δεν δοκιμάζουν το preset,
 * δοκιμάζουν τι μαζεύει η ζώνη «Χρώματα του σχεδίου» όταν οι κλάσεις διαφέρουν. Ένα δίχτυ
 * ασφαλείας που σπάει επειδή άλλαξε κάτι που δεν παρακολουθεί είναι θόρυβος, όχι σήμα.
 *
 * Η τιμή είναι η ιστορική (`#111111`) και μένει **ρητή**: αν αλλάξει ξανά το preset, εδώ δεν
 * αλλάζει τίποτα.
 */
export const FIXTURE_TEXT_HEX = '#111111';

export const FIXTURE_TITLE_TEXT_MM = 4;
export const FIXTURE_HEADER_TEXT_MM = 3;
export const FIXTURE_DATA_TEXT_MM = 2.8;

function builtInStyle(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

/**
 * Το `standard` (πλέγμα, περιθώρια, χρώματα γραμμών) **με** την ιστορική ιεραρχία
 * τυπογραφίας πάνω του. Κρατά το ίδιο `id`: οι καταναλωτές του το περνούν ρητά ως όρισμα
 * στις συναρτήσεις που δοκιμάζουν — δεν το γράφουν σε κανένα μητρώο.
 */
export function hierarchicalTableStyle(): TableStyle {
  const base = builtInStyle(BUILTIN_TABLE_STYLE_IDS.STANDARD);
  const { title, header, data } = base.rowClasses;
  return {
    ...base,
    rowClasses: {
      title: {
        ...title,
        textHeightMm: FIXTURE_TITLE_TEXT_MM,
        textColorHex: FIXTURE_TEXT_HEX,
        bold: true,
        align: 'MC',
      },
      header: {
        ...header,
        textHeightMm: FIXTURE_HEADER_TEXT_MM,
        textColorHex: FIXTURE_TEXT_HEX,
        bold: true,
        align: 'MC',
        fillColorHex: FIXTURE_HEADER_FILL_HEX,
      },
      data: {
        ...data,
        textHeightMm: FIXTURE_DATA_TEXT_MM,
        textColorHex: FIXTURE_TEXT_HEX,
        bold: false,
        align: 'ML',
      },
    },
  };
}
