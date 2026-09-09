const db = require('../config/database');

// 1. Abrir Turno de Caja
exports.openShift = (req, res) => {
  const { monto_inicial, cajero_id } = req.body;

  db.run(
    `INSERT INTO turnos_caja (cajero_id, monto_inicial, estado) VALUES (?, ?, 'abierta')`,
    [cajero_id || 1, monto_inicial || 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.status(201).json({ 
        turno_id: this.lastID, 
        monto_inicial: monto_inicial || 0, 
        estado: 'abierta' 
      });
    }
  );
};

// 2. Procesar Pago
exports.processPayment = (req, res) => {
  const { orden_id, turno_caja_id, metodo, monto, monto_recibido, referencia } = req.body;
  const cambio = monto_recibido > monto ? monto_recibido - monto : 0;

  db.serialize(() => {
    let hasError = false;

    // 1. Registrar el Pago
    db.run(
      `INSERT INTO pagos (orden_id, turno_caja_id, metodo, monto, monto_recibido, cambio, referencia) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orden_id, turno_caja_id, metodo, monto, monto_recibido || monto, cambio, referencia || null],
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }
      }
    );

    // 2. Cerrar la Orden
    db.run(
      `UPDATE ordenes SET estado = 'pagada', fecha_cierre = CURRENT_TIMESTAMP WHERE id = ?`,
      [orden_id],
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }
      }
    );

    // 3. Liberar la Mesa
    db.run(
      `UPDATE mesas SET estado = 'libre', orden_activa_id = NULL WHERE orden_activa_id = ?`,
      [orden_id],
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }
      }
    );

    // 4. Actualizar Totales del Turno de Caja
    let columnaVenta = 'total_ventas_efectivo';
    if (metodo && metodo.includes('tarjeta')) columnaVenta = 'total_ventas_tarjeta';
    if (metodo === 'transferencia') columnaVenta = 'total_ventas_transferencia';

    db.run(
      `UPDATE turnos_caja SET ${columnaVenta} = ${columnaVenta} + ? WHERE id = ?`,
      [monto, turno_caja_id],
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }

        if (!hasError) {
          return res.json({ 
            message: 'Pago procesado exitosamente', 
            orden_id, 
            cambio 
          });
        }
      }
    );
  });
};

// 3. Cerrar Turno de Caja (Cierre Z)
exports.closeShift = (req, res) => {
  const { turno_id, monto_real_contado } = req.body;

  db.get(`SELECT * FROM turnos_caja WHERE id = ?`, [turno_id], (err, turno) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });

    const totalEsperado = turno.monto_inicial + turno.total_ventas_efectivo;
    const diferencia = monto_real_contado - totalEsperado;

    const query = `
      UPDATE turnos_caja 
      SET fecha_cierre = CURRENT_TIMESTAMP, monto_real_contado = ?, diferencia = ?, estado = 'cerrada'
      WHERE id = ?
    `;

    db.run(query, [monto_real_contado, diferencia, turno_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.json({
        message: 'Caja cerrada exitosamente (Cierre Z)',
        monto_inicial: turno.monto_inicial,
        ventas_efectivo: turno.total_ventas_efectivo,
        ventas_tarjeta: turno.total_ventas_tarjeta,
        monto_esperado_efectivo: totalEsperado,
        monto_real_contado,
        diferencia
      });
    });
  });
};