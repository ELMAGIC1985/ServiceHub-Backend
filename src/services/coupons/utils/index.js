export function formatCoupon(coupon) {
  if (!coupon) return null;

  const isPercentage = coupon.discountType === 'percentage';

  return {
    id: coupon._id,
    code: coupon.code,
    discount: isPercentage ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`,
    discountType: coupon.discountType,
    maxDiscount: coupon.maxDiscount,
    discountValue: coupon.discountValue,
    isFlatDiscount: !isPercentage,
  };
}
