export function calculateFinalPrice(product, coupon = null, taxRate = 0) {
  const basePrice = product.price;
  const productDiscountPrice = product.discountPrice || basePrice;

  let priceBeforeTax = productDiscountPrice;
  let couponDiscount = 0;

  // Apply coupon discount
  if (coupon) {
    if (coupon.discountType === 'percentage') {
      couponDiscount = (priceBeforeTax * coupon.discountValue) / 100;

      if (coupon.maxDiscount) {
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
      }
    } else {
      couponDiscount = coupon.discountValue;
    }

    priceBeforeTax = Math.max(0, priceBeforeTax - couponDiscount);
  }

  // Apply tax on final discounted amount
  const taxAmount = (priceBeforeTax * taxRate) / 100;
  const finalPrice = (priceBeforeTax + taxAmount)?.toFixed(2);

  return {
    basePrice,
    productDiscountPrice,
    couponCode: coupon?.code || null,
    couponDiscount,

    // NEW
    taxRate,
    taxAmount,
    priceBeforeTax,

    // Total price customer pays
    finalPrice,
  };
}

export function formatProductPricing(product, settings, coupon = null) {
  const basePrice = product.price;
  const discountPrice = product.discountPrice || basePrice;
  const discountPercentage = product.discountPercentage || 0;

  let finalPrice = discountPrice;

  let couponDiscount = 0;
  if (coupon) {
    if (coupon.discountType === 'percentage') {
      couponDiscount = (finalPrice * coupon.discountValue) / 100;
      if (coupon.maxDiscount) couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
    } else {
      couponDiscount = coupon.discountValue;
    }
    finalPrice = Math.max(finalPrice - couponDiscount, 0);
  }

  const taxAmount = ((settings.productTaxRate || 0) / 100) * finalPrice;
  const platformFee = settings.productPlatformFee || 0;
  const totalAmount = finalPrice + taxAmount + platformFee;

  return {
    basePrice,
    discountPrice,
    discountPercentage,
    couponDiscount,
    finalPrice,
    taxAmount,
    platformFee,
    totalAmount,
  };
}
