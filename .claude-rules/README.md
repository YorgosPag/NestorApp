# .claude-rules — Persistent Rules for Claude AI Sessions

Αυτός ο φάκελος περιέχει **μόνιμους κανόνες συμπεριφοράς** που έχει δώσει ο Γιώργος στον Claude
κατά τη διάρκεια sessions. Αντικαθιστά το `C:\Users\user\.claude\projects\C--Nestor-Pagonis\memory\`
που ήταν user-specific και **ΔΕΝ** ήταν git-tracked.

## Γιατί project-level (εδώ) αντί user-level;

| Παράγοντας | User folder | Project folder (εδώ) |
|---|---|---|
| Git-tracked | ❌ | ✅ |
| Backup με ZIP | ❌ | ✅ |
| Ακολουθεί clone σε άλλο PC | ❌ | ✅ |
| Ορατό στον Γιώργο | ⚠️ Κρυφό | ✅ Ανοιχτό |
| Επεξεργασία χωρίς τερματικό | ⚠️ | ✅ |

## Πώς χρησιμοποιείται

Ο Claude διαβάζει αυτόν τον φάκελο **στην αρχή κάθε session** (per CLAUDE.md SOS. N.0.0).

- **`MEMORY.md`** — Ο πίνακας περιεχομένων (entries σε ~150 χαρακτήρες)
- **`feedback_*.md`** — Συγκεκριμένοι κανόνες συμπεριφοράς/εργασίας
- **`project_*.md`** — Εν εξελίξει εργασίες / pending items

## Κατηγορίες

### Quality Standards
- Google-level quality expectations
- No hardcoded strings / SSoT enforcement
- File size / SRP rules

### Workflow
- ADR-driven development (4 phases)
- Commit / push rules (NEVER push without explicit order)
- AI pipeline testing enforcement

### Project State
- Pending work per domain
- Known issues / decisions
- Current initiatives

## Προσθήκη νέου κανόνα

1. Δημιούργησε `feedback_<topic>.md` με frontmatter (name, description, type)
2. Πρόσθεσε entry στο `MEMORY.md` (max 150 χαρακτήρες)
3. Commit μαζί με την αλλαγή που οδήγησε στον κανόνα

## Προσοχή

- Κρατάς μόνο **επαναλαμβανόμενους** κανόνες — όχι one-off tasks
- Σεβάσου το όριο των 200 γραμμών στο `MEMORY.md` (μετά truncated)
- Update stale memories (αν αλλάξει ο κανόνας)
