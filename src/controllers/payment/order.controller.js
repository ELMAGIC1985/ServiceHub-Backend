import mongoose from 'mongoose';
import Order from '../../models/order.model.js';
import { ApiError } from '../../utils/index.js';

const getAllOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      orderStatus,
      paymentStatus,
      userType,
      userId,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const filter = {};

    // Status filters
    if (orderStatus && orderStatus.toLowerCase() !== 'all') {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus && paymentStatus.toLowerCase() !== 'all') {
      filter['payment.paymentStatus'] = paymentStatus;
    }

    // User filters
    if (userType && userType.toLowerCase() !== 'all') {
      filter.userType = userType;
    }

    if (userId && userId.toLowerCase() !== 'all' && mongoose.Types.ObjectId.isValid(userId)) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom && dateFrom !== '') {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo && dateTo !== '') {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Search filter
    if (search && search.trim() !== '') {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'payment.transactionId': { $regex: search, $options: 'i' } },
        { 'payment.razorpayOrderId': { $regex: search, $options: 'i' } },
      ];
    }

    // Count total documents
    const totalOrders = await Order.countDocuments(filter);

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Fetch orders
    const orders = await Order.find(filter)
      .populate('userId', 'firstName lastName email phoneNumber businessName')
      .populate('products.product', 'name category price')
      .populate('address')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    // Enhance orders
    const enhancedOrders = orders.map((order) => ({
      ...order,
      formattedAmount: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(order.totalAmount),
      formattedDate: new Date(order.createdAt).toLocaleDateString(),
      customerName: order.userId?.firstName
        ? `${order.userId.firstName} ${order.userId.lastName || ''}`.trim()
        : order.userId?.businessName || 'Unknown Customer',
      productCount: order.products?.length || 0,
      orderAge: Math.floor((new Date() - new Date(order.createdAt)) / (24 * 60 * 60 * 1000)),
    }));

    // Pagination info
    const totalPages = Math.ceil(totalOrders / limitNum);

    // Statistics
    const stats = await Promise.all([
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: 'delivered' }),
      Order.countDocuments({ 'payment.paymentStatus': 'paid' }),
      Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { 'payment.paymentStatus': 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const responseData = {
      orders: enhancedOrders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        limit: limitNum,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
      statistics: {
        total: totalOrders,
        pending: stats[0],
        delivered: stats[1],
        paid: stats[2],
        byStatus: stats[3],
        revenue: stats[4][0]?.totalRevenue || 0,
      },
    };

    res.status(200).json({
      success: true,
      data: responseData,
      message: `Retrieved ${enhancedOrders.length} order(s) successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    return next(new ApiError(500, 'Failed to fetch orders', error.message));
  }
};

const getVendorOrders = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const requestingUser = req.user;

    // If no vendorId provided, use requesting user's ID
    const targetVendorId = vendorId || requestingUser._id;

    // Authorization check
    const isAdmin = requestingUser.role === 'admin';
    const isVendor = requestingUser.role === 'vendor' && requestingUser._id.toString() === targetVendorId.toString();

    if (!isAdmin && !isVendor) {
      return next(new ApiError(403, 'Access denied. Vendors can only view their own orders.'));
    }

    const {
      page = 1,
      limit = 10,
      orderStatus,
      paymentStatus,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build filter for vendor orders
    const filter = {
      userId: new mongoose.Types.ObjectId(targetVendorId),
      userType: 'Vendor',
    };

    // Apply additional filters
    if (orderStatus && orderStatus !== 'all') {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      filter['payment.paymentStatus'] = paymentStatus;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const totalOrders = await Order.countDocuments(filter);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const orders = await Order.find(filter)
      .populate('userId', 'firstName lastName email phoneNumber businessName')
      .populate('products.product', 'name category price description images')
      .populate('address')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    // Helper function to format currency
    const formatCurrency = (amount) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(amount);

    // Enhance orders with same structure as getOrderById
    const enhancedOrders = orders.map((order) => {
      const orderAge = Math.floor((new Date() - new Date(order.createdAt)) / (24 * 60 * 60 * 1000));

      const customerName = order.userId?.firstName
        ? `${order.userId.firstName} ${order.userId.lastName || ''}`.trim()
        : order.userId?.businessName || 'Unknown Customer';

      const enhancedProducts =
        order.products?.map((item) => {
          const productData = item.product;
          const itemTotal = item.price * item.quantity;

          if (!productData) return;

          return {
            _id: productData._id,
            name: productData.name || item.productName,
            category: productData.category,
            description: productData.description,
            image: productData.images?.[0] || null,
            images: productData.images || [],
            price: item.price,
            formattedPrice: formatCurrency(item.price),
            quantity: item.quantity,
            total: itemTotal,
            formattedTotal: formatCurrency(itemTotal),
          };
        }) || [];

      const statusFlags = {
        canCancel: ['pending', 'confirmed'].includes(order.orderStatus),
        canShip: order.orderStatus === 'confirmed',
        canDeliver: order.orderStatus === 'shipped',
        isPaid: order.payment?.paymentStatus === 'paid',
        isCompleted: order.orderStatus === 'delivered',
      };

      return {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        userType: order.userType,
        deliverySlot: order.deliverySlot,

        totalAmount: order.totalAmount,
        formattedAmount: formatCurrency(order.totalAmount),

        products: enhancedProducts,
        productCount: enhancedProducts.length,

        customer: {
          _id: order.userId._id,
          name: customerName,
          email: order.userId.email,
          phoneNumber: order.userId.phoneNumber,
          businessName: order.userId.businessName,
        },

        address: order.address,
        payment: order.payment,

        timestamps: order.timestamps,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,

        formattedDate: new Date(order.createdAt).toLocaleDateString('en-IN'),
        orderAge,
        statusFlags,
      };
    });

    const totalPages = Math.ceil(totalOrders / limitNum);

    res.status(200).json({
      success: true,
      data: {
        orders: enhancedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      message: `Retrieved ${enhancedOrders.length} order(s) successfully`,
    });
  } catch (error) {
    console.error('Error fetching vendor orders:', error);
    return next(new ApiError(500, 'Failed to fetch vendor orders', error.message));
  }
};

const getUserOrders = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    const targetUserId = userId || requestingUser._id;

    const isAdmin = requestingUser.role === 'admin';
    const isUser = requestingUser.role === 'user' && requestingUser._id.toString() === targetUserId.toString();

    if (!isAdmin && !isUser) {
      return next(new ApiError(403, 'Access denied. Users can only view their own orders.'));
    }

    const {
      page = 1,
      limit = 10,
      orderStatus,
      paymentStatus,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build filter for user orders
    const filter = {
      userId: new mongoose.Types.ObjectId(targetUserId),
      userType: 'User',
    };

    // Apply additional filters
    if (orderStatus && orderStatus !== 'all') {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      filter['payment.paymentStatus'] = paymentStatus;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const totalOrders = await Order.countDocuments(filter);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const orders = await Order.find(filter)
      .populate('userId', 'firstName lastName email phoneNumber')
      .populate('products.product', 'name category price description images')
      .populate('address')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    // Helper function to format currency
    const formatCurrency = (amount) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(amount);

    // Enhance orders with same structure as getOrderById

    const enhancedOrders = orders.map((order) => {
      const orderAge = Math.floor((new Date() - new Date(order.createdAt)) / (24 * 60 * 60 * 1000));

      const customerName = order.userId?.firstName
        ? `${order.userId.firstName} ${order.userId.lastName || ''}`.trim()
        : 'Unknown User';

      console.log('order', order);

      if (!order.products) return;

      const enhancedProducts =
        order.products?.map((item) => {
          if (!item.product) return;
          const productData = item.product;
          const itemTotal = item.price * item.quantity;

          return {
            _id: productData._id,
            name: productData.name || item.productName,
            category: productData.category,
            description: productData.description,
            image: productData.images?.[0] || null,
            images: productData.images || [],
            price: item.price,
            formattedPrice: formatCurrency(item.price),
            quantity: item.quantity,
            total: itemTotal,
            formattedTotal: formatCurrency(itemTotal),
          };
        }) || [];

      const statusFlags = {
        canCancel: ['pending', 'confirmed'].includes(order.orderStatus),
        canReorder: order.orderStatus === 'delivered',
        canTrack: ['confirmed', 'shipped'].includes(order.orderStatus),
        isPaid: order.payment?.paymentStatus === 'paid',
        isCompleted: order.orderStatus === 'delivered',
        canReturn: order.orderStatus === 'delivered' && orderAge <= 7, // 7 days return policy
      };

      return {
        _id: order._id,
        orderSeq: order.orderIdSeq,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        userType: order.userType,
        deliverySlot: order.deliverySlot,

        totalAmount: order.totalAmount,
        formattedAmount: formatCurrency(order.totalAmount),

        products: enhancedProducts,
        productCount: enhancedProducts.length,

        customer: {
          _id: order.userId._id,
          name: customerName,
          email: order.userId.email,
          phoneNumber: order.userId.phoneNumber,
        },

        address: order.address,
        payment: order.payment,

        timestamps: order.timestamps,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,

        formattedDate: new Date(order.createdAt).toLocaleDateString('en-IN'),
        orderAge,
        statusFlags,
      };
    });

    const totalPages = Math.ceil(totalOrders / limitNum);

    res.status(200).json({
      success: true,
      data: {
        orders: enhancedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      message: `Retrieved ${enhancedOrders.length} order(s) successfully`,
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return next(new ApiError(500, 'Failed to fetch user orders', error.message));
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const requestingUser = req.user;

    // Find order with enhanced product population to include images
    const order = await Order.findById(orderId)
      .populate('userId', 'firstName lastName email phoneNumber businessName')
      .populate('products.product', 'name category price description images') // Added images field
      .populate('address')
      .lean()
      .exec();

    if (!order) {
      return next(new ApiError(404, 'Order not found'));
    }

    // Authorization check
    const isAdmin = requestingUser.role === 'admin';
    const isOwner = order.userId._id.toString() === requestingUser._id.toString();

    if (!isAdmin && !isOwner) {
      return next(new ApiError(403, 'Access denied. You can only view your own orders.'));
    }

    // Helper function to format currency
    const formatCurrency = (amount) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(amount);

    // Calculate order age in days
    const orderAge = Math.floor((new Date() - new Date(order.createdAt)) / (24 * 60 * 60 * 1000));

    // Determine customer name
    const customerName = order.userId?.firstName
      ? `${order.userId.firstName} ${order.userId.lastName || ''}`.trim()
      : order.userId?.businessName || 'Unknown Customer';

    // Enhanced product details with optimized data structure
    const enhancedProducts =
      order.products?.map((item) => {
        const productData = item.product; // This is populated data
        const itemTotal = item.price * item.quantity;

        return {
          _id: productData._id,
          name: productData.name || item.productName, // Fallback to stored name
          category: productData.category,
          description: productData.description,
          image: productData.images?.[0] || null, // Primary image
          images: productData.images || [], // All images
          price: item.price,
          formattedPrice: formatCurrency(item.price),
          quantity: item.quantity,
          total: itemTotal,
          formattedTotal: formatCurrency(itemTotal),
        };
      }) || [];

    // Status flags for UI conditional rendering
    const statusFlags = {
      canCancel: ['pending', 'confirmed'].includes(order.orderStatus),
      canShip: order.orderStatus === 'confirmed',
      canDeliver: order.orderStatus === 'shipped',
      isPaid: order.payment?.paymentStatus === 'paid',
      isCompleted: order.orderStatus === 'delivered',
    };

    // Clean response structure
    const response = {
      // Basic order info
      _id: order._id,
      orderId: order.orderId,
      orderStatus: order.orderStatus,
      userType: order.userType,
      deliverySlot: order.deliverySlot,

      // Financial details
      totalAmount: order.totalAmount,
      formattedAmount: formatCurrency(order.totalAmount),

      // Products (enhanced)
      products: enhancedProducts,
      productCount: enhancedProducts.length,

      // Customer details
      customer: {
        _id: order.userId._id,
        name: customerName,
        email: order.userId.email,
        phoneNumber: order.userId.phoneNumber,
        businessName: order.userId.businessName,
      },

      // Address
      address: order.address,

      // Payment details
      payment: order.payment,

      // Timestamps
      timestamps: order.timestamps,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      // Computed fields
      formattedDate: new Date(order.createdAt).toLocaleDateString('en-IN'),
      orderAge,

      // Status flags for frontend
      statusFlags,
    };

    res.status(200).json({
      success: true,
      data: response,
      message: 'Order retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    return next(new ApiError(500, 'Failed to fetch order', error.message));
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;
    const requestingUser = req.user;

    // Validation
    if (!orderStatus) {
      return next(new ApiError(400, 'Order status is required'));
    }

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(orderStatus)) {
      return next(new ApiError(400, 'Invalid order status'));
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return next(new ApiError(404, 'Order not found'));
    }

    // Authorization check - only admin can update order status
    if (requestingUser.role !== 'admin') {
      return next(new ApiError(403, 'Access denied. Only admins can update order status.'));
    }

    // Status transition validation
    const currentStatus = order.orderStatus;
    const isValidTransition = validateStatusTransition(currentStatus, orderStatus);

    if (!isValidTransition) {
      return next(new ApiError(400, `Cannot change status from '${currentStatus}' to '${orderStatus}'`));
    }

    // Prepare update data
    const updateData = {
      orderStatus,
    };

    // Update timestamps based on status
    const currentTime = new Date();
    switch (orderStatus) {
      case 'confirmed':
        // No specific timestamp for confirmed, but we could add one if needed
        break;
      case 'shipped':
        updateData['timestamps.shippedAt'] = currentTime;
        break;
      case 'delivered':
        updateData['timestamps.deliveredAt'] = currentTime;
        // Auto-update payment status to paid for COD orders when delivered
        if (order.payment?.paymentMethod === 'cod' && order.payment?.paymentStatus === 'pending') {
          updateData['payment.paymentStatus'] = 'paid';
          updateData['payment.paymentDate'] = currentTime;
          updateData['timestamps.paymentCompletedAt'] = currentTime;
        }
        break;
      case 'cancelled':
        updateData['timestamps.cancelledAt'] = currentTime;
        // Handle refund for paid orders
        if (order.payment?.paymentStatus === 'paid') {
          updateData['payment.paymentStatus'] = 'refunded';
        }
        break;
    }

    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true, runValidators: true })
      .populate('userId', 'firstName lastName email phoneNumber businessName')
      .populate('products.product', 'name category price description images')
      .populate('address')
      .lean()
      .exec();

    // Helper function to format currency
    const formatCurrency = (amount) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(amount);

    // Calculate order age in days
    const orderAge = Math.floor((new Date() - new Date(updatedOrder.createdAt)) / (24 * 60 * 60 * 1000));

    // Determine customer name
    const customerName = updatedOrder.userId?.firstName
      ? `${updatedOrder.userId.firstName} ${updatedOrder.userId.lastName || ''}`.trim()
      : updatedOrder.userId?.businessName || 'Unknown Customer';

    // Enhanced product details
    const enhancedProducts =
      updatedOrder.products?.map((item) => {
        const productData = item.product;
        const itemTotal = item.price * item.quantity;

        return {
          _id: productData._id,
          name: productData.name || item.productName,
          category: productData.category,
          description: productData.description,
          image: productData.images?.[0] || null,
          images: productData.images || [],
          price: item.price,
          formattedPrice: formatCurrency(item.price),
          quantity: item.quantity,
          total: itemTotal,
          formattedTotal: formatCurrency(itemTotal),
        };
      }) || [];

    // Status flags
    const statusFlags = {
      canCancel: ['pending', 'confirmed'].includes(updatedOrder.orderStatus),
      canShip: updatedOrder.orderStatus === 'confirmed',
      canDeliver: updatedOrder.orderStatus === 'shipped',
      isPaid: updatedOrder.payment?.paymentStatus === 'paid',
      isCompleted: updatedOrder.orderStatus === 'delivered',
    };

    // Format response
    const response = {
      _id: updatedOrder._id,
      orderId: updatedOrder.orderId,
      orderStatus: updatedOrder.orderStatus,
      userType: updatedOrder.userType,
      deliverySlot: updatedOrder.deliverySlot,

      totalAmount: updatedOrder.totalAmount,
      formattedAmount: formatCurrency(updatedOrder.totalAmount),

      products: enhancedProducts,
      productCount: enhancedProducts.length,

      customer: {
        _id: updatedOrder.userId._id,
        name: customerName,
        email: updatedOrder.userId.email,
        phoneNumber: updatedOrder.userId.phoneNumber,
        businessName: updatedOrder.userId.businessName,
      },

      address: updatedOrder.address,
      payment: updatedOrder.payment,

      timestamps: updatedOrder.timestamps,
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,

      formattedDate: new Date(updatedOrder.createdAt).toLocaleDateString('en-IN'),
      orderAge,
      statusFlags,
    };

    res.status(200).json({
      success: true,
      data: response,
      message: `Order status updated to '${orderStatus}' successfully`,
    });

    // Optional: Send notification to customer about status change
    // You can implement notification logic here (email, SMS, push notification)
  } catch (error) {
    console.error('Error updating order status:', error);
    return next(new ApiError(500, 'Failed to update order status', error.message));
  }
};

// Helper function to validate status transitions
const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'], // Allow cancellation even after shipping (with refund)
    delivered: [], // Cannot change from delivered
    cancelled: [], // Cannot change from cancelled
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

export { getAllOrders, getVendorOrders, getOrderById, updateOrderStatus, getUserOrders };
