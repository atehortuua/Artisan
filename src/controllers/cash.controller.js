const db = require('../config/database');

// ============================================================
// 1. ABRIR TURNO DE CAJA
// ============================================================
// Se llama cuando el cajero inicia su turno.
// Valida que no haya otro turno abierto para evitar duplicados.
exports.openShift = (req, res) => {
  const { monto_inicial, cajero_id } = req.body;

  // Validación: monto_inicial es obligatorio y debe ser >= 0
  if (monto_inicial === undefined || monto_inicial === null || monto_inicial < 0) {
    return res.status(400).json({ error: 'monto_inicial es obligatorio y debe ser >= 0' });
  }

  // Verificar que NO exista un turno abierto actualmente
  db.get(`SELECT id FROM turnos_caja WHERE estado = 'abierta'`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    // Si ya hay un turno abierto, no se puede abrir otro
    if (row) {
      return res.status(409).json({
        error: 'Ya existe un turno de caja abierto',
        turno_abierto_id: row.id
      });
    }

    // Insertar el nuevo turno
    db.run(
      `INSERT INTO turnos_caja (cajero_id, monto_inicial, estado) VALUES (?, ?, 'abierta')`,
      [cajero_id || 1, monto_inicial],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        return res.status(201).json({
          turno_id: this.lastID,
          monto_inicial: monto_inicial,
          estado: 'abierta'
        });
      }
    );
  });
};

// ============================================================
// 2. PROCESAR PAGO
// ============================================================
// Registra un pago, cierra la orden, libera la mesa y actualiza totales del turno.
// Usa transacción real (BEGIN/COMMIT/ROLLBACK) para garantizar atomicidad.
exports.processPayment = (req, res) => {
  const { orden_id, turno_caja_id, metodo, monto, monto_recibido, referencia } = req.body;

  // Validaciones de entrada
  if (!orden_id || !turno_caja_id || !metodo || !monto) {
    return res.status(400).json({ error: 'orden_id, turno_caja_id, metodo y monto son obligatorios' });
  }
  if (monto <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }

  // Calcular cambio (vuelto)
  const cambio = monto_recibido > monto ? monto_recibido - monto : 0;

  // Iniciar transacción: todas las operaciones deben completarse o ninguna
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Paso 1: Verificar que la orden exista y esté abierta
    db.get(`SELECT * FROM ordenes WHERE id = ?`, [orden_id], (err, orden) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (!orden) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      if (orden.estado !== 'abierta') {
        db.run('ROLLBACK');
        return res.status(400).json({ error: `La orden no está abierta (estado: ${orden.estado})` });
      }

      // Paso 2: Verificar que el turno de caja exista y esté abierto
      db.get(`SELECT * FROM turnos_caja WHERE id = ?`, [turno_caja_id], (err, turno) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        if (!turno) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Turno de caja no encontrado' });
        }
        if (turno.estado !== 'abierta') {
          db.run('ROLLBACK');
          return res.status(400).json({ error: 'El turno de caja está cerrado' });
        }

        // Paso 3: Verificar que el monto del pago cubra el total de la orden
        if (monto < orden.total) {
          db.run('ROLLBACK');
          return res.status(400).json({
            error: 'El monto del pago es menor al total de la orden',
            total_orden: orden.total,
            monto_pagado: monto
          });
        }

        // Paso 4: Insertar el pago
        db.run(
          `INSERT INTO pagos (orden_id, turno_caja_id, metodo, monto, monto_recibido, cambio, referencia)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orden_id, turno_caja_id, metodo, monto, monto_recibido || monto, cambio, referencia || null],
          function (err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            // Paso 5: Cerrar la orden
            db.run(
              `UPDATE ordenes SET estado = 'pagada', fecha_cierre = CURRENT_TIMESTAMP WHERE id = ?`,
              [orden_id],
              function (err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                // Paso 6: Liberar la mesa si la orden estaba en mesa
                if (orden.mesa_id) {
                  db.run(
                    `UPDATE mesas SET estado = 'libre', orden_activa_id = NULL WHERE orden_activa_id = ?`,
                    [orden_id],
                    function (err) {
                      if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                      }
                      finalizeTransaction();
                    }
                  );
                } else {
                  finalizeTransaction();
                }

                // Función interna para finalizar la transacción
                function finalizeTransaction() {
                  // Paso 7: Actualizar totales del turno de caja
                  // Se usa un mapa para evitar interpolación de strings en la query
                  const metodoColumna = {
                    'efectivo': 'total_ventas_efectivo',
                    'tarjeta_debito': 'total_ventas_tarjeta',
                    'tarjeta_credito': 'total_ventas_tarjeta',
                    'transferencia': 'total_ventas_transferencia',
                    'mixto': 'total_ventas_otros'
                  };

                  const columna = metodoColumna[metodo] || 'total_ventas_otros';

                  db.run(
                    `UPDATE turnos_caja SET ${columna} = ${columna} + ? WHERE id = ?`,
                    [monto, turno_caja_id],
                    function (err) {
                      if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                      }

                      // Confirmar transacción: todos los cambios se guardan
                      db.run('COMMIT', (err) => {
                        if (err) {
                          db.run('ROLLBACK');
                          return res.status(500).json({ error: err.message });
                        }
                        return res.json({
                          message: 'Pago procesado exitosamente',
                          orden_id,
                          cambio,
                          metodo,
                          monto
                        });
                      });
                    }
                  );
                }
              }
            );
          }
        );
      });
    });
  });
};

// ============================================================
// 3. CERRAR TURNO DE CAJA (Cierre Z)
// ============================================================
// Se llama al final del turno. Calcula la diferencia entre lo esperado y lo contado.
// Ahora SÍ considera todos los métodos de pago (efectivo + tarjeta + transferencia).
exports.closeShift = (req, res) => {
  const { turno_id, monto_real_contado, fondo_manana } = req.body;

  if (!turno_id) {
    return res.status(400).json({ error: 'turno_id es obligatorio' });
  }

  db.get(`SELECT * FROM turnos_caja WHERE id = ?`, [turno_id], (err, turno) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
    if (turno.estado === 'cerrada') {
      return res.status(400).json({ error: 'El turno ya está cerrado' });
    }

    // CORRECCIÓN: Calcular el total esperado considerando TODOS los métodos de pago
    // El dinero total que debería haber en caja es:
    // monto_inicial + ventas_efectivo + ventas_tarjeta + ventas_transferencia
    const totalVentas = turno.total_ventas_efectivo + turno.total_ventas_tarjeta + turno.total_ventas_transferencia + turno.total_ventas_otros;
    const totalEsperado = turno.monto_inicial + totalVentas;

    // La diferencia es lo que el cajero contó menos lo que debería haber
    // Positivo = sobrante, Negativo = faltante
    const diferencia = monto_real_contado - totalEsperado;

    // Calcular monto final (todo lo que hay en caja al cierre)
    const montoFinal = totalEsperado;

    const query = `
      UPDATE turnos_caja
      SET fecha_cierre = CURRENT_TIMESTAMP,
          monto_final = ?,
          fondo_manana = ?,
          monto_real_contado = ?,
          diferencia = ?,
          estado = 'cerrada'
      WHERE id = ?
    `;

    db.run(query, [montoFinal, fondo_manana || 0, monto_real_contado, diferencia, turno_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.json({
        message: 'Caja cerrada exitosamente (Cierre Z)',
        monto_inicial: turno.monto_inicial,
        ventas_efectivo: turno.total_ventas_efectivo,
        ventas_tarjeta: turno.total_ventas_tarjeta,
        ventas_transferencia: turno.total_ventas_transferencia,
        total_ventas: totalVentas,
        monto_esperado: totalEsperado,
        monto_real_contado,
        diferencia,
        fondo_manana: fondo_manana || 0
      });
    });
  });
};

// ============================================================
// 4. REGISTRAR MOVIMIENTO DE CAJA (Entrada/Salida)
// ============================================================
// Para registrar entradas o salidas de efectivo durante el turno.
exports.registerMovement = (req, res) => {
  const { turno_id, tipo, motivo, monto } = req.body;

  if (!turno_id || !tipo || !motivo || !monto) {
    return res.status(400).json({ error: 'turno_id, tipo, motivo y monto son obligatorios' });
  }
  if (tipo !== 'entrada' && tipo !== 'salida') {
    return res.status(400).json({ error: 'tipo debe ser "entrada" o "salida"' });
  }
  if (monto <= 0) {
    return res.status(400).json({ error: 'monto debe ser mayor a 0' });
  }

  db.run(
    `INSERT INTO movimientos_caja (turno_id, tipo, motivo, monto) VALUES (?, ?, ?, ?)`,
    [turno_id, tipo, motivo, monto],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.status(201).json({
        id: this.lastID,
        turno_id,
        tipo,
        motivo,
        monto
      });
    }
  );
};

// ============================================================
// 5. OBTENER TURNO ACTIVO
// ============================================================
// Devuelve el turno de caja actualmente abierto (si existe).
exports.getActiveShift = (req, res) => {
  db.get(`SELECT * FROM turnos_caja WHERE estado = 'abierta'`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.json({ message: 'No hay turno abierto', turno: null });
    return res.json({ turno: row });
  });
};
