const db = require('../config/database');
const OrderService = require('../services/order.services');

// ============================================================
// 1. CREAR ORDEN (Mesa o Para Llevar)
// ============================================================
// Valida que la mesa exista y esté libre antes de crear la orden.
exports.createOrder = (req, res) => {
  const { mesa_id, tipo } = req.body;

  // Si se especifica mesa, verificar que exista y esté libre
  if (mesa_id) {
    db.get(`SELECT * FROM mesas WHERE id = ?`, [mesa_id], (err, mesa) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });
      if (mesa.estado !== 'libre') {
        return res.status(400).json({ error: `La mesa no está disponible (estado: ${mesa.estado})` });
      }

      // Buscar el turno de caja activo para vincularlo a la orden
      db.get(`SELECT id FROM turnos_caja WHERE estado = 'abierta'`, [], (err, turno) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!turno) return res.status(400).json({ error: 'No hay un turno de caja abierto' });

        insertOrder(mesa_id, tipo, turno.id);
      });
    });
  } else {
    // Orden para llevar o delivery (sin mesa)
    db.get(`SELECT id FROM turnos_caja WHERE estado = 'abierta'`, [], (err, turno) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!turno) return res.status(400).json({ error: 'No hay un turno de caja abierto' });

      insertOrder(null, tipo, turno.id);
    });
  }

  // Función auxiliar para insertar la orden
  function insertOrder(mesaId, tipoOrden, turnoId) {
    db.run(
      `INSERT INTO ordenes (mesa_id, turno_caja_id, tipo, estado) VALUES (?, ?, ?, 'abierta')`,
      [mesaId, turnoId, tipoOrden || 'mesa'],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const ordenId = this.lastID;

        // Si es en mesa, vinculamos la orden activa a la mesa
        if (mesaId) {
          db.run(`UPDATE mesas SET estado = 'ocupada', orden_activa_id = ? WHERE id = ?`, [ordenId, mesaId]);
        }

        res.status(201).json({ orden_id: ordenId, mesa_id: mesaId, tipo: tipoOrden, estado: 'abierta' });
      }
    );
  }
};

// ============================================================
// 2. AGREGAR PRODUCTO A LA ORDEN
// ============================================================
// Valida que la orden exista y esté abierta, y descuenta stock si aplica.
exports.addItemToOrder = (req, res) => {
  const { orden_id, producto_id, cantidad, precio_unitario, notas, modificadores } = req.body;

  // Validaciones
  if (!orden_id || !producto_id || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'orden_id, producto_id y cantidad (>0) son obligatorios' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Verificar que la orden exista y esté abierta
    db.get(`SELECT * FROM ordenes WHERE id = ?`, [orden_id], (err, orden) => {
      if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
      if (!orden) { db.run('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }
      if (orden.estado !== 'abierta') {
        db.run('ROLLBACK');
        return res.status(400).json({ error: `La orden no está abierta (estado: ${orden.estado})` });
      }

      // Verificar que el producto exista
      db.get(`SELECT * FROM productos WHERE id = ?`, [producto_id], (err, producto) => {
        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
        if (!producto) { db.run('ROLLBACK'); return res.status(404).json({ error: 'Producto no encontrado' }); }

        // Verificar stock si el producto lo controla
        if (producto.control_stock && producto.stock_actual < cantidad) {
          db.run('ROLLBACK');
          return res.status(400).json({
            error: 'Stock insuficiente',
            stock_disponible: producto.stock_actual,
            cantidad_solicitada: cantidad
          });
        }

        // Calcular precio de modificadores
        let precioModificadores = 0;
        if (modificadores && modificadores.length > 0) {
          modificadores.forEach(mod => {
            precioModificadores += (mod.precio || 0);
          });
        }

        const subtotal = (precio_unitario + precioModificadores) * cantidad;

        // Insertar el detalle
        db.run(
          `INSERT INTO orden_detalles (orden_id, producto_id, cantidad, precio_unitario, precio_modificadores, notas, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orden_id, producto_id, cantidad, precio_unitario, precioModificadores, notas || null, subtotal],
          function (err) {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

            const detalleId = this.lastID;

            // Insertar modificadores si hay
            if (modificadores && modificadores.length > 0) {
              const stmt = db.prepare(
                `INSERT INTO orden_detalle_modificadores (orden_detalle_id, modificador_id, precio) VALUES (?, ?, ?)`
              );
              modificadores.forEach(mod => {
                stmt.run([detalleId, mod.modificador_id, mod.precio || 0]);
              });
              stmt.finalize();
            }

            // Descontar stock si aplica
            if (producto.control_stock) {
              db.run(
                `UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?`,
                [cantidad, producto_id]
              );
            }

            // Actualizar totales de la orden
            OrderService.updateOrderTotals(orden_id)
              .then(() => {
                db.run('COMMIT', (err) => {
                  if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                  res.status(201).json({ id: detalleId, orden_id, subtotal });
                });
              })
              .catch(err => {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
              });
          }
        );
      });
    });
  });
};

// ============================================================
// 3. CONSULTAR DETALLE COMPLETO DE UNA ORDEN
// ============================================================
exports.getOrderById = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM ordenes WHERE id = ?`, [id], (err, orden) => {
    // CORRECCIÓN: Distinguir error de BD de "no encontrado"
    if (err) return res.status(500).json({ error: err.message });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    const queryItems = `
      SELECT d.*, p.nombre
      FROM orden_detalles d
      JOIN productos p ON d.producto_id = p.id
      WHERE d.orden_id = ?
    `;

    db.all(queryItems, [id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...orden, items });
    });
  });
};

// ============================================================
// 4. APLICAR DESCUENTO A LA ORDEN
// ============================================================
// Permite aplicar un descuento porcentual o fijo a la orden.
exports.applyDiscount = (req, res) => {
  const { id } = req.params;
  const { tipo, valor } = req.body; // tipo: 'porcentaje' o 'fijo'

  if (!tipo || !valor || valor < 0) {
    return res.status(400).json({ error: 'tipo (porcentaje/fijo) y valor (>=0) son obligatorios' });
  }

  db.get(`SELECT * FROM ordenes WHERE id = ?`, [id], (err, orden) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.estado !== 'abierta') {
      return res.status(400).json({ error: 'Solo se puede descontar órdenes abiertas' });
    }

    let descuento = 0;
    let porcentaje = 0;

    if (tipo === 'porcentaje') {
      porcentaje = valor;
      descuento = (orden.subtotal * valor) / 100;
    } else {
      descuento = valor;
      porcentaje = (valor / orden.subtotal) * 100;
    }

    const nuevoTotal = orden.subtotal - descuento;

    db.run(
      `UPDATE ordenes SET descuento = ?, porcentaje_descuento = ?, total = ? WHERE id = ?`,
      [descuento, porcentaje, nuevoTotal, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          message: 'Descuento aplicado',
          subtotal: orden.subtotal,
          descuento,
          nuevo_total: nuevoTotal
        });
      }
    );
  });
};

// ============================================================
// 5. CANCELAR ORDEN
// ============================================================
// Cancela una orden y libera la mesa si aplica.
exports.cancelOrder = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM ordenes WHERE id = ?`, [id], (err, orden) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.estado !== 'abierta') {
      return res.status(400).json({ error: 'Solo se pueden cancelar órdenes abiertas' });
    }

    db.run(
      `UPDATE ordenes SET estado = 'cancelada', fecha_cierre = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Liberar mesa si aplica
        if (orden.mesa_id) {
          db.run(`UPDATE mesas SET estado = 'libre', orden_activa_id = NULL WHERE id = ?`, [orden.mesa_id]);
        }

        res.json({ message: 'Orden cancelada', orden_id: id });
      }
    );
  });
};
