import { io } from 'socket.io-client';
import dotenv from 'dotenv';

dotenv.config();

let socketClient = null;

export const connectToSocketServer = () => {
  socketClient = io(process.env.SOCKET_SERVER_URL);

  socketClient.on('connect', () => {
    console.log('✅ Express connected to Socket server   Socket ID:', socketClient.id);
  });

  return socketClient;
};

export const getSocketClient = () => socketClient;