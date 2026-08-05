/**
 * 🔴 ADR-754 **Γ1** — **η ΜΙΑ κάθοδος στο δέντρο τύπου**: αναδρομή + εγγύηση ταυτότητας,
 * χωρίς καμία γνώση για το *τι* γίνεται στα φύλλα. Καθαρή συνάρτηση, μηδέν εξαρτήσεις.
 *
 * ## Γιατί γεννήθηκε — δύο πράξεις που στα ελληνικά λέγονται και οι δύο «μετακίνηση αναφορών»
 *
 * | | **μετακόμιση** (`table-formula-remap`) | **αντιγραφή** (`table-formula-offset`) |
 * |---|---|---|
 * | Τι συνέβη | ένα κελί **μετακόμισε** | ένας τύπος **αντιγράφηκε** |
 * | Ποιες αναφορές αλλάζουν | όσες δείχνουν **προς** το κελί που έφυγε | όσες ζουν **μέσα** στο αντίγραφο |
 * | Είσοδος | απεικόνιση «ποιο πήγε πού» | **διάνυσμα** (+1 γραμμή, +0 στήλες) |
 * | Ρόλος του `$` | **αδιάφορο** — η ταυτότητα ακολουθεί ό,τι κι αν είναι | **ο διακόπτης** |
 * | Εύρος με **ένα** άκρο μετακινημένο | μένει ακέραιο (Excel parity, §36) | δεν συμβαίνει — μετατοπίζονται και τα δύο |
 *
 * Δηλαδή **οι σημασιολογίες των φύλλων είναι ασύμβατες**. Κοινή συνάρτηση με σημαία «τι
 * κάνουμε» θα ήταν δύο ερωτήσεις με μία απάντηση — ακριβώς αυτό που το ADR-754 §1 απέρριψε.
 *
 * Ό,τι **είναι** κοινό είναι η κάθοδος: `group` › `unary` › `binary` › `call`, με επιστροφή
 * του **ίδιου αντικειμένου** όταν τίποτα από κάτω δεν άλλαξε. Είκοσι γραμμές πανομοιότυπης
 * αναδρομής σε δύο αρχεία είναι ο structural clone που πιάνει το **CHECK 3.28** — και,
 * χειρότερα, δύο θέσεις όπου ένας **νέος τύπος κόμβου** αύριο μπορεί να ξεχαστεί στη μία.
 *
 * ## 🔑 Η εγγύηση ταυτότητας δεν είναι βελτιστοποίηση
 * Η αλυσίδα `PersistedTableModel → RESOLVED_MODEL_CACHE → TableModel → LAYOUT_CACHE` κλειδώνει
 * σε **ταυτότητα αντικειμένου**. Νέο αντικείμενο χωρίς λόγο σημαίνει ακυρωμένη μνήμη **και**
 * βήμα undo που δεν αναιρεί τίποτα. Γι' αυτό ανεβαίνει από τα φύλλα ως τη ρίζα, και γι' αυτό
 * ζει **εδώ** αντί να επαναλαμβάνεται σε κάθε καταναλωτή.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-rewrite
 * @see table-formula-remap.ts — η μετακόμιση (ADR-739 §36)
 * @see table-formula-offset.ts — η αντιγραφή (ADR-754 Γ1)
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §12
 */

import type { TableFormulaNode } from '../../../types/table-formula';

/**
 * Τα **φύλλα που περιέχουν διευθύνσεις** — τα μόνα δύο είδη κόμβου που έχουν νόημα να
 * ξαναγραφτούν. Ο τύπος παράγεται από τη διακριτή ένωση αντί να δηλωθεί ξανά, ώστε ένα
 * μελλοντικό τρίτο είδος αναφοράς να **σπάει τη μεταγλώττιση** εδώ.
 */
export type TableFormulaRefLeaf = Extract<TableFormulaNode, { kind: 'ref' } | { kind: 'range' }>;

/**
 * Τι γίνεται ένα φύλλο με διεύθυνση. Επιστρέφει **το ίδιο αντικείμενο** όταν δεν αλλάζει
 * τίποτα — αυτή είναι η σύμβαση που κρατά ζωντανή την εγγύηση ταυτότητας.
 *
 * Επιτρέπεται να επιστρέψει κόμβο **άλλου είδους**: η μετατόπιση εκτός πλέγματος γίνεται
 * `#REF!`, ακριβώς όπως στο Excel. Γι' αυτό ο τύπος επιστροφής είναι ο γενικός κόμβος και όχι
 * το φύλλο.
 */
export type TableFormulaLeafRewrite = (leaf: TableFormulaRefLeaf) => TableFormulaNode;

/**
 * Ο κόμβος με τα φύλλα του ξαναγραμμένα — **το ίδιο αντικείμενο** όταν τίποτα δεν άλλαξε.
 *
 * Ο `switch` είναι **εξαντλητικός** πάνω στη διακριτή ένωση επίτηδες: ένα νέο είδος κόμβου
 * αύριο σπάει τη μεταγλώττιση εδώ αντί να ξεχαστεί και να αφήσει αναφορές που δεν ακολουθούν.
 */
export function rewriteTableFormulaRefs(
  node: TableFormulaNode,
  rewriteLeaf: TableFormulaLeafRewrite,
): TableFormulaNode {
  switch (node.kind) {
    case 'ref':
    case 'range':
      return rewriteLeaf(node);
    case 'group': {
      const inner = rewriteTableFormulaRefs(node.inner, rewriteLeaf);
      return inner === node.inner ? node : { kind: 'group', inner };
    }
    case 'unary': {
      const operand = rewriteTableFormulaRefs(node.operand, rewriteLeaf);
      return operand === node.operand ? node : { ...node, operand };
    }
    case 'binary': {
      const left = rewriteTableFormulaRefs(node.left, rewriteLeaf);
      const right = rewriteTableFormulaRefs(node.right, rewriteLeaf);
      return left === node.left && right === node.right ? node : { ...node, left, right };
    }
    case 'call': {
      const args = node.args.map((arg) => rewriteTableFormulaRefs(arg, rewriteLeaf));
      return args.every((arg, i) => arg === node.args[i]) ? node : { ...node, args };
    }
    case 'number':
    case 'text':
    case 'boolean':
    case 'error':
      return node;
  }
}
