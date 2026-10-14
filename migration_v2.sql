-- Migración v2: Agregar columnas nuevas a tablas existentes
-- Ejecutar si la base de datos ya existía con el schema anterior

-- Agregar columnas a turnos_caja
ALTER TABLE turnos_caja ADD COLUMN monto_final REAL DEFAULT 0.0;
ALTER TABLE turnos_caja ADD COLUMN fondo_manana REAL DEFAULT 0.0;
ALTER TABLE turnos_caja ADD COLUMN total_ventas_otros REAL DEFAULT 0.0;

-- Agregar columnas a ordenes
ALTER TABLE ordenes ADD COLUMN turno_caja_id INTEGER;
ALTER TABLE ordenes ADD COLUMN porcentaje_descuento REAL DEFAULT 0.0;

-- Agregar columnas a orden_detalles
ALTER TABLE orden_detalles ADD COLUMN precio_modificadores REAL DEFAULT 0.0;

-- Agregar columnas a productos
ALTER TABLE productos ADD COLUMN es_combo BOOLEAN DEFAULT 0;
ALTER TABLE productos ADD COLUMN activo BOOLEAN DEFAULT 1;

-- Crear tablas nuevas si no existen
CREATE TABLE IF NOT EXISTS combos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_combo REAL NOT NULL CHECK(precio_combo >= 0),
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS combo_productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    combo_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS cierres_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    tipo TEXT CHECK(tipo IN ('preventivo', 'parcial', 'final')) NOT NULL,
    monto_efectivo REAL DEFAULT 0.0,
    monto_tarjeta REAL DEFAULT 0.0,
    monto_transferencia REAL DEFAULT 0.0,
    total_ventas REAL DEFAULT 0.0,
    monto_real_contado REAL DEFAULT 0.0,
    diferencia REAL DEFAULT 0.0,
    observaciones TEXT,
    ruta_imagen_factura TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turno_id) REFERENCES turnos_caja(id)
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    tipo TEXT CHECK(tipo IN ('entrada', 'salida')) NOT NULL,
    motivo TEXT NOT NULL,
    monto REAL NOT NULL CHECK(monto > 0),
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turno_id) REFERENCES turnos_caja(id)
);

CREATE TABLE IF NOT EXISTS cuentas_fraccionadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    subtotal REAL NOT NULL,
    total REAL NOT NULL,
    estado TEXT CHECK(estado IN ('abierta', 'pagada')) DEFAULT 'abierta',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_pago DATETIME,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cuenta_fraccionada_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_fraccionada_id INTEGER NOT NULL,
    orden_detalle_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (cuenta_fraccionada_id) REFERENCES cuentas_fraccionadas(id) ON DELETE CASCADE,
    FOREIGN KEY (orden_detalle_id) REFERENCES orden_detalles(id)
);

CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    contacto TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    rut TEXT,
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagos_proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL,
    turno_caja_id INTEGER,
    monto REAL NOT NULL CHECK(monto > 0),
    metodo TEXT CHECK(metodo IN ('efectivo', 'transferencia', 'cheque')) NOT NULL,
    concepto TEXT NOT NULL,
    numero_factura TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
    FOREIGN KEY (turno_caja_id) REFERENCES turnos_caja(id)
);

CREATE TABLE IF NOT EXISTS timbrado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_timbrado TEXT NOT NULL UNIQUE,
    numero_inicio INTEGER NOT NULL,
    numero_fin INTEGER NOT NULL,
    numero_actual INTEGER NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    timbrado_id INTEGER NOT NULL,
    numero_factura TEXT NOT NULL UNIQUE,
    rut_cliente TEXT,
    razon_social TEXT,
    monto_total REAL NOT NULL,
    estado TEXT CHECK(estado IN ('emitida', 'anulada')) DEFAULT 'emitida',
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id),
    FOREIGN KEY (timbrado_id) REFERENCES timbrado(id)
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('admin', 'cajero', 'cocinero', 'mesero')) NOT NULL,
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT NOT NULL UNIQUE,
    valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orden_detalle_modificadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_detalle_id INTEGER NOT NULL,
    modificador_id INTEGER NOT NULL,
    precio REAL DEFAULT 0.0,
    FOREIGN KEY (orden_detalle_id) REFERENCES orden_detalles(id) ON DELETE CASCADE,
    FOREIGN KEY (modificador_id) REFERENCES modificadores(id)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_mesas_estado ON mesas(estado);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_combo_productos_combo ON combo_productos(combo_id);
CREATE INDEX IF NOT EXISTS idx_turnos_caja_estado ON turnos_caja(estado);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_turno ON cierres_caja(turno_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_turno ON movimientos_caja(turno_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_mesa ON ordenes(mesa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_turno ON ordenes(turno_caja_id);
CREATE INDEX IF NOT EXISTS idx_orden_detalles_orden ON orden_detalles(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_detalle_mod_detalle ON orden_detalle_modificadores(orden_detalle_id);
CREATE INDEX IF NOT EXISTS idx_pagos_orden ON pagos(orden_id);
CREATE INDEX IF NOT EXISTS idx_pagos_turno ON pagos(turno_caja_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_frac_orden ON cuentas_fraccionadas(orden_id);
CREATE INDEX IF NOT EXISTS idx_cuenta_frac_items_cuenta ON cuenta_fraccionada_items(cuenta_fraccionada_id);
CREATE INDEX IF NOT EXISTS idx_pagos_prov_proveedor ON pagos_proveedores(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_facturas_orden ON facturas(orden_id);
