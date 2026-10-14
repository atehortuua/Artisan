const db = require('../config/database');

// ============================================================
// 1. DASHBOARD PRINCIPAL - Resumen del día
// ============================================================
exports.getDashboard = (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];

  db.serialize(() => {
    // Total ventas del día
    db.get(
      `SELECT COALESCE(SUM(total), 0) as total_ventas,
              COUNT(*) as total_ordenes
       FROM ordenes
       WHERE DATE(fecha_creacion) = ? AND estado = 'pagada'`,
      [hoy],
      (err, ventas) => {
        if (err) return res.status(500).json({ error: err.message });

        // Ventas por método de pago
        db.all(
          `SELECT metodo, SUM(monto) as total
           FROM pagos
           WHERE DATE(fecha) = ?
           GROUP BY metodo`,
          [hoy],
          (err, pagos) => {
            if (err) return res.status(500).json({ error: err.message });

            // Productos más vendidos
            db.all(
              `SELECT p.nombre, SUM(d.cantidad) as cantidad_vendida
               FROM orden_detalles d
               JOIN productos p ON d.producto_id = p.id
               JOIN ordenes o ON d.orden_id = o.id
               WHERE DATE(o.fecha_creacion) = ? AND o.estado = 'pagada'
               GROUP BY p.id
               ORDER BY cantidad_vendida DESC
               LIMIT 5`,
              [hoy],
              (err, topProductos) => {
                if (err) return res.status(500).json({ error: err.message });

                // Mesas ocupadas actualmente
                db.get(
                  `SELECT COUNT(*) as mesas_ocupadas
                   FROM mesas WHERE estado = 'ocupada'`,
                  [],
                  (err, mesas) => {
                    if (err) return res.status(500).json({ error: err.message });

                    res.json({
                      fecha: hoy,
                      total_ventas: ventas.total_ventas,
                      total_ordenes: ventas.total_ordenes,
                      ventas_por_metodo: pagos,
                      top_productos: topProductos,
                      mesas_ocupadas: mesas.mesas_ocupadas
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

// ============================================================
// 2. REPORTE DE VENTAS POR RANGO DE FECHAS
// ============================================================
exports.getSalesReport = (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'fecha_inicio y fecha_fin son obligatorios' });
  }

  db.all(
    `SELECT DATE(fecha_creacion) as fecha,
            COUNT(*) as total_ordenes,
            SUM(total) as total_ventas
     FROM ordenes
     WHERE DATE(fecha_creacion) BETWEEN ? AND ? AND estado = 'pagada'
     GROUP BY DATE(fecha_creacion)
     ORDER BY fecha`,
    [fecha_inicio, fecha_fin],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// ============================================================
// 3. REPORTE DE PRODUCTOS MÁS VENDIDOS
// ============================================================
exports.getTopProducts = (req, res) => {
  const { limite } = req.query;
  const limit = parseInt(limite) || 10;

  db.all(
    `SELECT p.nombre, SUM(d.cantidad) as cantidad_vendida, SUM(d.subtotal) as total_ventas
     FROM orden_detalles d
     JOIN productos p ON d.producto_id = p.id
     JOIN ordenes o ON d.orden_id = o.id
     WHERE o.estado = 'pagada'
     GROUP BY p.id
     ORDER BY cantidad_vendida DESC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// ============================================================
// 4. REPORTE DE CIERRES DE CAJA
// ============================================================
exports.getCashClosuresReport = (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  let query = `
    SELECT cc.*, t.monto_inicial, t.fecha_apertura, t.fecha_cierre
    FROM cierres_caja cc
    JOIN turnos_caja t ON cc.turno_id = t.id
  `;
  const params = [];

  if (fecha_inicio && fecha_fin) {
    query += ` WHERE DATE(cc.fecha) BETWEEN ? AND ?`;
    params.push(fecha_inicio, fecha_fin);
  }

  query += ` ORDER BY cc.fecha DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
