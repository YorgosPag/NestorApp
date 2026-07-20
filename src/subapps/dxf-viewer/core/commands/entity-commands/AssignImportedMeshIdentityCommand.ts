/**
 * ASSIGN IMPORTED MESH IDENTITY COMMAND — ADR-683 **Φ3.1β** (§10.2).
 *
 * Undoable ανάθεση/αφαίρεση της ταυτότητας κοστολόγησης (`params.importedMeshIdentity`) σε ΕΝΑ
 * εισαγόμενο πλέγμα. Είναι **η μία μετάλλαξη ολόκληρης της φάσης**: ό,τι άλλο (ποσότητα, γραμμή
 * προμέτρησης, σύνολο) παράγεται αυτόματα από αυτήν.
 *
 *   - value = `ImportedMeshBoqIdentity` → ανάθεση· ο bridge γράφει/ενημερώνει τη γραμμή BOQ
 *   - value = `undefined`               → αφαίρεση· ο lifecycle **διαγράφει** τη γραμμή BOQ
 *
 * ⚠️ **Γιατί ΔΕΝ είναι `Assign<X>TypeCommand`** (`assign-type-command-base`): εκείνη η οικογένεια
 * γράφει `typeId`/`typeOverrides` **και** αναδιπλώνει τις effective παραμέτρους ενός family type,
 * ξαναϋπολογίζοντας γεωμετρία. Εδώ δεν υπάρχει family type και **η γεωμετρία δεν αλλάζει καθόλου**:
 * η ταυτότητα δηλώνει *πώς κοστολογείται*, όχι *τι είναι* (§10.4 — η ανάθεση «κάγκελο αλουμινίου»
 * ΔΕΝ κάνει το πλέγμα παραμετρικό railing). Το σωστό αρχέτυπο είναι το set/clear ενός override
 * πεδίου — `EntityFieldOverrideCommand` — με lazy snapshot και συμμετρικό undo/redo.
 *
 * Η αποθήκευση δεν γίνεται εδώ: το `signalEntitiesAttached` της βάσης ξυπνά τον
 * `useImportedMeshPersistence`, που διαπιστώνει τη μεταβολή των params και τρέχει τον κοινό
 * `create-bim-boq-audit-lifecycle` (audit + upsert **ή** διαγραφή γραμμής).
 *
 * @see ./entity-field-override-command — η βάση (lazy snapshot, undo/redo, persist signal)
 * @see ../../../bim/entities/imported-mesh/imported-mesh-boq — `withImportedMeshIdentity` (SSoT εγγραφής)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import { withImportedMeshIdentity } from '../../../bim/entities/imported-mesh/imported-mesh-boq';
import type {
  ImportedMeshBoqIdentity,
  ImportedMeshParams,
} from '../../../bim/entities/imported-mesh/imported-mesh-types';
import { EntityFieldOverrideCommand } from './entity-field-override-command';

/** Ελάχιστο σχήμα που διαβάζει η εντολή — μόνο τα params του πλέγματος. */
interface ImportedMeshLike {
  readonly params?: ImportedMeshParams;
}

export class AssignImportedMeshIdentityCommand extends EntityFieldOverrideCommand<ImportedMeshBoqIdentity> {
  readonly name = 'AssignImportedMeshIdentity';
  readonly type = 'assign-imported-mesh-identity';

  constructor(
    entityId: string,
    /** `undefined` → αφαίρεση ανάθεσης (η γραμμή BOQ διαγράφεται). */
    private readonly identity: ImportedMeshBoqIdentity | undefined,
    sceneManager: ISceneManager,
  ) {
    super(entityId, sceneManager);
  }

  private readParams(): ImportedMeshParams | undefined {
    const entity = this.sceneManager.getEntity(this.entityId) as unknown as ImportedMeshLike | undefined;
    return entity?.params;
  }

  protected snapshotStates(): {
    prev: ImportedMeshBoqIdentity | undefined;
    next: ImportedMeshBoqIdentity | undefined;
  } | null {
    const params = this.readParams();
    if (!params) return null;
    // Ίδια τιμή → no-op χωρίς εγγραφή στο ιστορικό: ένα «Αποθήκευση» χωρίς αλλαγή δεν πρέπει να
    // γεμίζει το undo stack ούτε να πυροδοτεί επανεγγραφή της γραμμής BOQ.
    if (sameIdentity(params.importedMeshIdentity, this.identity)) return null;
    return { prev: params.importedMeshIdentity, next: this.identity };
  }

  /**
   * Γράφει την (νέα ή παλιά) ταυτότητα στα params. **Το `undefined` είναι έγκυρη τιμή εγγραφής**
   * (αφαίρεση) — γι' αυτό δεν υπάρχει `if (!value) return false`: μια τέτοια φρουρά θα έκανε το
   * undo μιας ανάθεσης σιωπηλό no-op, αφήνοντας την ταυτότητα κολλημένη.
   */
  protected writeValue(value: ImportedMeshBoqIdentity | undefined): boolean {
    const params = this.readParams();
    if (!params) return false;
    this.sceneManager.updateEntity(
      this.entityId,
      { params: withImportedMeshIdentity(params, value) } as unknown as Partial<SceneEntity>,
    );
    return true;
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity id is required';
    if (this.identity && !this.identity.categoryCode) return 'categoryCode is required';
    if (this.identity && !this.identity.titleEL) return 'titleEL is required';
    return null;
  }

  getDescription(): string {
    return this.identity
      ? `Assign BOQ identity (${this.identity.categoryCode}) to ${this.entityId}`
      : `Clear BOQ identity of ${this.entityId}`;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.entityId, identity: this.identity ?? null };
  }
}

/** Ισοδυναμία ταυτοτήτων κατά τιμή — τα τέσσερα πεδία, χωρίς εξάρτηση από σειρά κλειδιών. */
function sameIdentity(
  a: ImportedMeshBoqIdentity | undefined,
  b: ImportedMeshBoqIdentity | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.categoryCode === b.categoryCode &&
    a.unit === b.unit &&
    a.titleEL === b.titleEL &&
    a.materialId === b.materialId
  );
}
