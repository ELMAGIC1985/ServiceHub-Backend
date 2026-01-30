export function transformQrDataToOrder(qrData) {
  if (!qrData || typeof qrData !== 'object') return null;

  const { id, created_at, payment_amount, description, notes, image_url } = qrData;

  return {
    amount: payment_amount || 0,
    amount_due: payment_amount || 0,
    amount_paid: 0,
    attempts: 0,
    created_at,
    currency: 'INR',
    entity: 'order',
    id: `order_${id.replace('qr_', '')}`, // creating synthetic order ID
    image_url,
    notes: {
      created_at: notes?.created_at || new Date().toISOString(),
      orderId: notes?.orderId,
      orderType: notes?.orderType,
      transactionId: notes?.transactionId,
      type: notes?.type,
      userId: notes?.userId,
      userType: notes?.userType,
    },
    offer_id: null,
    receipt: notes?.receipt || description?.replace('Payment for ', '') || null,
    status: 'created',
  };
}
