import { ServiceCategory } from '../types/service';

export const INITIAL_SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'electrician',
    titleEn: 'Electrician',
    titleHi: 'बिजली मिस्त्री',
    descEn: 'Fan, wiring, switchboard & light repair',
    descHi: 'पंखा, वायरिंग, स्विचबोर्ड और लाइट सुधार',
    iconName: 'zap',
    baseVisitFee: 99.00,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'plumber',
    titleEn: 'Plumber',
    titleHi: 'नल / प्लंबर',
    descEn: 'Tap leakage, pipe fittings & water tank',
    descHi: 'नल लीकेज, पाइप फिटिंग और पानी टंकी',
    iconName: 'droplet',
    baseVisitFee: 99.00,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'appliance-repair',
    titleEn: 'Appliance Repair',
    titleHi: 'घरेलू उपकरण रिपेयर',
    descEn: 'Fridge, washing machine & TV repair',
    descHi: 'फ्रिज, वाशिंग मशीन और टीवी रिपेयर',
    iconName: 'tv',
    baseVisitFee: 149.00,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'ac-cooler',
    titleEn: 'AC / Cooler Technician',
    titleHi: 'कूलर / AC मिस्त्री',
    descEn: 'Cooler motor, water pump & AC servicing',
    descHi: 'कूलर मोटर, वाटर पंप और AC सर्विसिंग',
    iconName: 'wind',
    baseVisitFee: 149.00,
    isActive: true,
    sortOrder: 4
  },
  {
    id: 'bike-mechanic',
    titleEn: 'Bike / Auto Mechanic',
    titleHi: 'बाइक / गाड़ी मैकेनिक',
    descEn: 'Two-wheeler puncture, servicing & starting issues',
    descHi: 'दोपहिया पंचर, सर्विसिंग और स्टार्ट समस्या',
    iconName: 'tool',
    baseVisitFee: 99.00,
    isActive: true,
    sortOrder: 5
  }
];
