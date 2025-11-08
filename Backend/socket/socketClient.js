import { io } from 'socket.io-client';

let socketClient = null;

export const connectToSocketServer = () => {
  socketClient = io('http://localhost:3001');

  socketClient.on('connect', () => {
    console.log('✅ Express connected to Socket server   Socket ID:', socketClient.id);
  });

  return socketClient;
};

export const getSocketClient = () => socketClient;