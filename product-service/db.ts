import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

export const pool = new Pool({
    connectionString: DATABASE_URL,
});

export let dbReady = false;

export async function connectDb(log: any): Promise<void> {
    try {
        await pool.query('SELECT NOW()');
        log.info("[DB] Product Service ansluten till PostgreSQL!");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price INT NOT NULL
            );
        `);

        const countRes = await pool.query('SELECT COUNT(*) FROM products');
        const count = parseInt(countRes.rows[0].count);
        if (count === 0) {
            log.info("[DB] Seedar standardmeny...");
            const defaultMenu = [
                { name: "Falafelburgare", price: 89 },
                { name: "Pommes", price: 35 },
                { name: "Islatte", price: 29 },
                { name: "Läsk", price: 25 }
            ];
            for (const item of defaultMenu) {
                await pool.query('INSERT INTO products (name, price) VALUES ($1, $2)', [item.name, item.price]);
            }
            log.info("[DB] Seeding klar!");
        }

        dbReady = true;
    } catch (err) {
        log.error("[DB] Product Service kunde inte ansluta till PostgreSQL, försöker igen om 5 sekunder...", err);
        dbReady = false;
        setTimeout(() => connectDb(log), 5000);
    }
}

export async function getProducts() {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    return result.rows;
}

export async function createProduct(name: string, price: number) {
    const result = await pool.query(
        'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *',
        [name, price]
    );
    return result.rows[0];
}
