const db = require('../config/database');

// ============================================================
// 1. REGISTRAR CIERRE DE CAJA (Preventivo / Parcial / Final)
// ============================================================
exports.registerClosure = (req, res) => {
  const { turno_id, tipo, monto_real_contado, observaciones, ruta_imagen_factura } = req.body;

  if (!turno_id || !tipo) {
    return res.status(400).json({ error: 'turno_id y tipo son obligatorios' });
  }

  const tiposValidos = ['preventivo', 'parcial', 'final'];
  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: `tipo debe ser uno de: ${tiposValidos.join(', ')}` });
  }

  // Obtener el turno para calcular totales
  db.get(`SELECT * FROM turnos_caja WHERE id = ?`, [turno_id], (err, turno) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });

    const totalVentas = turno.total_ventas_efectivo + turno.total_ventas_tarjeta +
                        turno.total_ventas_transferencia + turno.total_ventas_otros;
    const totalEsperado = turno.monto_inicial + totalVentas;
    const diferencia = monto_real_contado ? monto_real_contado - totalEsperado : 0;

    db.run(
      `INSERT INTO cierres_caja (turno_id, tipo, monto_efectivo, monto_tarjeta, monto_transferencia,
                                  total_ventas, monto_real_contado, diferencia, observaciones, ruta_imagen_factura)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [turno_id, tipo, turno.total_ventas_efectivo, turno.total_ventas_tarjeta,
       turno.total_ventas_transferencia, totalVentas, monto_real_contado || 0,
       diferencia, observaciones || null, ruta_imagen_factura || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          id: this.lastID,
          turno_id,
          tipo,
          total_ventas: totalVentas,
          monto_real_contado: monto_real_contado || 0,
          diferencia
        });
      }
    );
  });
};

// ============================================================
// 2. OBTENER CIERRES DE UN TURNO
// ============================================================
exports.getClosuresByShift = (req, res) => {
  const { turno_id } = req.params;

  db.all(
    `SELECT * FROM cierres_caja WHERE turno_id = ? ORDER BY fecha DESC`,
    [turno_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// ============================================================
// 3. OBTENER ÚLTIMO CIERNE (para mostrar en dashboard)
// ============================================================
exports.getLastClosure = (req, res) => {
  db.get(
    `SELECT * FROM cierres_caja ORDER BY fecha DESC LIMIT 1`,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json({ message: 'No hay cierres registrados', cierre: null });
      res.json({ cierre: row });
    }
  );
};
