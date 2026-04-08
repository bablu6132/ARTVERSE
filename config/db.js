const mysql = require('mysql2/promise');

// Create one shared connection pool for the whole app.
const poolConfig = {
  host: 'localhost',
  user: 'root',
  password: '05062006',
  database: 'artverse',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(poolConfig);

module.exports = pool;
