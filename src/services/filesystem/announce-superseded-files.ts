/**
 * @fileoverview 🌐 **Η ΙΣΤΟΡΙΑ ΓΡΑΦΤΗΚΕ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ — ΕΔΩ ΜΟΝΟ ΑΝΑΚΟΙΝΩΝΕΤΑΙ** (ADR-845 Ο-27 · ADR-862 Φ0 Β10).
 * @related subapps/dxf-viewer/io/{model,floorplan}-publish · services/listings/publish-listing-terrain.client
 * @module services/filesystem/announce-superseded-files
 *
 * Κάθε πόρτα υλικού ακινήτου *(μοντέλο · κάτοψη · τοπογραφικό)* απαντά με `archived`: ποια προηγούμενα αρχεία
 * αρχειοθέτησε **η ίδια**, με τη δική της ταυτότητα. Ο πελάτης το λέει στις ανοιχτές λίστες αρχείων.
 *
 * 🔑 Εκπέμπεται `FILE_SUPERSEDED` **μόνο** για ό,τι ο διακομιστής **πράγματι** αρχειοθέτησε, ποτέ για ό,τι
 * απλώς ταυτοποίησε (`supersedes`): ένα γεγονός για πράξη που δεν έγινε θα έκρυβε από τη λίστα αρχείο που
 * **είναι ακόμη ενεργό**.
 *
 * Εξήχθη όταν απέκτησε **δεύτερο** καλούντα (ADR-909 Β2): δύο αντίγραφα της ίδιας ανακοίνωσης είναι ο
 * κλώνος που πιάνει το CHECK 3.28. Βγήκε από τον viewer στον **τρίτο** καλούντα (ADR-920 Β4.7, τοπογραφικό αγγελίας).
 */

import { RealtimeService } from '@/services/realtime';

export function announceSupersededFiles(archived: readonly string[], supersededByFileId: string): void {
  for (const fileId of archived) {
    RealtimeService.dispatch('FILE_SUPERSEDED', { fileId, supersededByFileId, timestamp: Date.now() });
  }
}

/**
 * **Ποιοι αρχειοθετήθηκαν**, από ό,τι έστειλε ο διακομιστής — και `[]` για **κάθε** άλλο σχήμα.
 *
 * ⚠️ **Fail-closed προς την ανακοίνωση**: ένα σχήμα που δεν αναγνωρίζεται σημαίνει *«μην ανακοινώσεις
 * τίποτα»* — η χειρότερη εκδοχή του λάθους θα ήταν να κρυφτεί από τη λίστα αρχείο που **δεν** αρχειοθετήθηκε.
 */
export function archivedFileIdsOf(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const ids: readonly unknown[] = raw;
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}
