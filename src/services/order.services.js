const db = require("../config/database");

class OrderService {
    // Obtener el subtotal de una orden (suma de todos los detalles)
    static getOrderTotal(ordenId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT SUM(subtotal) as subtotal
                FROM orden_detalles
                WHERE orden_id = ?
            `;

            db.get(query, [ordenId], (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.subtotal || 0 : 0);
            });
        });
    }

    // Actualizar los totales de la orden (subtotal y total con descuento)
    static updateOrderTotals(ordenId) {
        return new Promise(async (resolve, reject) => {
            try {
                const subtotal = await OrderService.getOrderTotal(ordenId);

                // Obtener el descuento actual de la orden
                const orden = await new Promise((resolve, reject) => {
                    db.get(`SELECT descuento FROM ordenes WHERE id = ?`, [ordenId], (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    });
                });

                const descuento = orden ? orden.descuento || 0 : 0;
                const total = subtotal - descuento;

                db.run(
                    `UPDATE ordenes SET subtotal = ?, total = ? WHERE id = ?`,
                    [subtotal, total, ordenId],
                    function (err) {
                        if (err) return reject(err);
                        resolve({ subtotal, total });
                    }
                );
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = OrderService;
