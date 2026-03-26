import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export async function initDb() {
    db = await open({
        filename: path.join(__dirname, 'staking.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS stakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_address TEXT NOT NULL,
            amount INTEGER NOT NULL,
            days INTEGER NOT NULL,
            stake_time INTEGER NOT NULL,
            lock_period INTEGER NOT NULL,
            fixed_rate INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS processed_txs (
            tx_hash TEXT PRIMARY KEY,
            processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    // Сохраняем адрес лидера
    await db.run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        ['leader_address', process.env.LEADER_ADDRESS]
    );

    return db;
}

export function getDb() {
    return db;
}