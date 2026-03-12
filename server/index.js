import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import restaurantRoutes from './routes/restaurants.js';

dotenv.config();

const app = express();

// CORS — only allow the frontend origin
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));

// Body parsing — limit to prevent large payload attacks
app.use(express.json({ limit: '10kb' }));

// Rate limiting — 30 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', limiter);

app.use('/api/restaurants', restaurantRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'VibeEats' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => {
  console.log(`🇵🇰 VibeEats server running on http://localhost:${PORT}`);
});
