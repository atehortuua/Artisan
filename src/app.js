const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inicializar BD
require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Importar Rutas
const tablesRoutes = require('./routes/tables.routes');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');
const cashRoutes = require('./routes/cash.routes');

// Definir Endpoints Base
app.use('/api/tables', tablesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cash', cashRoutes);

// Ruta de Salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor POS funcionando en SQLite' });
});

app.listen(PORT, () => {
  console.log(`Backend del POS corriendo en: http://localhost:${PORT}`);
});