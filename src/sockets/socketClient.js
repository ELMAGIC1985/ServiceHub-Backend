import { io } from 'socket.io-client'

// Connect to the WebSocket server (Make sure the backend is running)
const socket = io('http://localhost:8000', {
    transports: ['websocket']
})

socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server with ID:', socket.id)

    // Simulate a vendor going online
    socket.emit('vendorOnline', { vendorId: '12345', location: 'Delhi' })

    // Simulate a vendor accepting a service request
    // setTimeout(() => {
    //     socket.emit('acceptService', { vendorId: '12345' })
    // }, 3000)
})

// Listen for the "serviceConfirmed" event
socket.on('serviceConfirmed', (data) => {
    console.log('🎉 Service confirmed:', data)
})

// Listen for "serviceTaken" if another vendor has accepted the request
socket.on('serviceTaken', (message) => {
    console.log('⚠️ Service already taken:', message)
})

// Handle disconnection
socket.on('disconnect', () => {
    console.log('❌ Disconnected from WebSocket server')
})
