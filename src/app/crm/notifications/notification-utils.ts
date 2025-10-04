export const getTypeStyles = (type: string) => {
  switch(type) {
    case 'new_lead': return 'bg-blue-100 text-blue-800';
    case 'task_due': return 'bg-yellow-100 text-yellow-800';
    case 'meeting_reminder': return 'bg-purple-100 text-purple-800';
    case 'contract_signed': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getTypeLabel = (type: string) => {
  switch(type) {
    case 'new_lead': return 'Lead';
    case 'task_due': return 'Εργασία';
    case 'meeting_reminder': return 'Ραντεβού';
    case 'contract_signed': return 'Πώληση';
    default: return 'Γενικό';
  }
};
