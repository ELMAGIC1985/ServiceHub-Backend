export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  console.log(lat1, lon1, lat2, lon2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
};

export const getProfileStatus = (user) => {
  const requiredFields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phoneNumber', label: 'Phone Number' },
  ];

  const missingFields = requiredFields
    .filter((field) => {
      if (!user[field.key]) return true;
      if (typeof user[field.key] === 'string' && user[field.key].trim() === '') return true;
      if (Array.isArray(user[field.key]) && user[field.key].length === 0) return true;
      return false;
    })
    .map((field) => field.label);

  const completionPercentage = ((requiredFields.length - missingFields.length) / requiredFields.length) * 100;

  return {
    profileCompleted: true,
    completionPercentage: Math.round(completionPercentage),
    missingFields,
  };
};

export const formatMembershipData = (membershipDoc, planDoc) => {
  if (!membershipDoc) return null;

  return {
    membershipId: membershipDoc._id.toString(),
    status: membershipDoc.status,
    startDate: membershipDoc.startDate,
    endDate: membershipDoc.endDate,
    autoRenew: membershipDoc.autoRenew,
    membershipUsage: membershipDoc?.membershipUsage?.toFixed(0),
    payment: membershipDoc.paymentDetails
      ? {
          method: membershipDoc.paymentDetails.paymentMethod,
          transactionId: membershipDoc.paymentDetails.transactionId,
          amountPaid: membershipDoc.paymentDetails.amountPaid,
        }
      : null,
    plan: planDoc
      ? {
          planId: planDoc._id.toString(),
          name: planDoc.name,
          price: planDoc.price,
          durationInDays: planDoc.durationInDays,
          benefits: planDoc.benefits,
        }
      : null,
  };
};
