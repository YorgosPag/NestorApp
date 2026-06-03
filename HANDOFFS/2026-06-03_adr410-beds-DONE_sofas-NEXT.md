# HANDOFF — Πρόσθεση ΜΟΝΤΕΡΝΩΝ ΚΑΝΑΠΕΔΩΝ στη βιβλιοθήκη επίπλων (ADR-410/411)

**Ημερομηνία:** 2026-06-03
**Τύπος:** Επέκταση καταλόγου — ΑΜΙΓΩΣ ΔΕΔΟΜΕΝΑ (asset pipeline + catalog + i18n) + 1 type-union + 1 Zod enum + 1 ΑΤΟΕ entry. ΟΧΙ νέα αρχιτεκτονική.
**Μοντέλο:** Sonnet 4.6 αρκεί (asset pipeline + 6 αρχεία δεδομένων/τύπων + uploads). Opus μόνο αν προκύψει κάτι cross-cutting.
**Σχετικά ADR:** **ADR-411** (BIM Mesh Library — entity-agnostic, δουλεύει) · **ADR-410** (furniture entity, v1.9) · **ADR-409 §B-θετικό v1.4** (Kenney = verified CC0 πηγή).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

Πρόσθεσε **μοντέρνους καναπέδες** (CC0 meshes) στη βιβλιοθήκη **επίπλων** (το ίδιο tool «Έπιπλο» / furniture).
Σήμερα ο κατάλογος έχει **καρέκλες** (`kind: 'chair'`), **τραπέζια** (`kind: 'table'`) και **κρεβάτια** (`kind: 'bed'`).
Θέλουμε νέο kind `'sofa'` με 2-4 **μοντέρνους** καναπέδες.

> Το mesh-library subsystem (ADR-411) είναι ΗΔΗ entity-agnostic & δουλεύει (browser-verified από τον Giorgio).
> Η πρόσθεση kind/asset είναι **ΑΜΙΓΩΣ δεδομένα** — ΜΗΝ ξαναχτίσεις pipeline. Τα τραπέζια (Poly Haven) ΚΑΙ τα κρεβάτια (Kenney) δούλεψαν τέλεια.

---

## 🚨 ΚΡΙΣΙΜΟ ΜΑΘΗΜΑ ΑΠΟ ΤΑ ΚΡΕΒΑΤΙΑ (διάβασέ το ΠΡΙΝ ψάξεις πηγή)

**Φωτορεαλιστικό μοντέρνο CC0 ΚΑΝΑΠΕ ΔΕΝ υπάρχει** στις «verified-φιλικές» πηγές — ακριβώς όπως στα κρεβάτια:
- **Poly Haven** καναπέδες = ΟΛΟΙ vintage/gothic (`Sofa_01`, `sofa_02`, `sofa_03`, `chinese_sofa`, `painted_wooden_sofa`). Κανένας μοντέρνος.
- **Sketchfab CC0** corpus = ~αποκλειστικά μουσειακά/απολιθώματα high-poly scans → μηδέν μοντέρνο app-ready έπιπλο.

➡️ **Πήγαινε ΚΑΤΕΥΘΕΙΑΝ στο Kenney Furniture Kit (CC0)** — είναι ήδη η εγκεκριμένη πηγή για furniture (ADR-409 v1.4). Ο Giorgio **έχει ΗΔΗ αποδεχτεί** το low-poly stylized look για έπιπλα (AskUserQuestion στα κρεβάτια) → **ΜΗΝ ξαναρωτήσεις** για το look· προχώρα με Kenney. (Αν θέλει φωτορεαλιστικό = paid/άλλο marketplace, θα το πει ο ίδιος.)

---

## 🏗️ ASSET PIPELINE — KENNEY (δοκιμασμένο 2026-06-03, δούλεψε άψογα για 3 κρεβάτια)

Project = **`pagonis-87766`** (ΔΕΝ υπάρχει `.firebaserc` → ΠΑΝΤΑ `--project pagonis-87766`).
Bucket = `gs://pagonis-87766.firebasestorage.app`. gcloud authed ως georgios.pagonis@gmail.com.
Storage tree (κατηγορία επίπλων = `furniture`): `bim-mesh-library/furniture/<id>.glb` + `…/thumbnails/<id>.png`.

### Βήμα 0 — temp folder (rm/PowerShell ΜΠΛΟΚΑΡΙΣΜΕΝΑ)
Φτιάξε temp `.sofa-lib/` με node `fs.mkdirSync(d,{recursive:true})`. Στο τέλος **ΣΒΗΣ' ΤΟ** με node `fs.rmSync(d,{recursive:true,force:true})` (ΛΕΙΤΟΥΡΓΕΙ — έτσι σβήστηκε το `.bed-lib`). Untracked → ποτέ σε commit.

### Βήμα 1 — Κατέβασε το Kenney Furniture Kit ZIP (ΗΔΗ έχουμε το URL)
```
node -e "const fs=require('fs');fs.mkdirSync('.sofa-lib',{recursive:true});fetch('https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip').then(r=>r.arrayBuffer()).then(b=>{fs.writeFileSync('.sofa-lib/kit.zip',Buffer.from(b));console.log('saved',b.byteLength);})"
```
(Αν το URL 404-άρει, ξανα-WebFetch το `https://kenney.nl/assets/furniture-kit` ζητώντας το download .zip href.)

### Βήμα 2 — Εξαγωγή με **Windows bsdtar** (ΟΧΙ git-bash GNU tar — αποτυγχάνει σε zip!)
```
cd /c/Nestor_Pagonis/.sofa-lib && /c/Windows/System32/tar.exe -xf kit.zip
```
**License.txt = CC0 verbatim** («free to use in personal, educational and commercial projects»). Models σε `Models/GLTF format/*.glb` (έτοιμα .glb — ΟΧΙ gltf-transform pack!). Thumbnails σε `Isometric/<name>_NE.png` (+NW/SE/SW) και `Side/<name>.png`.

### Βήμα 3 — Βρες τους καναπέδες
```
cd /c/Nestor_Pagonis/.sofa-lib/Models/GLTF\ format && ls | grep -iE "sofa|couch|lounge|bench"
```
Διάλεξε 2-4 μοντέρνους (π.χ. πιθανά `loungeSofa`, `loungeSofaCorner`, `loungeDesignSofa`, `loungeDesignSofaCorner`, `couch`, `benchCushion` — **επιβεβαίωσε με ls**). Προτίμησε κανονικούς καναπέδες, όχι μικρά σκαμπό.

### Βήμα 4 — ⚠️ BAKE UNIFORM SCALE στα GLB (ΤΟ ΠΙΟ ΚΡΙΣΙΜΟ ΒΗΜΑ)
Το Kenney authored τα μοντέλα σε **stylized μικρή κλίμακα** (μονό κρεβάτι βγήκε 571×1125mm αντί ρεαλιστικό). Ο converter `meshToObject3D` (cache hit) **render-άρει το mesh «as METERS × scaleOverride» ΧΩΡΙΣ fit-to-catalog-dims** (το επιβεβαίωσα στον κώδικα: `furniture-to-three.ts` περνά `scale: params.scaleOverride ?? 1`· catalog dims οδηγούν ΜΟΝΟ το 2D footprint + placeholder). Άρα **αν δεν μεγεθύνεις, ο καναπές βγαίνει μικροσκοπικός ΚΑΙ 2D footprint ≠ 3D mesh.**

**Λύση (μηδέν αλλαγή logic):** bake uniform scale στα **root nodes** των GLB (όλα τα Kenney έχουν 1 root node στο origin, S=[1,1,1]), μετά αποθήκευσε το **scaled bbox** ως catalog dims.

1. Μέτρησε πρώτα το authored bbox (world-space, με node transforms) — δες script παρακάτω.
2. Διάλεξε factor ώστε το μήκος (long axis) να γίνει ρεαλιστικό. **Για κρεβάτια χρησιμοποίησα ×1.69** (μήκος 1125→1901mm). Για καναπέδες: τυπικός 2θέσιος ~1600-1800mm, 3θέσιος ~2000-2200mm πλάτος· γωνιακός ~2500mm. Μέτρα το Kenney authored και βάλε factor ώστε το μεγαλύτερο dim να φτάσει ρεαλιστικό. **Βάλε ΕΝΑ uniform factor για όλους** (κρατά μεταξύ τους αναλογία).
3. Re-serialize το GLB (διόρθωση chunk lengths + padding) — script έτοιμο παρακάτω.
4. Re-measure + `validate` (πρέπει 0 errors).

**Script GLB-scaler (αυτό ακριβώς δούλεψε στα κρεβάτια):**
```js
const fs=require("fs");
const F=1.69; // ← άλλαξε factor ανά μέτρηση
function readChunks(b){const total=b.readUInt32LE(8);let off=12;const c=[];while(off<total){const len=b.readUInt32LE(off);const t=b.readUInt32LE(off+4);c.push({type:t,data:b.slice(off+8,off+8+len)});off+=8+len;}return c;}
function pad(buf,p){const r=(4-(buf.length%4))%4;return r?Buffer.concat([buf,Buffer.alloc(r,p)]):buf;}
for(const f of ["<file>.glb"]){
  const b=fs.readFileSync(f);const chunks=readChunks(b);
  const jsonChunk=chunks.find(c=>c.type===0x4E4F534A);const binChunk=chunks.find(c=>c.type===0x004E4942);
  const json=JSON.parse(jsonChunk.data.toString("utf8"));const scene=json.scenes[json.scene||0];
  for(const ni of scene.nodes){json.nodes[ni].scale=[F,F,F];}
  const newJson=pad(Buffer.from(JSON.stringify(json),"utf8"),0x20);const newBin=binChunk?pad(binChunk.data,0x00):null;
  let total=12+8+newJson.length+(newBin?8+newBin.length:0);
  const header=Buffer.alloc(12);header.write("glTF",0,"ascii");header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
  const jH=Buffer.alloc(8);jH.writeUInt32LE(newJson.length,0);jH.writeUInt32LE(0x4E4F534A,4);
  const parts=[header,jH,newJson];
  if(newBin){const bH=Buffer.alloc(8);bH.writeUInt32LE(newBin.length,0);bH.writeUInt32LE(0x004E4942,4);parts.push(bH,newBin);}
  fs.writeFileSync(f.replace(".glb","_scaled.glb"),Buffer.concat(parts));
}
```

**Script μέτρησης bbox (world-space, parse GLB JSON chunk + node matrices):**
```js
const fs=require("fs");
function parseGLB(f){const b=fs.readFileSync(f);return JSON.parse(b.slice(20,20+b.readUInt32LE(12)).toString("utf8"));}
function mul(a,bm){const o=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*bm[c*4+k];o[c*4+r]=s;}return o;}
function trs(n){if(n.matrix)return n.matrix.slice();const t=n.translation||[0,0,0],r=n.rotation||[0,0,0,1],s=n.scale||[1,1,1];const[x,y,z,w]=r,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;return [(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,t[0],t[1],t[2],1];}
function xf(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
const g=parseGLB("<file>.glb");const min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];const scene=g.scenes[g.scene||0];
(function visit(ni,parent){const n=g.nodes[ni];const m=mul(parent,trs(n));if(n.mesh!=null)for(const pr of g.meshes[n.mesh].primitives){const a=g.accessors[pr.attributes.POSITION];for(let i=0;i<8;i++){const c=[(i&1?a.max:a.min)[0],(i&2?a.max:a.min)[1],(i&4?a.max:a.min)[2]];const w=xf(m,c);for(let k=0;k<3;k++){if(w[k]<min[k])min[k]=w[k];if(w[k]>max[k])max[k]=w[k];}}}for(const c of (n.children||[]))visit(c,m);})(scene.nodes[0],[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
// widthMm = X*1000, depthMm = Z*1000, heightMm = Y*1000 (Y-up!)
console.log("widthMm",Math.round((max[0]-min[0])*1000),"depthMm",Math.round((max[2]-min[2])*1000),"heightMm",Math.round((max[1]-min[1])*1000));
```
Επανάλαβε visit για ΚΑΘΕ root node αν `scene.nodes.length>1` (τα Kenney έχουν 1).

### Βήμα 5 — Validate
```
npx --yes @gltf-transform/cli@latest validate <id>.glb   # περίμενε "No errors / No warnings"
```

### Βήμα 6 — Thumbnails
Χρησιμοποίησε το Kenney isometric: `cp Isometric/<name>_NE.png <id>.png` (διάφανο φόντο, ~150-220px, μια χαρά για catalog).

### Βήμα 7 — Upload (glb + png, ΜΕ download token — ΑΠΑΡΑΙΤΗΤΟ για getDownloadURL)
```
for id in sofa_xxx_01 sofa_yyy_01 ...; do
  tok=$(node -e "console.log(require('crypto').randomUUID())")
  gcloud storage cp "$id.glb" "gs://pagonis-87766.firebasestorage.app/bim-mesh-library/furniture/$id.glb" --content-type="model/gltf-binary" --custom-metadata="firebaseStorageDownloadTokens=$tok" --project pagonis-87766 -q
  tokp=$(node -e "console.log(require('crypto').randomUUID())")
  gcloud storage cp "$id.png" "gs://pagonis-87766.firebasestorage.app/bim-mesh-library/furniture/thumbnails/$id.png" --content-type="image/png" --custom-metadata="firebaseStorageDownloadTokens=$tokp" --project pagonis-87766 -q
done
```
Επιβεβαίωσε token (πεδίο = **`custom_fields`**, ΟΧΙ `metadata`):
```
gcloud storage objects describe "gs://…/bim-mesh-library/furniture/<id>.glb" --project pagonis-87766 --format="value(custom_fields.firebaseStorageDownloadTokens)"
```

---

## ✏️ ΟΙ 6 ΑΛΛΑΓΕΣ ΚΩΔΙΚΑ/ΔΕΔΟΜΕΝΩΝ (i18n ΠΡΩΤΑ, N.11)

1. `src/i18n/locales/el/dxf-viewer-shell.json` **ΚΑΙ** `en/…` — namespace `furniture.catalog` (~γρ.2356, μετά τα `bedBunk01`) → +1 label ανά καναπέ. (el π.χ. «Διθέσιος καναπές»/«Τριθέσιος καναπές»/«Γωνιακός καναπές»· en «Two-seater sofa» κ.λπ.)
2. `src/subapps/dxf-viewer/bim/types/furniture-types.ts` — `FurnitureKind = 'chair' | 'table' | 'bed'` → πρόσθεσε `| 'sofa'`.
3. `src/subapps/dxf-viewer/bim/types/furniture.schemas.ts` — `FurnitureKindSchema = z.enum(['chair','table','bed'])` → `[…,'sofa']`. **(Zod enum πρέπει να καθρεφτίζει το union.)**
4. `src/subapps/dxf-viewer/bim/config/bim-to-atoe-mapping.ts` — `FURNITURE_MAPPING` είναι **exhaustive** `Record<FurnitureKind, AtoeMappingEntry>` → πρόσθεσε γραμμή `sofa: { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — καναπές (BIM)' }`. **(Ο tsc το πιάνει αν το ξεχάσεις — είναι Record.)**
5. `src/subapps/dxf-viewer/bim/furniture/furniture-catalog.ts` — `FURNITURE_CATALOG` array (SSoT). Νέο entry ανά καναπέ:
   `{ id:'sofa_xxx_01', kind:'sofa', labelKey:'furniture.catalog.sofaXxx01', widthMm, depthMm, heightMm, atoeCode:'ΟΙΚ-12', source:'Kenney (CC0)' }` — **dims = το scaled bbox από Βήμα 4** (ΟΧΙ μάντεμα).

Mesh library (ADR-411): δεν το αγγίζεις. anchor `base` (καναπές στο πάτωμα). storage.rules `bim-mesh-library/{path=**}` ΗΔΗ deployed. Enterprise IDs (`furn_*`)/persistence/BOQ/IFC: μηδέν αλλαγή.

---

## 🧾 TRACKING UPDATE (ΥΠΟΧΡΕΩΤΙΚΟ, N.15 — όλα στο τέλος)
- `ADR-410-cc0-mesh-furniture-import.md` → νέο changelog entry **v2.0** (πρότυπο το v1.9 κρεβατιών).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` → ομάδα ADR-410, νέα γραμμή «🛋️ ΚΑΝΑΠΕΔΕΣ» (πρότυπο η γραμμή κρεβατιών). **(gitignored — ΔΕΝ μπαίνει σε commit, αλλά ενημέρωσέ το.)**
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr410_cc0_furniture_import.md` (πρόσθεσε «🛋️ ΚΑΝΑΠΕΔΕΣ» παράγραφο στην κορυφή) + `MEMORY.md` index γραμμή.
- (ADR-409 ΔΕΝ χρειάζεται αλλαγή — το Kenney προστέθηκε ήδη v1.4.)

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (N.(-1))
- 🌳 **SHARED working tree με άλλον agent.** `git add` **ΜΟΝΟ** τα δικά σου αρχεία (6 κώδικα/δεδομένων + ADR-410)· **ΠΟΤΕ** `git add -A`.
  **WIP άλλου agent στο tree ΑΥΤΗ ΤΗ ΣΤΙΓΜΗ (ΜΗΝ τα πειράξεις):** ADR-412 BIM family types (`firestore.rules`, `firestore-collections.ts`, `enterprise-id-*` ×4, `bim/family-types/`, `bim-family-type.*`) + wall-types WIP (`wall-types.ts`, `wall.schemas.ts`, `wall-firestore-service.ts`, `useWallPersistence.ts`, `wall-persistence-helpers.ts`, `WallPersistenceHost.tsx`, `useWallSoftLock.ts`, `useWallTypeReresolution.ts`).
- 🐞 **ΓΝΩΣΤΟ ανοιχτό bug (ΟΧΙ δικό σου — μην το διορθώσεις):** `firestore.rules` ADR-412 block έχει **6 γραμμές σχολίων με `\` αντί `//`** (γρ. 610-612, 618-620) → ολόκληρο το ruleset δεν compile-άρει → `bim_family_types` permission error στο browser (`useBimFamilyTypes.ts:84`). Ανήκει στον agent του ADR-412. Αν ο Giorgio σε ρωτήσει: fix = `\`→`//` ×6 + `firebase deploy --only firestore:rules --project pagonis-87766`.
- 🔬 **Verify:** `npx jest "furniture"` → **23/23 PASS** (το catalog test είναι generic, δέχεται νέα entries). `npx tsc --noEmit` **με 8GB heap**: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` — **ΑΛΛΙΩΣ κάνει OOM crash και δείχνει ΨΕΥΔΩΣ «0 errors»** (μου συνέβη). Περίμενε **ακριβώς 1 error**, το γνωστό pre-existing `mesh-to-object3d.ts:124` (`matId:string` vs union, committed de57f9d5) = **ΟΧΙ regression**. Μηδέν νέα στα δικά σου.
- ⚠️ Όχι ADR-040 staging (μόνο data/types αρχεία, κανένα canvas/renderer).

---

## 📎 ΠΡΩΤΑ ΒΗΜΑΤΑ (νέα συνεδρία)
1. (Προαιρετικό RECOGNITION) διάβασε `furniture-catalog.ts` — δες πώς μπήκαν τα κρεβάτια (kind 'bed', source 'Kenney (CC0)') ως πρότυπο 1:1.
2. Κατέβασε Kenney kit → εξαγωγή (bsdtar) → `ls | grep -iE "sofa|couch|lounge"` → διάλεξε 2-4.
3. Μέτρα bbox → bake uniform scale → re-measure → validate → upload (glb+png+tokens).
4. 6 αρχεία (i18n el+en ΠΡΩΤΑ + union + schema + ΑΤΟΕ + catalog entries με scaled dims).
5. `NODE_OPTIONS=8GB tsc` (1 known error) + `jest furniture` (23/23). Update tracking (ADR-410 v2.0 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory). Σβήσε `.sofa-lib` (node fs.rmSync). Πες στον Giorgio: browser verify + commit (λίστα δικών σου αρχείων).
