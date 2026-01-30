// Stage: Join addresses collection and filter for current address
const joinAddresses = {
  $lookup: {
    from: 'addresses',
    localField: 'addresses.address',
    foreignField: '_id',
    as: 'addressDetails',
  },
};

const unwindAddresses = { $unwind: '$addressDetails' };

const filterCurrentAddress = {
  $addFields: {
    addresses: {
      $filter: {
        input: '$addresses',
        as: 'address',
        cond: { $eq: ['$$address.isCurrent', true] },
      },
    },
  },
};

const joinWallet = {
  $lookup: {
    from: 'wallets',
    localField: 'wallet',
    foreignField: '_id',
    as: 'wallet',
  },
  $unwind: '$wallet',
};

const joinWalletWithFilter = (minBalance) => ({
  $lookup: {
    from: 'wallets',
    localField: 'wallet',
    foreignField: '_id',
    as: 'wallet',
  },
  $unwind: '$wallet',
  $match: {
    'wallet.balance': { $gte: minBalance },
  },
});

const joinServices = {
  $lookup: {
    from: 'services',
    localField: 'services',
    foreignField: '_id',
    as: 'serviceDetails',
  },
};

const filterServicesByChildrenCategory = (categoryId) => ({
  $lookup: {
    from: 'services',
    localField: 'services',
    foreignField: '_id',
    as: 'serviceDetails',
  },
  $addFields: {
    serviceDetails: {
      $filter: {
        input: '$serviceDetails',
        as: 'service',
        cond: { $eq: ['$$service.serviceChildrenCategory', categoryId] },
      },
    },
  },
  $match: {
    'serviceDetails.0': { $exists: true },
  },
  $unwind: '$serviceDetails',
});

const projectFields = {
  $project: {
    _id: 1,
    socketId: 1,
  },
};

export {
  joinAddresses,
  unwindAddresses,
  filterCurrentAddress,
  joinWallet,
  joinServices,
  projectFields,
  filterServicesByChildrenCategory,
  joinWalletWithFilter,
};
