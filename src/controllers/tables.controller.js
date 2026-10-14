const db = require('../config/database');

// ============================================================
// 1. OBTENER TODAS LAS MESAS
// ============================================================
exports.getTables = (req, res) => {
  const query = `
    SELECT m.*, o.total as total_acumulado
    FROM mesas m
    LEFT JOIN ordenes o ON m.orden_activa_id = o.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ============================================================
// 2. CREAR MESA
// ============================================================
exports.createTable = (req, res) => {
  const { numero, capacidad } = req.body;

  if (!numero) {
    return res.status(400).json({ error: 'numero es obligatorio' });
  }

  db.run(
    `INSERT INTO mesas (numero, capacidad) VALUES (?, ?)`,
    [numero, capacidad || 4],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, numero, estado: 'libre' });
    }
  );
};

// ============================================================
// 3. ACTUALIZAR ESTADO DE MESA
// ============================================================
exports.updateTableStatus = (req, res) => {
  const { id } = req.params;
  const { estado, orden_activa_id } = req.body;

  // Validar que el estado sea uno de los permitidos
  const estadosValidos = ['libre', 'ocupada', 'en_cobro', 'reservada'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({
      error: `estado debe ser uno de: ${estadosValidos.join(', ')}`
    });
  }

  db.run(
    `UPDATE mesas SET estado = ?, orden_activa_id = ? WHERE id = ?`,
    [estado, orden_activa_id || null, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Mesa no encontrada' });
      res.json({ message: 'Mesa actualizada', changes: this.changes });
    }
  );
};

// ============================================================
// 4. LIBERAR MESA
// ============================================================
exports.releaseTable = (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE mesas SET estado = 'libre', orden_activa_id = NULL WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Mesa no encontrada' });
      return res.json({ message: `Mesa ${id} liberada y desvinculada correctamente` });
    }
  );
};
