const db = require("../config/database");

class OrderService {
    static getOrderTotal(ordenId) {
        return new Promise((resolve, reject) => {
            // Corrección: orden_detalles y orden_id correctamente escritos
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

    static updateOrderTotals(ordenId) {
        return new Promise(async (resolve, reject) => {
            try {
                // Corrección: Usamos OrderService.getOrderTotal de forma explícita
                const subtotal = await OrderService.getOrderTotal(ordenId);
                const query = `UPDATE ordenes SET subtotal = ?, total = ? WHERE id = ?`;

                db.run(query, [subtotal, subtotal, ordenId], function (err) {
                    if (err) return reject(err);
                    resolve(subtotal);
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = OrderService;