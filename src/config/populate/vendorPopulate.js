export const vendorPopulate = [
  {
    path: 'address',
    select: 'completeAddress city state country pinCode landmark',
  },
  {
    path: 'wallet',
    select: 'balance currency transactions',
  },
  {
    path: 'membership',
    select: 'name description price durationInDays benefits',
  },
  {
    path: 'referredBy',
    select: 'firstName lastName email phoneNumber avatar',
  },
  {
    path: 'referredUsers',
    select: 'firstName lastName email phoneNumber avatar',
  },
  {
    path: 'services.service',
    select: 'name description basePrice',
  },
  {
    path: 'services.category',
    select: 'name description',
  },
  {
    path: 'services.childCategory',
    select: 'name description',
  },
];

export const vendorSelect = `
  -password
  -refreshToken
  -fcmToken
  -__v
  -updatedAt
  -createdAt
  -services
`;

export const vendorSelectSmall = `
  firstName 
  lastName 
  avatar 
  selfieImage 
  rating 
  phoneNumber 
  email 
  isAvailable
`;
