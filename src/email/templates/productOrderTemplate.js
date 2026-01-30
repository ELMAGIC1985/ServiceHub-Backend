export const ORDER_CREATED_TEMPLATE = (orderId, userName, products, totalAmount) => {
  const productList = products
    .map((product) => {
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${product.productName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${product.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${product.price}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${(product.quantity * product.price).toFixed(
            2
          )}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Created - ${orderId}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(to right, #4CAF50, #45a049);
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #888;
      font-size: 0.8em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    table, th, td {
      border: 1px solid #ddd;
    }
    th, td {
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    .total {
      margin-top: 15px;
      text-align: right;
      font-size: 1.2em;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Order Created - ${orderId}</h1>
  </div>
  <div class="content">
    <p>Hello ${userName},</p>
    <p>Thank you for your order! Your order has been successfully created. Below are the details of the products you've ordered:</p>

    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${productList}
      </tbody>
    </table>

    <div class="total">
      <p>Total Amount: ₹${totalAmount}</p>
    </div>

    <p>If you have any questions, feel free to contact our support team.</p>
    <p>Best regards,<br>Your App Team</p>
  </div>
  <div class="footer">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
  `;
};
