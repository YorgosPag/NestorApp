# Άδειες επαναχρησιμοποίησης δημόσιων δεδομένων — αποδεικτικά

Κάθε `.eml` εδώ είναι το **πρωτότυπο** μήνυμα (RAW, με την υπογραφή DKIM του αποστολέα), όχι αντίγραφο κειμένου.

⚠️ Τα `.eml` **ΔΕΝ μπαίνουν στο git** (`.gitignore`): περιέχουν προσωπικά στοιχεία (ονόματα, τηλέφωνα, email υπαλλήλων και του Giorgio).
Ζουν μόνο στον δίσκο και στο backup zip (`enterprise-backup.ps1`). Αν χαθούν, το πρωτότυπο παραμένει στο Gmail του `georgios.pagonis@gmail.com`.

| Ημερομηνία | Φορέας | Σύνολο δεδομένων | Άδεια | Αρχείο | ADR |
|---|---|---|---|---|---|
| 2026-09-28 | ΥΠΕΘΟΟ — ΑΤΕΠΑΑ (`atepaa@minfin.gr`, DKIM `minfin.gr`) | Μητρώο Αξιών Μεταβιβάσεων Ακινήτων — [data.gov.gr](https://data.gov.gr/dataset/mitroo-axion-metavivaseon-akiniton) · [πόρος](https://data.gov.gr/dataset/mitroo-axion-metavivaseon-akiniton/resource/f6f66e8d-8ff6-4bb7-9cfb-da4282893083) | **CC-BY 4.0**, ρητά και εμπορική χρήση | `2026-09-28_ATEPAA-YPETHOO_adeia-CC-BY_mitroo-metavivaseon-zones.eml` | ADR-889 §2.1 |
| 2026-09-28 | ΥΠΕΘΟΟ — ΑΤΕΠΑΑ (ίδιο μήνυμα) | Ζώνες αντικειμενικών αξιών (valuemaps), **shapefiles** ως 2ος πόρος — [data.gov.gr](https://data.gov.gr/dataset/geochoriki-apeikonisi-zonon-systimatos-antikeimenikoy-prosdiorismoy-axion-akiniton-kai-ypologismos-a) | CC-BY 4.0 | ίδιο | ADR-889 §2.3 |
| 2026-09-29 | DB-IP.com (δημοσιευμένοι όροι — **κανένα** μήνυμα) | IP to City Lite, MMDB, μηνιαία — [db-ip.com](https://db-ip.com/db/download/ip-to-city-lite) | **CC-BY 4.0**· όρος του κυρίου: **σύνδεσμος προς το DB-IP.com** σε κάθε σελίδα που δείχνει ή χρησιμοποιεί αποτελέσματα | — (δημόσια σελίδα λήψης, ελέγχθηκε 2026-09-29) | ADR-894 |

## Υποχρεώσεις CC-BY 4.0
1. **Αναφορά πηγής**: ΥΠΕΘΟΟ + σύνδεσμος στο σύνολο δεδομένων + σύνδεσμος στην άδεια.
2. **Δήλωση αλλαγών**: τα δεδομένα εμφανίζονται επεξεργασμένα (συγκεντρωτικά, διάμεσοι, αντιστοίχιση περιοχών).

## Τι δηλώσαμε στο αίτημα (2026-09-26)
Μόνο συγκεντρωτικά στατιστικά ανά Δημοτική Ενότητα (διάμεσος €/τ.μ., πλήθος), **ελάχιστο 5 συναλλαγές ανά ένδειξη**.
