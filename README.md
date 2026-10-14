# POS Hamburguesería - Backend

Sistema de Punto de Venta (POS) con Node.js, Express y SQLite.

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
cd Artisan
npm install
cp .env.example .env  # Crear archivo de configuración
npm run dev           # Desarrollo con nodemon
# o
npm start             # Producción
```

## Estructura del Proyecto

```
Artisan/
├── schema.sql              # Esquema de base de datos
├── src/
│   ├── app.js              # Punto de entrada del servidor
│   ├── config/
│   │   └── database.js     # Configuración de SQLite
│   ├── controllers/        # Lógica de negocio
│   │   ├── admin.controller.js
│   │   ├── cash.controller.js
│   │   ├── cierres.controller.js
│   │   ├── combos.controller.js
│   │   ├── cuentas.controller.js
│   │   ├── orders.controllers.js
│   │   ├── products.controller.js
│   │   ├── proveedores.controller.js
│   │   ├── tables.controller.js
│   │   └── timbrado.controller.js
│   ├── routes/             # Definición de rutas
│   │   ├── admin.routes.js
│   │   ├── cash.routes.js
│   │   ├── cierres.routes.js
│   │   ├── combos.routes.js
│   │   ├── cuentas.routes.js
│   │   ├── orders.routes.js
│   │   ├── products.routes.js
│   │   ├── proveedores.routes.js
│   │   ├── tables.routes.js
│   │   └── timbrado.routes.js
│   └── services/
│       └── order.services.js
└── package.json
```

## API Endpoints

### Caja (Cash)
- `POST /api/cash/open` - Abrir turno de caja
- `POST /api/cash/pay` - Procesar pago
- `POST /api/cash/close` - Cerrar turno (Cierre Z)
- `POST /api/cash/movement` - Registrar movimiento de caja
- `GET /api/cash/active` - Obtener turno activo

### Órdenes (Orders)
- `POST /api/orders` - Crear orden
- `POST /api/orders/items` - Agregar producto a orden
- `GET /api/orders/:id` - Obtener orden por ID
- `PATCH /api/orders/:id/discount` - Aplicar descuento
- `PATCH /api/orders/:id/cancel` - Cancelar orden

### Productos (Products)
- `GET /api/products` - Listar productos
- `POST /api/products` - Crear producto
- `GET /api/products/categories` - Listar categorías
- `POST /api/products/categories` - Crear categoría
- `PATCH /api/products/:id/stock` - Actualizar stock
- `GET /api/products/modifiers` - Listar modificadores
- `POST /api/products/modifiers` - Crear modificador

### Mesas (Tables)
- `GET /api/tables` - Listar mesas
- `POST /api/tables` - Crear mesa
- `PATCH /api/tables/:id/status` - Actualizar estado
- `PATCH /api/tables/:id/release` - Liberar mesa

### Combos
- `GET /api/combos` - Listar combos
- `POST /api/combos` - Crear combo
- `GET /api/combos/:id` - Obtener combo por ID
- `PUT /api/combos/:id` - Actualizar combo
- `DELETE /api/combos/:id` - Eliminar combo

### Cierres de Caja
- `POST /api/cierres` - Registrar cierre (preventivo/parcial/final)
- `GET /api/cierres/shift/:turno_id` - Cierres de un turno
- `GET /api/cierres/last` - Último cierre

### Proveedores
- `GET /api/proveedores` - Listar proveedores
- `POST /api/proveedores` - Crear proveedor
- `POST /api/proveedores/pay` - Pagar a proveedor
- `GET /api/proveedores/payments` - Pagos a proveedores

### Timbrado / Facturación
- `GET /api/timbrado/active` - Timbrado activo
- `POST /api/timbrado` - Crear timbrado
- `POST /api/timbrado/emit` - Emitir factura
- `GET /api/timbrado/invoices` - Listar facturas
- `POST /api/timbrado/invoices/:id/cancel` - Anular factura

### Dashboard Admin
- `GET /api/admin/dashboard` - Resumen del día
- `GET /api/admin/reports/sales` - Reporte de ventas
- `GET /api/admin/reports/top-products` - Productos más vendidos
- `GET /api/admin/reports/cash-closures` - Reporte de cierres

### Cuentas Fraccionadas
- `POST /api/cuentas/split` - Fraccionar cuenta
- `GET /api/cuentas/:orden_id` - Cuentas de una orden
- `POST /api/cuentas/pay-fraction` - Pagar fracción

## Configuración

Crear archivo `.env` basado en `.env.example`:

```env
PORT=3000
DATABASE_PATH=./src/database/pos.db
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```
