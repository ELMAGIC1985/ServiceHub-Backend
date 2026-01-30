import Order from '../../models/order.model.js';

const createOrderDetails = async (req, res) => {
  const {
    orderId,
    userId,
    productName,
    deliverySlot,
    address,
    productPrice,
    status,
    quantity,
    boughtUser,
    paymentStatus,
    orderDate,
    paymentDate,
    deliveredDate,
    regionAddress,
    District,
    orderStatus,
    productCategory,
  } = req.body;

  const newOrder = new Order({
    orderId,
    userId,
    productName,
    deliverySlot,
    address,
    productPrice,
    status,
    quantity,
    boughtUser,
    paymentStatus,
    orderDate,
    paymentDate,
    deliveredDate,
    regionAddress,
    District,
    orderStatus,
    productCategory,
  });
  try {
    const orderDetails = await newOrder.save();
    if (orderDetails) {
      return res.status(200).json({ orderDetails });
    } else {
      return res.json({ message: 'Failed to create your order' });
    }
  } catch (error) {
    return res.status(400).json({ message: 'Error in creating the order', error });
  }
};

const getAllOrderDetails = async (req, res) => {
  try {
    const { category } = req.params; // Destructure category correctly from req.params
    const orders = await Order.find({ category: category }); // Use find() method, not findAll()
    res.json(orders); // Send the found orders as a JSON response
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (order) {
      res.json(order); // Send the order with the specified orderId
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id; // Get the order ID from the request params
    const statusUpdate = req.params.newStatus; // Get the new status from the request params

    // Find the order by its ID and update its status
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId }, // Search for the order by ID
      { status: statusUpdate }, // The new status value to update
      { new: true } // Return the updated document
    );

    // If the order was not found, return an error response
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Return the updated order in the response
    res.status(200).json({ messasge: 'Your Order Updated', updatedOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getBookingLocation = async (req, res) => {
  try {
    const { address, pinCode } = req.body;

    if (!address || !pinCode) {
      return res.status(400).json({ message: 'Address and pin code are required' });
    }

    const fullAddress = `${address}, ${pinCode}`;
    const encodedAddress = encodeURIComponent(fullAddress);
    const googleMapsUrl = `https://www.google.com/maps?q=${encodedAddress}`;
    res.status(200).json({ googleMapsLink: googleMapsUrl });
  } catch (error) {
    res.status(400).json(error);
  }
};

export { getOrderDetails, getAllOrderDetails, createOrderDetails, updateOrderDetails, getBookingLocation };
