// backend/db.js
// MySQL-backed database helper for XYMZ / Taskdesk

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load .env so DB_ vars are available even if server.js loads dotenv later
dotenv.config();

// Create a connection pool to your local MySQL instance
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'taskdesk.cr24a6a4cotv.us-east-2.rds.amazonaws.com',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Password1231234',
  database: process.env.DB_NAME || 'taskdesk',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * db.get(sql, params)
 * - Run a query and return the first row (or null).
 */
async function get(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

/**
 * db.all(sql, params)
 * - Run a query and return all rows as an array.
 */
async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * db.run(sql, params)
 * - Run INSERT/UPDATE/DELETE and return basic metadata.
 */
async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return {
    lastInsertId: result.insertId,
    affectedRows: result.affectedRows
  };
}

module.exports = {
  pool,
  get,
  all,
  run
};