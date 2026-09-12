import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import productRoutes from './routes/products';
import publishRoutes from './routes/publish';
import panelRoutes from './routes/panel';

const app = express();
app.use(express.json());

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/publish', publishRoutes);
app.use('/api/panel', panelRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'shopify-amazon-publisher' });
});

// Servir dashboard
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  console.log(`🚀 Shopify → Amazon Publisher en puerto ${PORT}`);
  console.log(`📦 Dashboard: http://localhost:${PORT}`);
});
