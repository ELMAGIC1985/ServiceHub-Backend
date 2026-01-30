import { io } from '../app'
import { socket } from '../app'
// Connect to the server running on port 3000

// On connection to the server
socket.on('connect', () => {
    console.log('Vendor connected with socket ID:', socket.id)

    // Register the vendor (replace with a valid vendor ID from MongoDB)
    const vendorId = 'any-vendor-id' // You need to replace this with an actual vendor ID from your MongoDB collection
    socket.emit('register', vendorId)
})

// Listen for new orders
socket.on('newOrder', (order) => {
    console.log('Received new order:', order)

    // Simulate accepting the order
    console.log(`Vendor accepting order with ID: ${order._id}`)

    // Emit the "acceptOrder" event to update the order status
    socket.emit('acceptOrder', order._id)
})

// Listen for order status updates
socket.on('orderStatusUpdated', (order) => {
    console.log('Order status updated:', order)
})
