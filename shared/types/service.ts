export interface ServiceCategory {
  id: string;
  titleEn: string;
  titleHi: string;
  descEn: string | null;
  descHi: string | null;
  iconName: string;
  baseVisitFee: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ChandilLocality {
  id: string;
  nameEn: string;
  nameHi: string;
  pincode: string;
  isPopular: boolean;
}
