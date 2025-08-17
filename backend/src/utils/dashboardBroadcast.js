// Socket.IO instance for real-time dashboard updates
let io = null;

// Function to set Socket.IO instance
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Function to broadcast dashboard updates via Socket.IO
export const broadcastDashboardUpdate = (eventType, data) => {
  const event = {
    type: eventType,
    data: data,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all connected dashboard clients
  if (io) {
    io.emit('dashboard_update', event);
    console.log(`Broadcasting dashboard update: ${eventType}`, event);
  } else {
    console.warn('Socket.IO not available for dashboard broadcast');
  }
};

// Function to send dashboard update to specific user
export const sendDashboardUpdate = (userId, eventType, data) => {
  const event = {
    type: eventType,
    data: data,
    timestamp: new Date().toISOString()
  };

  if (io) {
    io.to(`user_${userId}`).emit('dashboard_update', event);
    console.log(`Sending dashboard update to user ${userId}: ${eventType}`, event);
  }
};

// Function to send dashboard update to admin users only
export const sendAdminDashboardUpdate = (eventType, data) => {
  const event = {
    type: eventType,
    data: data,
    timestamp: new Date().toISOString()
  };

  if (io) {
    io.to('admin').emit('dashboard_update', event);
    console.log(`Sending admin dashboard update: ${eventType}`, event);
  }
};


