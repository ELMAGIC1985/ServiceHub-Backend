export const formatRating = (rating) => {
  if (!rating) return null;

  const formattedDate = new Date(rating.createdAt).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    id: rating._id,
    itemId: rating.itemId,
    itemType: rating.itemType,
    rating: rating.rating,
    comment: rating.comment || '',
    helpfulCount: rating.helpfulCount,
    notHelpfulCount: rating.notHelpfulCount,
    verifiedPurchase: rating.verifiedPurchase,
    images: rating.images || [],
    createdAt: formattedDate,

    user: rating.userId
      ? {
          id: rating.userId._id,
          name: rating.userId.name,
          email: rating.userId.email,
          firstName: rating.userId.firstName,
          lastName: rating.userId.lastName,
          avatar: rating.userId.selfieImage,
          type: rating.userType,
        }
      : null,
  };
};
