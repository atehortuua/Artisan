const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inicializar BD
require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
// CORS restringido: solo permite orígenes específicos en producción
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Importar Rutas
const tablesRoutes = require('./routes/tables.routes');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');
const cashRoutes = require('./routes/cash.routes');
const combosRoutes = require('./routes/combos.routes');
const cierresRoutes = require('./routes/cierres.routes');
const proveedoresRoutes = require('./routes/proveedores.routes');
const timbradoRoutes = require('./routes/timbrado.routes');
const adminRoutes = require('./routes/admin.routes');
const cuentasRoutes = require('./routes/cuentas.routes');

// Definir Endpoints Base
app.use('/api/tables', tablesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/combos', combosRoutes);
app.use('/api/cierres', cierresRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/timbrado', timbradoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cuentas', cuentasRoutes);

// Ruta de Salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor POS funcionando en SQLite' });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Backend del POS corriendo en: http://localhost:${PORT}`);
});
