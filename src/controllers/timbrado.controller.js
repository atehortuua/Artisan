const db = require('../config/database');

// ============================================================
// 1. OBTENER TIMBRADO ACTIVO
// ============================================================
exports.getActiveTimbrado = (req, res) => {
  db.get(
    `SELECT * FROM timbrado WHERE activo = 1 ORDER BY numero_actual ASC LIMIT 1`,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json({ message: 'No hay timbrado activo', timbrado: null });
      res.json({ timbrado: row });
    }
  );
};

// ============================================================
// 2. CREAR NUEVO TIMBRADO
// ============================================================
exports.createTimbrado = (req, res) => {
  const { numero_timbrado, numero_inicio, numero_fin, fecha_vencimiento } = req.body;

  if (!numero_timbrado || !numero_inicio || !numero_fin || !fecha_vencimiento) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (numero_fin <= numero_inicio) {
    return res.status(400).json({ error: 'numero_fin debe ser mayor a numero_inicio' });
  }

  db.run(
    `INSERT INTO timbrado (numero_timbrado, numero_inicio, numero_fin, numero_actual, fecha_vencimiento)
     VALUES (?, ?, ?, ?, ?)`,
    [numero_timbrado, numero_inicio, numero_fin, numero_inicio, fecha_vencimiento],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, numero_timbrado });
    }
  );
};

// ============================================================
// 3. EMITIR FACTURA (vinculada a una orden)
// ============================================================
exports.emitInvoice = (req, res) => {
  const { orden_id, rut_cliente, razon_social } = req.body;

  if (!orden_id) {
    return res.status(400).json({ error: 'orden_id es obligatorio' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Obtener la orden
    db.get(`SELECT * FROM ordenes WHERE id = ?`, [orden_id], (err, orden) => {
      if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
      if (!orden) { db.run('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }

      // Obtener timbrado activo
      db.get(
        `SELECT * FROM timbrado WHERE activo = 1 AND numero_actual <= numero_fin
         ORDER BY numero_actual ASC LIMIT 1`,
        [],
        (err, timbrado) => {
          if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
          if (!timbrado) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: 'No hay timbrado activo o se agotó el rango' });
          }

          // Generar número de factura (formato: XXX-XXX-XXXXXXXX)
          const numeroFactura = String(timbrado.numero_actual).padStart(8, '0');
          const numeroFormateado = `001-001-${numeroFactura}`;

          // Insertar factura
          db.run(
            `INSERT INTO facturas (orden_id, timbrado_id, numero_factura, rut_cliente, razon_social, monto_total)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [orden_id, timbrado.id, numeroFormateado, rut_cliente || null, razon_social || null, orden.total],
            function (err) {
              if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

              // Actualizar número actual del timbrado
              db.run(
                `UPDATE timbrado SET numero_actual = numero_actual + 1 WHERE id = ?`,
                [timbrado.id],
                function (err) {
                  if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

                  db.run('COMMIT', (err) => {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                    res.status(201).json({
                      id: this.lastID,
                      numero_factura: numeroFormateado,
                      monto_total: orden.total,
                      timbrado: timbrado.numero_timbrado
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
};

// ============================================================
// 4. OBTENER FACTURAS
// ============================================================
exports.getInvoices = (req, res) => {
  const query = `
    SELECT f.*, o.total as orden_total, t.numero_timbrado
    FROM facturas f
    JOIN ordenes o ON f.orden_id = o.id
    JOIN timbrado t ON f.timbrado_id = t.id
    ORDER BY f.fecha DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ============================================================
// 5. ANULAR FACTURA
// ============================================================
exports.cancelInvoice = (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE facturas SET estado = 'anulada' WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Factura no encontrada' });
      res.json({ message: 'Factura anulada', id });
    }
  );
};
