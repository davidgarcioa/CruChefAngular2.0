export interface Restaurant {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  schedule: string;
  rut?: string;
  rutFileName?: string;
  rutFileType?: string;
  rutFileSize?: number;
  verificationStatus: 'pending' | 'verified';
}
