const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(process.env.DATABASE_PATH || './src/database/pos.db');

// Crear la carpeta database si no existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con SQLite:', err.message);
  } else {
    console.log(' Conectado exitosamente a la base de datos SQLite.');
  }
});

// Inicializar esquemas
const initDb = () => {
  const schemaPath = path.resolve(__dirname, '../../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema, (err) => {
    if (err) {
      console.error('Error ejecutando el Schema SQL:', err.message);
    } else {
      console.log(' Tablas creadas/verificadas correctamente.');
    }
  });
};

initDb();

module.exports = db;