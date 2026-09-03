-- Enable Foreign Keys
PRAGMA foreign_keys = ON;

-- 1. Mesas
CREATE TABLE IF NOT EXISTS mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    capacidad INTEGER DEFAULT 4,
    estado TEXT CHECK(estado IN ('libre', 'ocupada', 'en_cobro', 'reservada')) DEFAULT 'libre',
    orden_activa_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categorías
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    icono TEXT
);

-- 3. Productos
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_venta REAL NOT NULL,
    precio_costo REAL DEFAULT 0.0,
    stock_actual INTEGER DEFAULT 0,
    control_stock BOOLEAN DEFAULT 0,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- 4. Modificadores (Extras/Personalización de Hamburguesas)
CREATE TABLE IF NOT EXISTS modificadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL, -- ej: Extra Queso, Sin Cebolla
    precio REAL DEFAULT 0.0,
    categoria_id INTEGER,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- 5. Turnos de Caja
CREATE TABLE IF NOT EXISTS turnos_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cajero_id INTEGER DEFAULT 1,
    monto_inicial REAL NOT NULL,
    fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME,
    total_ventas_efectivo REAL DEFAULT 0.0,
    total_ventas_tarjeta REAL DEFAULT 0.0,
    total_ventas_transferencia REAL DEFAULT 0.0,
    monto_real_contado REAL DEFAULT 0.0,
    diferencia REAL DEFAULT 0.0,
    estado TEXT CHECK(estado IN ('abierta', 'cerrada')) DEFAULT 'abierta'
);

-- 6. Órdenes
CREATE TABLE IF NOT EXISTS ordenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_id INTEGER,
    tipo TEXT CHECK(tipo IN ('mesa', 'para_llevar', 'delivery')) DEFAULT 'mesa',
    estado TEXT CHECK(estado IN ('abierta', 'pagada', 'cancelada')) DEFAULT 'abierta',
    subtotal REAL DEFAULT 0.0,
    descuento REAL DEFAULT 0.0,
    total REAL DEFAULT 0.0,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME,
    FOREIGN KEY (mesa_id) REFERENCES mesas(id)
);

-- 7. Detalles de la Orden
CREATE TABLE IF NOT EXISTS orden_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    notas TEXT, -- Instrucciones para cocina (ej: Término 3/4, Extra queso)
    subtotal REAL NOT NULL,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- 8. Pagos
CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    turno_caja_id INTEGER NOT NULL,
    metodo TEXT CHECK(metodo IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'mixto')) NOT NULL,
    monto REAL NOT NULL,
    monto_recibido REAL DEFAULT 0.0,
    cambio REAL DEFAULT 0.0,
    referencia TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id),
    FOREIGN KEY (turno_caja_id) REFERENCES turnos_caja(id)
);