const db = require('../config/database');
const OrderService = require('../services/order.services');

// Abrir orden (Mesa o Para Llevar)
exports.createOrder = (req, res) => {
  const { mesa_id, tipo } = req.body;

  db.run(
    `INSERT INTO ordenes (mesa_id, tipo, estado) VALUES (?, ?, 'abierta')`,
    [mesa_id || null, tipo || 'mesa'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const ordenId = this.lastID;

      // Si es en mesa, vinculamos la orden activa a la mesa
      if (mesa_id) {
        db.run(`UPDATE mesas SET estado = 'ocupada', orden_activa_id = ? WHERE id = ?`, [ordenId, mesa_id]);
      }

      res.status(201).json({ orden_id: ordenId, mesa_id, tipo, estado: 'abierta' });
    }
  );
};

// Agregar un producto/hamburguesa con modificadores/notas
exports.addItemToOrder = (req, res) => {
  const { orden_id, producto_id, cantidad, precio_unitario, notas } = req.body;
  const subtotal = cantidad * precio_unitario;

  const query = `
    INSERT INTO orden_detalles (orden_id, producto_id, cantidad, precio_unitario, notas, subtotal)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [orden_id, producto_id, cantidad, precio_unitario, notas, subtotal], async function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // Actualizar total de la orden
    await OrderService.updateOrderTotals(orden_id);

    res.status(201).json({ id: this.lastID, orden_id, subtotal });
  });
};

// Consultar detalle completo de una orden
exports.getOrderById = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM ordenes WHERE id = ?`, [id], (err, orden) => {
    if (err || !orden) return res.status(404).json({ error: 'Orden no encontrada' });

    const queryItems = `
      SELECT d.*, p.nombre 
      FROM orden_detalles d
      JOIN productos p ON d.producto_id = p.id
      WHERE d.orden_id = ?
    `;

    db.all(queryItems, [id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...orden, items });
    });
  });
};