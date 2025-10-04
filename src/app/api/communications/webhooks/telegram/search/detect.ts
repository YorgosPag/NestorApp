// /home/user/studio/src/app/api/communications/webhooks/telegram/search/detect.ts

export async function isPropertySearchQuery(text: string): Promise<boolean> {
  const propertyKeywords = [
    'διαμέρισμα', 'σπίτι', 'κατοικία', 'μεζονέτα', 'στούντιο', 'γκαρσονιέρα',
    'δωμάτια', 'υπνοδωμάτια', 'τιμή', 'ευρώ', '€', 'ενοικίαση', 'πώληση',
    'όροφος', 'τετραγωνικά', 'τ.μ', 'κέντρο', 'περιοχή', 'θέλω', 'ψάχνω',
    'βρες', 'δείξε', 'υπάρχει', 'available', 'διαθέσιμο', 'κτίριο', 'έργο',
    'parking', 'πάρκινγκ', 'αποθήκη', 'apartment', 'store', 'maisonette'
  ];

  const lowerText = text.toLowerCase();
  return propertyKeywords.some(keyword => lowerText.includes(keyword));
}
