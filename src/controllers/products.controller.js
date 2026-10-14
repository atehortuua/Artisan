const db = require('../config/database');

// ============================================================
// 1. OBTENER TODOS LOS PRODUCTOS
// ============================================================
exports.getProducts = (req, res) => {
  const query = `
    SELECT p.*, c.nombre as categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.activo = 1
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ============================================================
// 2. CREAR PRODUCTO
// ============================================================
exports.createProduct = (req, res) => {
  const { categoria_id, nombre, descripcion, precio_venta, precio_costo, stock_actual, control_stock } = req.body;

  // Validaciones
  if (!nombre || !precio_venta) {
    return res.status(400).json({ error: 'nombre y precio_venta son obligatorios' });
  }
  if (precio_venta < 0) {
    return res.status(400).json({ error: 'precio_venta no puede ser negativo' });
  }

  const query = `
    INSERT INTO productos (categoria_id, nombre, descripcion, precio_venta, precio_costo, stock_actual, control_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [categoria_id || null, nombre, descripcion || null, precio_venta, precio_costo || 0, stock_actual || 0, control_stock ? 1 : 0],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, nombre, precio_venta });
    }
  );
};

// ============================================================
// 3. OBTENER CATEGORÍAS
// ============================================================
exports.getCategories = (req, res) => {
  db.all(`SELECT * FROM categorias`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ============================================================
// 4. CREAR CATEGORÍA
// ============================================================
exports.createCategory = (req, res) => {
  const { nombre, icono } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'nombre es obligatorio' });
  }

  db.run(
    `INSERT INTO categorias (nombre, icono) VALUES (?, ?)`,
    [nombre, icono || null],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, nombre, icono });
    }
  );
};

// ============================================================
// 4a. ACTUALIZAR CATEGORÍA
// ============================================================
exports.updateCategory = (req, res) => {
  const { id } = req.params;
  const { nombre, icono } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'nombre es obligatorio' });
  }

  db.run(
    `UPDATE categorias SET nombre = ?, icono = ? WHERE id = ?`,
    [nombre, icono || null, id],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
      res.json({ id: Number(id), nombre, icono: icono || null });
    }
  );
};

// ============================================================
// 4b. ELIMINAR CATEGORÍA
// ============================================================
exports.deleteCategory = (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM categorias WHERE id = ?`, [id], function (err) {
    if (err) {
      // Si la categoría está en uso por productos/modificadores, SQLite lanza FK error
      return res.status(400).json({ error: 'No se puede eliminar: la categoría está en uso' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.status(204).send();
  });
};

// ============================================================
// 5. ACTUALIZAR STOCK DE PRODUCTO
// ============================================================
exports.updateStock = (req, res) => {
  const { id } = req.params;
  const { stock_actual } = req.body;

  if (stock_actual === undefined || stock_actual < 0) {
    return res.status(400).json({ error: 'stock_actual es obligatorio y debe ser >= 0' });
  }

  db.run(
    `UPDATE productos SET stock_actual = ? WHERE id = ?`,
    [stock_actual, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json({ message: 'Stock actualizado', id, stock_actual });
    }
  );
};

// ============================================================
// 6. OBTENER MODIFICADORES
// ============================================================
exports.getModifiers = (req, res) => {
  db.all(`SELECT * FROM modificadores`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ============================================================
// 7. CREAR MODIFICADOR
// ============================================================
exports.createModifier = (req, res) => {
  const { nombre, precio, categoria_id } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'nombre es obligatorio' });
  }

  db.run(
    `INSERT INTO modificadores (nombre, precio, categoria_id) VALUES (?, ?, ?)`,
    [nombre, precio || 0, categoria_id || null],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, nombre, precio: precio || 0 });
    }
  );
};
