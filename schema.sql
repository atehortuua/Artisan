-- ============================================================
-- POS Hamburguesería - Esquema de Base de Datos
-- Versión: 2.0 (con caja, combos, fraccionamiento, timbrado,
--          proveedores, cierres y dashboard admin)
-- ============================================================

-- Activar llaves foráneas de SQLite (por defecto están desactivadas).
-- Esto garantiza integridad referencial: no se puede insertar un pago
-- con un turno_caja_id inexistente, por ejemplo.
PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. MESAS
-- ============================================================
-- Tabla que representa las mesas físicas del restaurante.
-- 'orden_activa_id' vincula la mesa con la orden que la está usando.
CREATE TABLE IF NOT EXISTS mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ID único autoincremental
    numero TEXT NOT NULL UNIQUE,             -- Número/identificador de la mesa (ej: "M1")
    capacidad INTEGER DEFAULT 4,             -- Cuántas personas caben
    -- Estado actual de la mesa. CHECK restringe valores válidos:
    -- 'libre' = disponible, 'ocupada' = con clientes comiendo,
    -- 'en_cobro' = esperando pago, 'reservada' = apartada
    estado TEXT CHECK(estado IN ('libre', 'ocupada', 'en_cobro', 'reservada')) DEFAULT 'libre',
    orden_activa_id INTEGER DEFAULT NULL,    -- FK a la orden activa (NULL = sin orden)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- Fecha de creación automática
);

-- Índice para filtrar mesas por estado rápidamente (ej: mostrar solo libres)
CREATE INDEX IF NOT EXISTS idx_mesas_estado ON mesas(estado);

-- ============================================================
-- 2. CATEGORÍAS
-- ============================================================
-- Agrupa productos (ej: "Hamburguesas", "Bebidas", "Postres")
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,    -- Nombre visible de la categoría
    icono TEXT               -- Emoji o nombre de icono para la UI
);

-- ============================================================
-- 3. PRODUCTOS
-- ============================================================
-- Cada producto vendible. Puede ser un producto simple o un combo.
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER,                    -- FK a categorías
    nombre TEXT NOT NULL,                    -- Nombre del producto
    descripcion TEXT,                        -- Descripción para cocina/cliente
    precio_venta REAL NOT NULL CHECK(precio_venta >= 0),  -- Precio al público (no negativo)
    precio_costo REAL DEFAULT 0.0 CHECK(precio_costo >= 0), -- Costo de producción
    stock_actual INTEGER DEFAULT 0,          -- Unidades disponibles
    control_stock BOOLEAN DEFAULT 0,         -- 1 = descontar stock al vender
    es_combo BOOLEAN DEFAULT 0,              -- 1 = es un combo (ver tabla combos)
    activo BOOLEAN DEFAULT 1,               -- 0 = dado de baja (no se muestra)
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);

-- ============================================================
-- 4. MODIFICADORES
-- ============================================================
-- Extras o personalizaciones (ej: "Extra Queso +$500", "Sin Cebolla")
CREATE TABLE IF NOT EXISTS modificadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,                    -- Nombre del modificador
    precio REAL DEFAULT 0.0 CHECK(precio >= 0), -- Costo adicional (0 = gratis)
    categoria_id INTEGER,                    -- FK a categorías (para agrupar)
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- ============================================================
-- 5. COMBOS
-- ============================================================
-- Un combo es un producto compuesto por varios productos individuales.
-- Ej: "Combo Clásico" = Hamburguesa + Papas + Bebida a precio especial.
CREATE TABLE IF NOT EXISTS combos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,                    -- Nombre del combo
    descripcion TEXT,                        -- Qué incluye
    precio_combo REAL NOT NULL CHECK(precio_combo >= 0), -- Precio del combo
    activo BOOLEAN DEFAULT 1,               -- 0 = no disponible
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5b. Productos dentro de cada combo (relación N:M)
CREATE TABLE IF NOT EXISTS combo_productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    combo_id INTEGER NOT NULL,               -- FK al combo
    producto_id INTEGER NOT NULL,            -- FK al producto individual
    cantidad INTEGER NOT NULL DEFAULT 1,     -- Cuántas unidades de este producto
    FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,  -- Si se borra el combo, se borran sus items
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Índice para buscar productos de un combo rápidamente
CREATE INDEX IF NOT EXISTS idx_combo_productos_combo ON combo_productos(combo_id);

-- ============================================================
-- 6. TURNOS DE CAJA
-- ============================================================
-- Cada vez que un cajero abre caja, se crea un turno.
-- Registra todo el dinero que entra y sale durante ese turno.
CREATE TABLE IF NOT EXISTS turnos_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cajero_id INTEGER DEFAULT 1,             -- FK al usuario cajero
    monto_inicial REAL NOT NULL CHECK(monto_inicial >= 0), -- Dinero con el que se abre caja
    monto_final REAL DEFAULT 0.0,            -- Dinero total al cierre (efectivo + tarjeta + transferencia)
    fondo_manana REAL DEFAULT 0.0,           -- Cuánto se deja para el día siguiente
    fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Cuándo se abrió
    fecha_cierre DATETIME,                   -- Cuándo se cerró (NULL = aún abierta)
    -- Totales por método de pago (se actualizan con cada venta)
    total_ventas_efectivo REAL DEFAULT 0.0,
    total_ventas_tarjeta REAL DEFAULT 0.0,
    total_ventas_transferencia REAL DEFAULT 0.0,
    total_ventas_otros REAL DEFAULT 0.0,
    monto_real_contado REAL DEFAULT 0.0,     -- Dinero físico contado al cierre
    diferencia REAL DEFAULT 0.0,             -- Diferencia entre esperado y real (descuadre)
    estado TEXT CHECK(estado IN ('abierta', 'cerrada')) DEFAULT 'abierta'
);

-- Índice para buscar el turno abierto rápidamente
CREATE INDEX IF NOT EXISTS idx_turnos_caja_estado ON turnos_caja(estado);

-- ============================================================
-- 7. CIERRES DE CAJA
-- ============================================================
-- Registra los diferentes tipos de cierre durante un turno:
-- - Preventivo: conteo rápido a mitad de turno
-- - Parcial: cierre temporal (ej: cambio de turno)
-- - Final: cierre definitivo del día
CREATE TABLE IF NOT EXISTS cierres_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,               -- FK al turno de caja
    tipo TEXT CHECK(tipo IN ('preventivo', 'parcial', 'final')) NOT NULL,
    monto_efectivo REAL DEFAULT 0.0,         -- Ventas en efectivo hasta ese momento
    monto_tarjeta REAL DEFAULT 0.0,          -- Ventas con tarjeta
    monto_transferencia REAL DEFAULT 0.0,    -- Ventas por transferencia
    total_ventas REAL DEFAULT 0.0,           -- Suma de todos los métodos
    monto_real_contado REAL DEFAULT 0.0,     -- Dinero físico contado
    diferencia REAL DEFAULT 0.0,             -- Descuadre
    observaciones TEXT,                      -- Notas del cajero
    ruta_imagen_factura TEXT,                -- Ruta a foto del ticket/factura (opcional)
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turno_id) REFERENCES turnos_caja(id)
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_turno ON cierres_caja(turno_id);

-- ============================================================
-- 8. MOVIMIENTOS DE CAJA
-- ============================================================
-- Registra entradas y salidas de efectivo durante el turno.
-- Ej: "Salida $5000 para compra de pan", "Entrada $10000 de caja chica"
CREATE TABLE IF NOT EXISTS movimientos_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,               -- FK al turno
    tipo TEXT CHECK(tipo IN ('entrada', 'salida')) NOT NULL,
    motivo TEXT NOT NULL,                    -- Por qué se mueve el dinero
    monto REAL NOT NULL CHECK(monto > 0),    -- Cantidad (siempre positiva)
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turno_id) REFERENCES turnos_caja(id)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_turno ON movimientos_caja(turno_id);

-- ============================================================
-- 9. ÓRDENES
-- ============================================================
-- Cada orden representa una cuenta de una mesa o un pedido para llevar.
CREATE TABLE IF NOT EXISTS ordenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_id INTEGER,                         -- FK a mesas (NULL = para llevar/delivery)
    turno_caja_id INTEGER,                   -- FK al turno de caja cuando se creó
    tipo TEXT CHECK(tipo IN ('mesa', 'para_llevar', 'delivery')) DEFAULT 'mesa',
    estado TEXT CHECK(estado IN ('abierta', 'pagada', 'cancelada')) DEFAULT 'abierta',
    subtotal REAL DEFAULT 0.0,               -- Suma de items sin descuento
    descuento REAL DEFAULT 0.0,              -- Monto descontado
    porcentaje_descuento REAL DEFAULT 0.0,  -- % de descuento aplicado
    total REAL DEFAULT 0.0,                  -- subtotal - descuento
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME,                   -- Cuándo se pagó/canceló
    FOREIGN KEY (mesa_id) REFERENCES mesas(id),
    FOREIGN KEY (turno_caja_id) REFERENCES turnos_caja(id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_mesa ON ordenes(mesa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_turno ON ordenes(turno_caja_id);

-- ============================================================
-- 10. DETALLES DE LA ORDEN
-- ============================================================
-- Cada línea de la orden: qué producto, cuántas unidades, a qué precio.
CREATE TABLE IF NOT EXISTS orden_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,               -- FK a la orden
    producto_id INTEGER NOT NULL,            -- FK al producto
    cantidad INTEGER NOT NULL CHECK(cantidad > 0), -- Unidades (mínimo 1)
    precio_unitario REAL NOT NULL,           -- Precio al momento de la venta
    precio_modificadores REAL DEFAULT 0.0,   -- Total de extras/modificadores
    notas TEXT,                              -- Instrucciones para cocina
    subtotal REAL NOT NULL,                  -- (precio_unitario + modificadores) * cantidad
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE,  -- Si se borra la orden, se borran sus items
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE INDEX IF NOT EXISTS idx_orden_detalles_orden ON orden_detalles(orden_id);

-- 10b. Modificadores aplicados a cada item (relación N:M)
CREATE TABLE IF NOT EXISTS orden_detalle_modificadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_detalle_id INTEGER NOT NULL,       -- FK al item de la orden
    modificador_id INTEGER NOT NULL,         -- FK al modificador
    precio REAL DEFAULT 0.0,                 -- Precio del modificador al momento de la venta
    FOREIGN KEY (orden_detalle_id) REFERENCES orden_detalles(id) ON DELETE CASCADE,
    FOREIGN KEY (modificador_id) REFERENCES modificadores(id)
);

CREATE INDEX IF NOT EXISTS idx_orden_detalle_mod_detalle ON orden_detalle_modificadores(orden_detalle_id);

-- ============================================================
-- 11. PAGOS
-- ============================================================
-- Cada pago realizado. Una orden puede tener varios pagos (mixto).
CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,               -- FK a la orden
    turno_caja_id INTEGER NOT NULL,          -- FK al turno de caja
    metodo TEXT CHECK(metodo IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'mixto')) NOT NULL,
    monto REAL NOT NULL CHECK(monto > 0),    -- Monto pagado
    monto_recibido REAL DEFAULT 0.0,         -- Dinero entregado por el cliente (efectivo)
    cambio REAL DEFAULT 0.0,                 -- Vuelto = monto_recibido - monto
    referencia TEXT,                         -- Número de autorización, comprobante, etc.
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id),
    FOREIGN KEY (turno_caja_id) REFERENCES turnos_caja(id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_orden ON pagos(orden_id);
CREATE INDEX IF NOT EXISTS idx_pagos_turno ON pagos(turno_caja_id);

-- ============================================================
-- 12. CUENTAS FRACCIONADAS
-- ============================================================
-- Permite dividir una orden en varias cuentas (ej: 4 amigos pagan por separado).
CREATE TABLE IF NOT EXISTS cuentas_fraccionadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,               -- FK a la orden original
    nombre TEXT NOT NULL,                    -- Ej: "Cuenta 1 - Juan", "Cuenta 2 - María"
    subtotal REAL NOT NULL,                  -- Suma de items sin descuento
    total REAL NOT NULL,                     -- Total a pagar por esta fracción
    estado TEXT CHECK(estado IN ('abierta', 'pagada')) DEFAULT 'abierta',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_pago DATETIME,                     -- Cuándo se pagó esta fracción
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cuentas_frac_orden ON cuentas_fraccionadas(orden_id);

-- 12b. Items asignados a cada cuenta fraccionada
CREATE TABLE IF NOT EXISTS cuenta_fraccionada_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_fraccionada_id INTEGER NOT NULL,  -- FK a la cuenta fraccionada
    orden_detalle_id INTEGER NOT NULL,       -- FK al item original de la orden
    cantidad INTEGER NOT NULL DEFAULT 1,     -- Cuántas unidades de este item van en esta fracción
    precio_unitario REAL NOT NULL,           -- Precio al momento de la división
    subtotal REAL NOT NULL,                  -- cantidad * precio_unitario
    FOREIGN KEY (cuenta_fraccionada_id) REFERENCES cuentas_fraccionadas(id) ON DELETE CASCADE,
    FOREIGN KEY (orden_detalle_id) REFERENCES orden_detalles(id)
);

CREATE INDEX IF NOT EXISTS idx_cuenta_frac_items_cuenta ON cuenta_fraccionada_items(cuenta_fraccionada_id);

-- ============================================================
-- 13. PROVEEDORES
-- ============================================================
-- Empresas a las que se les compra insumos.
CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,                    -- Nombre de la empresa
    contacto TEXT,                           -- Persona de contacto
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    rut TEXT,                                -- RUT/NIF del proveedor
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 14. PAGOS A PROVEEDORES
-- ============================================================
-- Registra cada pago realizado a un proveedor.
CREATE TABLE IF NOT EXISTS pagos_proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL,           -- FK al proveedor
    turno_caja_id INTEGER,                   -- FK al turno de caja (si se paga desde caja)
    monto REAL NOT NULL CHECK(monto > 0),
    metodo TEXT CHECK(metodo IN ('efectivo', 'transferencia', 'cheque')) NOT NULL,
    concepto TEXT NOT NULL,                  -- Ej: "Pago factura #1234 - Carnes"
    numero_factura TEXT,                     -- Número de factura del proveedor
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
    FOREIGN KEY (turno_caja_id) REFERENCES turnos_caja(id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_prov_proveedor ON pagos_proveedores(proveedor_id);

-- ============================================================
-- 15. TIMBRADO / FACTURACIÓN
-- ============================================================
-- El timbrado es la autorización fiscal para emitir facturas.
-- Cada timbrado tiene un rango de números de factura válidos.
CREATE TABLE IF NOT EXISTS timbrado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_timbrado TEXT NOT NULL UNIQUE,    -- Número de timbrado asignado por la autoridad fiscal
    numero_inicio INTEGER NOT NULL,          -- Primer número de factura de este timbrado
    numero_fin INTEGER NOT NULL,             -- Último número de factura de este timbrado
    numero_actual INTEGER NOT NULL,          -- Próximo número a asignar
    fecha_vencimiento DATE NOT NULL,         -- Fecha de vencimiento del timbrado
    activo BOOLEAN DEFAULT 1,               -- 0 = vencido o agotado
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15b. Facturas emitidas
CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,               -- FK a la orden
    timbrado_id INTEGER NOT NULL,            -- FK al timbrado usado
    numero_factura TEXT NOT NULL UNIQUE,     -- Número de factura (ej: "001-001-00001234")
    rut_cliente TEXT,                        -- RUT del cliente (si aplica)
    razon_social TEXT,                       -- Nombre/Razón social del cliente
    monto_total REAL NOT NULL,               -- Total facturado
    estado TEXT CHECK(estado IN ('emitida', 'anulada')) DEFAULT 'emitida',
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id),
    FOREIGN KEY (timbrado_id) REFERENCES timbrado(id)
);

CREATE INDEX IF NOT EXISTS idx_facturas_orden ON facturas(orden_id);

-- ============================================================
-- 16. USUARIOS
-- ============================================================
-- Usuarios del sistema con roles para el dashboard de administrador.
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,           -- Nombre de usuario para login
    password_hash TEXT NOT NULL,             -- Contraseña hasheada (NUNCA texto plano)
    nombre TEXT NOT NULL,                    -- Nombre completo del usuario
    rol TEXT CHECK(rol IN ('admin', 'cajero', 'cocinero', 'mesero')) NOT NULL,
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 17. CONFIGURACIÓN
-- ============================================================
-- Pares clave-valor para configuración del negocio.
-- Ej: razon_social, rut_empresa, direccion, telefono, etc.
CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT NOT NULL UNIQUE,              -- Ej: "razon_social"
    valor TEXT NOT NULL                      -- Ej: "Hamburguesería El Rey S.A."
);
