import { Mail, Send, FileText, Users, Calendar } from "lucide-react";
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

export const emailTemplates = (fullName?: string) => ([
  { id: "welcome",    name: "Welcome Email",     icon: Users,    description: "Καλωσόρισμα νέου lead", defaultSubject: `Καλώς ήρθατε ${fullName || ""}!` },
  { id: "followup",   name: "Follow-up",         icon: Mail,     description: "Follow-up επικοινωνία", defaultSubject: "Follow-up για το ενδιαφέρον σας" },
  { id: "appointment",name: "Ραντεβού",          icon: Calendar, description: "Προγραμματισμός/επιβεβαίωση ραντεβού", defaultSubject: "Προγραμματισμός Ραντεβού" },
  { id: "proposal",   name: "Πρόταση Ακινήτου",  icon: NAVIGATION_ENTITIES.unit.icon, description: "Αποστολή πρότασης ακινήτου", defaultSubject: "Πρόταση Ακινήτου" },
  { id: "custom",     name: "Προσαρμοσμένο",     icon: FileText, description: "Δικό σας κείμενο", defaultSubject: "" },
]);

export const getTemplateContent = (templateId: string, fullName?: string) => {
  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "210-1234567";
  const map: Record<string,string> = {
    welcome: `Αγαπητέ/ή ${fullName || ''},\n\nΣας ευχαριστούμε για το ενδιαφέρον σας για τις υπηρεσίες μας!\n\nΈνας σύμβουλός μας θα επικοινωνήσει μαζί σας σύντομα για να συζητήσουμε τις ανάγκες σας και να σας βοηθήσουμε να βρείτε το ιδανικό ακίνητο.\n\nΓια άμεση εξυπηρέτηση, μπορείτε να μας καλέσετε στο ${phone}.\n\nΜε εκτίμηση,\nΗ ομάδα μας`,
    followup: `Αγαπητέ/ή ${fullName || ''},\n\nΘα θέλαμε να επικοινωνήσουμε μαζί σας σχετικά με το ενδιαφέρον σας για ακίνητα.\n\nΈχουμε κάποιες νέες προτάσεις που πιστεύουμε ότι θα σας ενδιαφέρουν.\n\nΠαρακαλώ επικοινωνήστε μαζί μας για να συζητήσουμε περισσότερο.\n\nΜε εκτίμηση,\nΗ ομάδα μας`,
    appointment: `Αγαπητέ/ά ${fullName || ''},\n\nΘα θέλαμε να προγραμματίσουμε ένα ραντεβού μαζί σας.\n\nΗμερομηνία: [Εισάγετε ημερομηνία]\nΏρα: [Εισάγετε ώρα]\nΤοποθεσία: [Εισάγετε τοποθεσία]\n\nΠαρακαλώ επιβεβαιώστε τη διαθεσιμότητά σας.\n\nΜε εκτίμηση,\nΗ ομάδα μας`,
    proposal: `Αγαπητέ/ά ${fullName || ''},\n\nΣας στέλνουμε πρόταση για ακίνητο που πιστεύουμε ότι θα σας ενδιαφέρει:\n\n📍 Περιοχή: [Εισάγετε περιοχή]\n🏠 Τύπος: [Εισάγετε τύπο]\n💰 Τιμή: €[Εισάγετε τιμή]\n📐 Εμβαδόν: [Εισάγετε εμβαδόν] τ.μ.\n\n[Περιγραφή ακινήτου]\n\nΓια περισσότερες πληροφορίες και προγραμματισμό ξενάγησης, παρακαλώ επικοινωνήστε μαζί μας.\n\nΜε εκτίμηση,\nΗ ομάδα μας`,
    custom: ``,
  };
  return map[templateId] ?? "";
};
