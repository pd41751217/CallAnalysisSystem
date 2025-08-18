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
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';
    
    console.log('SocketContext: Attempting to connect to socket server...');
    console.log('SocketContext: Socket URL:', socketUrl);
    
    if (!socket) {
      console.log('SocketContext: Creating new socket connection...');
      
      // Get the authentication token
      const token = localStorage.getItem('authToken');
      console.log('SocketContext: Auth token available:', !!token);
      
      const newSocket = io(socketUrl, {
        transports: ['websocket'],
        autoConnect: true,
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
