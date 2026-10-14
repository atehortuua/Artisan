const db = require('../config/database');

// ============================================================
// 1. OBTENER TODOS LOS PROVEEDORES
// ============================================================
exports.getSuppliers = (req, res) => {
  db.all(`SELECT * FROM proveedores WHERE activo = 1`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ============================================================
// 2. CREAR PROVEEDOR
// ============================================================
exports.createSupplier = (req, res) => {
  const { nombre, contacto, telefono, email, direccion, rut } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'nombre es obligatorio' });
  }

  db.run(
    `INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, rut)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre, contacto || null, telefono || null, email || null, direccion || null, rut || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, nombre });
    }
  );
};

// ============================================================
// 3. REGISTRAR PAGO A PROVEEDOR
// ============================================================
exports.paySupplier = (req, res) => {
  const { proveedor_id, turno_caja_id, monto, metodo, concepto, numero_factura } = req.body;

  if (!proveedor_id || !monto || !metodo || !concepto) {
    return res.status(400).json({ error: 'proveedor_id, monto, metodo y concepto son obligatorios' });
  }
  if (monto <= 0) {
    return res.status(400).json({ error: 'monto debe ser mayor a 0' });
  }

  const metodosValidos = ['efectivo', 'transferencia', 'cheque'];
  if (!metodosValidos.includes(metodo)) {
    return res.status(400).json({ error: `metodo debe ser uno de: ${metodosValidos.join(', ')}` });
  }

  db.run(
    `INSERT INTO pagos_proveedores (proveedor_id, turno_caja_id, monto, metodo, concepto, numero_factura)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [proveedor_id, turno_caja_id || null, monto, metodo, concepto, numero_factura || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: this.lastID,
        proveedor_id,
        monto,
        metodo,
        concepto
      });
    }
  );
};

// ============================================================
// 4. OBTENER PAGOS A PROVEEDORES
// ============================================================
exports.getSupplierPayments = (req, res) => {
  const { proveedor_id } = req.query;

  let query = `
    SELECT pp.*, p.nombre as proveedor_nombre
    FROM pagos_proveedores pp
    JOIN proveedores p ON pp.proveedor_id = p.id
  `;
  const params = [];

  if (proveedor_id) {
    query += ` WHERE pp.proveedor_id = ?`;
    params.push(proveedor_id);
  }

  query += ` ORDER BY pp.fecha DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
