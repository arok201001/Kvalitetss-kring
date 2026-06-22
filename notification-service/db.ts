import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

export const pool = new Pool({
    connectionString: DATABASE_URL,
});

export let dbReady = false;

export async function connectDb(): Promise<void> {
    try {
        await pool.query('SELECT NOW()');
        console.log("[DB] Notification Service ansluten till PostgreSQL!");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                order_id UUID NOT NULL,
                customer_id VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        console.log("[DB] Databasstrukturen har verifierats/skapats!");
        dbReady = true;
    } catch (err) {
        console.error("[DB] Kunde inte ansluta till PostgreSQL, försöker igen om 5 sekunder...", err);
        dbReady = false;
        setTimeout(connectDb, 5000);
    }
}

export interface Notification {
    id: number;
    orderId: string;
    customerId: string;
    message: string;
    createdAt: Date;
}

export async function saveNotification(orderId: string, customerId: string, message: string): Promise<void> {
    await pool.query(
        'INSERT INTO notifications (order_id, customer_id, message) VALUES ($1, $2, $3)',
        [orderId, customerId, message]
    );
}

export async function getNotifications(): Promise<Notification[]> {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    return result.rows.map((row: any) => ({
        id: row.id,
        orderId: row.order_id,
        customerId: row.customer_id,
        message: row.message,
        createdAt: row.created_at,
    }));
}

export async function getNotificationsByCustomerId(customerId: string): Promise<Notification[]> {
    const result = await pool.query(
        'SELECT * FROM notifications WHERE customer_id = $1 ORDER BY created_at DESC',
        [customerId]
    );
    return result.rows.map((row: any) => ({
        id: row.id,
        orderId: row.order_id,
        customerId: row.customer_id,
        message: row.message,
        createdAt: row.created_at,
    }));
}
