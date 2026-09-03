const db = require('../config/database');

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

exports.createTable = (req, res) => {
  const { numero, capacidad } = req.body;
  db.run(
    `INSERT INTO mesas (numero, capacidad) VALUES (?, ?)`,
    [numero, capacidad || 4],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, numero, estado: 'libre' });
    }
  );
};

exports.updateTableStatus = (req, res) => {
  const { id } = req.params;
  const { estado, orden_activa_id } = req.body;
  
  db.run(
    `UPDATE mesas SET estado = ?, orden_activa_id = ? WHERE id = ?`,
    [estado, orden_activa_id, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Mesa actualizada', changes: this.changes });
    }
  );
};


