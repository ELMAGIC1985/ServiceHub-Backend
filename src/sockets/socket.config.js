import { Server } from 'socket.io';
import { allowedOrigins } from '../constants/constants.js';

let io = null;

export const initializeSocket = (server) => {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    },
    transports: ['polling', 'websocket'],
  });

  console.log('⚡ Socket.IO initialized');

  io.on('connection', (socket) => {
    console.log(`🔗 New socket connected: ${socket.id}`);

    socket.on('registerAdmin', (adminId) => {
      socket.join('admins');
      console.log(`👨‍💼 Admin ${adminId} joined room: admins`);
    });

    socket.on('registerVendor', (vendorId) => {
      socket.join(`vendor_${vendorId}`);
      console.log(`🏪 Vendor ${vendorId} joined their private room`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id}, Reason: ${reason}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized!');
  return io;
};
