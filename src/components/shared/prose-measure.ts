/**
 * **Το μέτρο πρόζας ως κλάση** — το ΕΝΑ σημείο όπου το token `--spacing-layout-measure-prose` γίνεται `max-width`.
 *
 * @related design-tokens.json (`spacing.layout.measure.prose`) · app/shell-surface.css (`--shell-measure`) ·
 *   components/search/LandingDoors · components/demand/interest-check/OwnerInterestEntry
 * @module components/shared/prose-measure
 *
 * ⚠️ **Η ΚΑΡΤΑ ΑΠΛΩΝΕΙ, Η ΓΡΑΜΜΗ ΟΧΙ** (ADR-820 §5.4.1): κάρτες που πιάνουν όλο το πλάτος (πόρτες της αρχικής ·
 * κάρτα ιδιοκτήτη κάτω από λίστα + χάρτη στα «Τα ακίνητά μου») φτάνουν >1000px. Το κείμενο βοήθειας κρατά το μέτρο
 * **πρόζας**, σε `ch` της δικής του γραμματοσειράς — WCAG 1.4.8 / Bringhurst. Ποτέ δεύτερος χειρόγραφος αριθμός.
 *
 * 🔴 **ΓΙΑΤΙ ΕΓΙΝΕ ΚΟΙΝΟ (ADR-900 §3.7)**: ζούσε ως ιδιωτική σταθερά του `LandingDoors`. Η κάρτα του ιδιοκτήτη
 * μπήκε και στα «Τα ακίνητά μου», όπου η σελίδα ζητά πλήρες πλάτος για τον χάρτη — και ο ζωντανός έλεγχος έδειξε
 * το κείμενο σε **μία γραμμή** σε όλο το πλάτος. Δεύτερο αντίγραφο της τιμής θα απέκλινε στην πρώτη αλλαγή.
 */
export const PROSE_MEASURE_CLASS = 'max-w-[calc(var(--spacing-layout-measure-prose)*1ch)]';
