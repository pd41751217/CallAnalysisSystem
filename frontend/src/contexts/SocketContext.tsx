import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated } = useAuth();

  const connect = () => {
    // Use the same URL logic as the API service
    let socketUrl = import.meta.env.VITE_SOCKET_URL;
    
    // If VITE_SOCKET_URL is not set, try to construct it from the current host
    if (!socketUrl) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = '3002'; // Backend socket port
      socketUrl = `${protocol}//${hostname}:${port}`;
    }
    
    console.log('SocketContext: Attempting to connect to socket server...');
    console.log('SocketContext: Socket URL:', socketUrl);
    console.log('SocketContext: Current hostname:', window.location.hostname);
    console.log('SocketContext: Current protocol:', window.location.protocol);
    
    if (!socket) {
      console.log('SocketContext: Creating new socket connection...');
      
      // Get the authentication token
      const token = localStorage.getItem('authToken');
      console.log('SocketContext: Auth token available:', !!token);
      
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'], // Allow fallback to polling if websocket fails
        autoConnect: true,
        timeout: 20000, // 20 second timeout
        forceNew: true, // Force new connection
        auth: {
          token: token
        }
      });

      newSocket.on('connect', () => {
        console.log('SocketContext: Connected to socket server');
        console.log('SocketContext: Socket ID:', newSocket.id);
        setIsConnected(true);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('SocketContext: Disconnected from socket server, reason:', reason);
        setIsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('SocketContext: Socket error:', error);
      });

      newSocket.on('connect_error', (error) => {
        console.error('SocketContext: Connection error:', error);
        console.error('SocketContext: Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      });

      // Add reconnection handling
      newSocket.on('reconnect', (attemptNumber) => {
        console.log('SocketContext: Reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('SocketContext: Reconnection attempt', attemptNumber);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('SocketContext: Reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('SocketContext: Reconnection failed');
        setIsConnected(false);
      });

      setSocket(newSocket);
    } else {
      console.log('SocketContext: Socket already exists, not creating new connection');
    }
  };

  const disconnect = () => {
    console.log('SocketContext: Disconnecting socket...');
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
  }, [isAuthenticated]);

  const value: SocketContextType = {
    socket,
    isConnected,
    connect,
    disconnect,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
