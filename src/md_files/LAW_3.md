✅ Μόνο αναφορά (safe)
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\Pagonis_Nestor\src\subapps\dxf-viewer\nekro.ps1" -Root "F:\Pagonis_Nestor\src\subapps\dxf-viewer"


(Θα φτιάξει deadcode-report.json και αναλυτικούς φακέλους reports\deadcode\....)

✅ Safe apply (καθαρίζει ΜΟΝΟ πραγματικά αχρησιμοποίητα imports)
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\Pagonis_Nestor\src\subapps\dxf-viewer\nekro.ps1" -Root "F:\Pagonis_Nestor\src\subapps\dxf-viewer" -ApplySafe


Το nekro.ps1 θα δημιουργήσει αυτόματα το
F:\Pagonis_Nestor\src\subapps\dxf-viewer\scripts\remove-unused-imports.js (αν δεν υπάρχει).

🎯 “Όλα-σε-ένα” (αν θες να τελειώνει γρήγορα)

Κάνει commit τυχόν αλλαγές, μετά τρέχει Safe apply:

cd "F:\Pagonis_Nestor\src\subapps\dxf-viewer" ;
git add -A && git commit -m "wip: before nekro" ;
powershell -NoProfile -ExecutionPolicy Bypass -File ".\nekro.ps1" -Root "." -ApplySafe

💡 Αν το τρέχεις από pwsh (PowerShell 7+)
pwsh -NoProfile -File "F:\Pagonis_Nestor\src\subapps\dxf-viewer\nekro.ps1" -Root "F:\Pagonis_Nestor\src\subapps\dxf-viewer" -ApplySafe

🛠️ Αν φας μήνυμα για Execution Policy
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass


και ξανατρέχεις μία από τις παραπάνω εντολές.

Μικρή υπενθύμιση: το script σταματά αν το working tree δεν είναι καθαρό. Αν δεν θες να κάνεις commit, κάνε:

git stash -u


και μετά τρέξε την εντολή.

Πάτα γκάζι — θα σου βγάλει report πρώτα και, αν ζητήσεις apply, θα πειράξει μόνο ό,τι είναι 100% safe (imports).