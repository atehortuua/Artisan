const db = require('../config/database');

// Abrir Turno de Caja
exports.openShift = (req, res) => {
  const { monto_inicial, cajero_id } = req.body;

  db.run(
    `INSERT INTO turnos_caja (cajero_id, monto_inicial, estado) VALUES (?, ?, 'abierta')`,
    [cajero_id || 1, monto_inicial],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ turno_id: this.lastID, monto_inicial, estado: 'abierta' });
    }
  );
};

// Procesar Pago de una Orden
exports.processPayment = (req, res) => {
  const { orden_id, turno_caja_id, metodo, monto, monto_recibido, referencia } = req.body;
  const cambio = monto_recibido > monto ? monto_recibido - monto : 0;

  db.serialize(() => {
    // 1. Registrar Pago
    db.run(
      `INSERT INTO pagos (orden_id, turno_caja_id, metodo, monto, monto_recibido, cambio, referencia) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orden_id, turno_caja_id, metodo, monto, monto_recibido || monto, cambio, referencia],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
      }
    );

    // 2. Cerrar la Orden
    db.run(
      `UPDATE ordenes SET estado = 'pagada', fecha_cierre = CURRENT_TIMESTAMP WHERE id = ?`,
      [orden_id]
    );

    // 3. Liberar la Mesa vinculada
    db.run(
      `UPDATE mesas SET estado = 'libre', orden_activa_id = NULL WHERE orden_activa_id = ?`,
      [orden_id]
    );

    // 4. Actualizar totales del Turno de Caja
    let columnaVenta = 'total_ventas_efectivo';
    if (metodo.includes('tarjeta')) columnaVenta = 'total_ventas_tarjeta';
    if (metodo === 'transferencia') columnaVenta = 'total_ventas_transferencia';

    db.run(
      `UPDATE turnos_caja SET ${columnaVenta} = ${columnaVenta} + ? WHERE id = ?`,
      [monto, turno_caja_id]
    );

    res.json({ message: 'Pago procesado exitosamente', cambio });
  });
};

// Cierre Z de Caja
exports.closeShift = (req, res) => {
  const { turno_id, monto_real_contado } = req.body;

  db.get(`SELECT * FROM turnos_caja WHERE id = ?`, [turno_id], (err, turno) => {
    if (err || !turno) return res.status(404).json({ error: 'Turno no encontrado' });

    const totalEsperado = turno.monto_inicial + turno.total_ventas_efectivo;
    const diferencia = monto_real_contado - totalEsperado;

    const query = `
      UPDATE turnos_caja 
      SET fecha_cierre = CURRENT_TIMESTAMP, monto_real_contado = ?, diferencia = ?, estado = 'cerrada'
      WHERE id = ?
    `;

    db.run(query, [monto_real_contado, diferencia, turno_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
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