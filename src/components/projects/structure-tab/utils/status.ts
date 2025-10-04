
export const getStatusColor = (status: string) => {
  switch (status) {
    case "sold": return "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
    case "reserved": return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400";
    case "for-sale": return "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400";
    case "for-rent": return "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400";
    case "rented": return "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400";
    default: return "text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-300";
  }
};

export const getStatusText = (status: string) => {
  const labels: Record<string, string> = {
    "for-sale": "Προς Πώληση",
    "sold": "Πουλημένο",
    "for-rent": "Προς Ενοικίαση",
    "rented": "Ενοικιασμένο",
    "reserved": "Κρατημένο",
  };
  return labels[status] ?? status;
};
