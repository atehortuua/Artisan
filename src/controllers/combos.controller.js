const db = require('../config/database');

// ============================================================
// 1. OBTENER TODOS LOS COMBOS
// ============================================================
exports.getCombos = (req, res) => {
  const query = `
    SELECT c.*,
           GROUP_CONCAT(p.nombre || ' x' || cp.cantidad, ', ') as productos
    FROM combos c
    LEFT JOIN combo_productos cp ON c.id = cp.combo_id
    LEFT JOIN productos p ON cp.producto_id = p.id
    WHERE c.activo = 1
    GROUP BY c.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ============================================================
// 2. CREAR COMBO
// ============================================================
exports.createCombo = (req, res) => {
  const { nombre, descripcion, precio_combo, productos } = req.body;

  if (!nombre || !precio_combo || !productos || productos.length === 0) {
    return res.status(400).json({ error: 'nombre, precio_combo y productos son obligatorios' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(
      `INSERT INTO combos (nombre, descripcion, precio_combo) VALUES (?, ?, ?)`,
      [nombre, descripcion || null, precio_combo],
      function (err) {
        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

        const comboId = this.lastID;

        // Insertar productos del combo
        const stmt = db.prepare(
          `INSERT INTO combo_productos (combo_id, producto_id, cantidad) VALUES (?, ?, ?)`
        );

        productos.forEach(prod => {
          stmt.run([comboId, prod.producto_id, prod.cantidad || 1]);
        });

        stmt.finalize((err) => {
          if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }

          db.run('COMMIT', (err) => {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
            res.status(201).json({ id: comboId, nombre, precio_combo });
          });
        });
      }
    );
  });
};

// ============================================================
// 3. OBTENER COMBO POR ID (con detalle de productos)
// ============================================================
exports.getComboById = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM combos WHERE id = ?`, [id], (err, combo) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!combo) return res.status(404).json({ error: 'Combo no encontrado' });

    db.all(
      `SELECT cp.*, p.nombre, p.precio_venta
       FROM combo_productos cp
       JOIN productos p ON cp.producto_id = p.id
       WHERE cp.combo_id = ?`,
      [id],
      (err, productos) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ...combo, productos });
      }
    );
  });
};

// ============================================================
// 4. ACTUALIZAR COMBO
// ============================================================
exports.updateCombo = (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio_combo, activo } = req.body;

  db.run(
    `UPDATE combos SET nombre = ?, descripcion = ?, precio_combo = ?, activo = ? WHERE id = ?`,
    [nombre, descripcion, precio_combo, activo ? 1 : 0, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Combo no encontrado' });
      res.json({ message: 'Combo actualizado', id });
    }
  );
};

// ============================================================
// 5. ELIMINAR COMBO (soft delete)
// ============================================================
exports.deleteCombo = (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE combos SET activo = 0 WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Combo no encontrado' });
      res.json({ message: 'Combo eliminado (desactivado)', id });
    }
  );
};
