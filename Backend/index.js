// server.js
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';



// ✅ ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




// ✅ Import routes here
import { AuthRouter } from './Routes/Auth.Route.js';
import { UserRouter } from './Routes/User.Route.js';
import { PostRouter } from './Routes/Post.Route.js';
import { BanRouter } from './Routes/Ban.Route.js';
import { RazorPayRouter } from './Routes/payment/razorpay.Route.js';
import { ChatRouter } from './Routes/Chat.Route.js';
import { PortfolioRouter } from './Routes/PortFolio/portFolio.Route.js';

import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
const swaggerDocument = JSON.parse(fs.readFileSync('./Backend/swagger/swagger.json', 'utf8'));

// Load environment variables
import { connectDatabase } from './Database/mogooseConnect.js';
import { initializeSocket } from './socket/socket-server.js';
import { ContactRouter } from './Routes/contact/Contact.Route.js';
import { ReportRouter } from './Routes/healper/Report.Route.js';
import { NewSattelarRouter } from './Routes/healper/Newsattelar.Route.js';
import { NotificationRouter } from './Routes/Notification.Route.js';
import { NotifyRouter } from './Routes/Notify.Route.js';

// ✅ Load environment variables
dotenv.config();

// ==================== CONFIG ====================
const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);

// ==================== MIDDLEWARES ====================
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5000",
    "https://api.editcraft.co.in",
    "https://editcraft.co.in",
    "https://www.editcraft.co.in",
    "http://localhost:3001"
  ],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ✅ Serve static files (optional, if you have CSS/JS/images)
app.use(express.static(path.join(__dirname, 'public')));

// ==================== SOCKET.IO SETUP ====================
const io = initializeSocket(server);
app.set('socketio', io);

// Optional: Log when Socket.IO is ready
server.on('listening', () => {
  const address = server.address();
  console.log(`📡 Socket.IO server running on port ${address.port}`);
});

// ==================== ROUTES ====================
// ✅ Serve index.html at root
app.get('/new', (req, res) => {
  res.sendFile(path.join(__dirname,  'index.html'));
});

app.use('/v1/api/auth', AuthRouter);
app.use('/v1/api/user', UserRouter);
app.use('/v1/api/post', PostRouter);
app.use('/v1/api/ban', BanRouter);
app.use('/v1/api/payment', RazorPayRouter);
app.use('/v1/api/messages', ChatRouter);
app.use('/v1/api/portfolio', PortfolioRouter);
app.use('/v1/api/contact',ContactRouter);
app.use('/v1/api/report',ReportRouter)
app.use('/v1/api/newsattaler', NewSattelarRouter);
app.use('/v1/api/notification', NotificationRouter);

// Just For Notify
app.use('/v1/api/notify', NotifyRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== DATABASE & SERVER START ====================
connectDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  });

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;