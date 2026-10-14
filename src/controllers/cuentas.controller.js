const db = require('../config/database');

// ============================================================
// 1. FRACCIONAR CUENTA (dividir una orden en varias cuentas)
// ============================================================
exports.splitAccount = (req, res) => {
  const { orden_id, fracciones } = req.body;

  if (!orden_id || !fracciones || !Array.isArray(fracciones) || fracciones.length < 2) {
    return res.status(400).json({ error: 'orden_id y fracciones (mínimo 2) son obligatorios' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Obtener la orden
    db.get(`SELECT * FROM ordenes WHERE id = ?`, [orden_id], (err, orden) => {
      if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
      if (!orden) { db.run('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }
      if (orden.estado !== 'abierta') {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'Solo se pueden fraccionar órdenes abiertas' });
      }

      // Obtener los detalles de la orden
      db.all(`SELECT * FROM orden_detalles WHERE orden_id = ?`, [orden_id], (err, detalles) => {
        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

        // Validar que todos los detalles estén asignados a alguna fracción
        const detallesAsignados = new Set();
        fracciones.forEach(fraccion => {
          fracion.items.forEach(item => {
            detallesAsignados.add(item.orden_detalle_id);
          });
        });

        if (detallesAsignados.size !== detalles.length) {
          db.run('ROLLBACK');
          return res.status(400).json({
            error: 'Todos los items de la orden deben ser asignados a una fracción',
            detalles_orden: detalles.length,
            detalles_asignados: detallesAsignados.size
          });
        }

        // Crear cada fracción
        let fraccionesCreadas = 0;
        const resultados = [];

        fracciones.forEach((fraccion, index) => {
          const subtotal = fracion.items.reduce((sum, item) => sum + item.subtotal, 0);

          db.run(
            `INSERT INTO cuentas_fraccionadas (orden_id, nombre, subtotal, total)
             VALUES (?, ?, ?, ?)`,
            [orden_id, fracion.nombre || `Cuenta ${index + 1}`, subtotal, subtotal],
            function (err) {
              if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

              const cuentaId = this.lastID;

              // Insertar items de la fracción
              const stmt = db.prepare(
                `INSERT INTO cuenta_fraccionada_items (cuenta_fraccionada_id, orden_detalle_id, cantidad, precio_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?)`
              );

              fracion.items.forEach(item => {
                stmt.run([cuentaId, item.orden_detalle_id, item.cantidad, item.precio_unitario, item.subtotal]);
              });

              stmt.finalize((err) => {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

                resultados.push({ id: cuentaId, nombre: fracion.nombre || `Cuenta ${index + 1}`, total: subtotal });
                fraccionesCreadas++;

                if (fraccionesCreadas === fracciones.length) {
                  db.run('COMMIT', (err) => {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                    res.status(201).json({
                      message: 'Cuenta fraccionada exitosamente',
                      orden_id,
                      fracciones: resultados
                    });
                  });
                }
              });
            }
          );
        });
      });
    });
  });
};

// ============================================================
// 2. OBTENER CUENTAS FRACCIONADAS DE UNA ORDEN
// ============================================================
exports.getSplitAccounts = (req, res) => {
  const { orden_id } = req.params;

  db.all(
    `SELECT * FROM cuentas_fraccionadas WHERE orden_id = ?`,
    [orden_id],
    (err, cuentas) => {
      if (err) return res.status(500).json({ error: err.message });

      // Obtener items de cada cuenta
      const promises = cuentas.map(cuenta => {
        return new Promise((resolve, reject) => {
          db.all(
            `SELECT cfi.*, p.nombre as producto_nombre
             FROM cuenta_fraccionada_items cfi
             JOIN orden_detalles od ON cfi.orden_detalle_id = od.id
             JOIN productos p ON od.producto_id = p.id
             WHERE cfi.cuenta_fraccionada_id = ?`,
            [cuenta.id],
            (err, items) => {
              if (err) return reject(err);
              resolve({ ...cuenta, items });
            }
          );
        });
      });

      Promise.all(promises)
        .then(cuentasConItems => res.json(cuentasConItems))
        .catch(err => res.status(500).json({ error: err.message }));
    }
  );
};

// ============================================================
// 3. PAGAR UNA FRACCIÓN DE CUENTA
// ============================================================
exports.payFraction = (req, res) => {
  const { cuenta_fraccionada_id, metodo, monto_recibido } = req.body;

  if (!cuenta_fraccionada_id || !metodo) {
    return res.status(400).json({ error: 'cuenta_fraccionada_id y metodo son obligatorios' });
  }

  db.get(
    `SELECT * FROM cuentas_fraccionadas WHERE id = ?`,
    [cuenta_fraccionada_id],
    (err, cuenta) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!cuenta) return res.status(404).json({ error: 'Cuenta fraccionada no encontrada' });
      if (cuenta.estado === 'pagada') {
        return res.status(400).json({ error: 'Esta fracción ya está pagada' });
      }

      const cambio = monto_recibido ? monto_recibido - cuenta.total : 0;

      db.run(
        `UPDATE cuentas_fraccionadas SET estado = 'pagada', fecha_pago = CURRENT_TIMESTAMP WHERE id = ?`,
        [cuenta_fraccionada_id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          // Verificar si todas las fracciones están pagadas
          db.get(
            `SELECT COUNT(*) as pendientes FROM cuentas_fraccionadas WHERE orden_id = ? AND estado = 'abierta'`,
            [cuenta.orden_id],
            (err, result) => {
              if (err) return res.status(500).json({ error: err.message });

              // Si no quedan fracciones pendientes, cerrar la orden
              if (result.pendientes === 0) {
                db.run(
                  `UPDATE ordenes SET estado = 'pagada', fecha_cierre = CURRENT_TIMESTAMP WHERE id = ?`,
                  [cuenta.orden_id]
                );
              }

              res.json({
                message: 'Fracción pagada exitosamente',
                cuenta_fraccionada_id,
                cambio,
                orden_completada: result.pendientes === 0
              });
            }
          );
        }
      );
    }
  );
};
