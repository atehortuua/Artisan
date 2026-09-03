const db = require("../config/database");



class OrderService {
    static getOrderTotal(ordenId) {
        return new Promise((resolve, reject) => {
            const query = `
            SELECT SUM(subtotal) as subtotal
            FROM order_detalles
            WHERE orde_id = ?
            
            `;

            db.get(query, [ordenId], (err, row) => {
                if (err) reject(err);
                resolve(row ? row.subtotal || 0 : 0);
            });
        });
    }
    static updateOrderTotals(ordenId) {
        return new Promise(async (resolve, reject) => {
            try {
                const subtotal = await this.getOrdenTotal(ordenId);
                const query = `UPDATE ordenes SET subtotal = ?, total = ? WHERE id =?`
                db.run(query, [subtotal, subtotal, ordenId], function (err) {
                    if (err) reject(err);
                    resolve(subtotal);
                })
            } catch (err) {
                reject(err)
            }
        })
    }




}


module.exports = OrderService