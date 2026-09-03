const db = require('../config/database');

exports.getProducts = (req, res) => {
  const query = `
    SELECT p.*, c.nombre as categoria_nombre 
    FROM productos p 
    LEFT JOIN categorias c ON p.categoria_id = c.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createProduct = (req, res) => {
  const { categoria_id, nombre, descripcion, precio_venta, precio_costo, stock_actual, control_stock } = req.body;
  
  const query = `
    INSERT INTO productos (categoria_id, nombre, descripcion, precio_venta, precio_costo, stock_actual, control_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(
    query,
    [categoria_id, nombre, descripcion, precio_venta, precio_costo || 0, stock_actual || 0, control_stock ? 1 : 0],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, nombre, precio_venta });
    }
  );
};

exports.getCategories = (req, res) => {
  db.all(`SELECT * FROM categorias`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};