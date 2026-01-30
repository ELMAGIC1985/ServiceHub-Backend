export const bookingPopulate = [
  {
    path: 'user',
    select: 'firstName lastName email phoneNumber userName avatar',
  },
  {
    path: 'serviceTemplate',
    select: 'title description basePrice',
  },
  {
    path: 'category',
    select: 'name description',
  },
  {
    path: 'subCategory',
    select: 'name description',
  },
  {
    path: 'address',
    select: 'completeAddress city state country pinCode landmark location',
  },
  {
    path: 'vendorSearch.assignedVendor.vendorId',
    select: 'firstName lastName rating email phoneNumber selfieImage ratings',
    model: 'Vendor',
    as: 'vendor',
  },
  {
    path: 'product',
    select: 'name description price',
  },
];

export const bookingSelect = `
  -notifications 
  -statusHistory 
  -vendorSearch.eligibleVendors 
  -metadata 
  -timing
`;
