import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

export const pool = new Pool({
    connectionString: DATABASE_URL,
});

export let dbReady = false;

export async function connectDb(): Promise<void> {
    try {
        await pool.query('SELECT NOW()');
        console.log("[DB] Kitchen Service ansluten till PostgreSQL!");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS kitchen_orders (
                id UUID PRIMARY KEY,
                customer_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS kitchen_order_items (
                id SERIAL PRIMARY KEY,
                order_id UUID REFERENCES kitchen_orders(id) ON DELETE CASCADE,
                product_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                quantity INT NOT NULL
            );
        `);
        console.log("[DB] Kitchen databasstrukturen har verifierats/skapats!");
        dbReady = true;
    } catch (err) {
        console.error("[DB] Kitchen Service kunde inte ansluta till PostgreSQL, försöker igen om 5 sekunder...", err);
        dbReady = false;
        setTimeout(connectDb, 5000);
    }
}

export interface KitchenOrderItem {
    id: number;
    name: string;
    quantity: number;
}

export interface KitchenOrder {
    id: string;
    customerId: string;
    items: KitchenOrderItem[];
    status: string;
    createdAt: Date;
}

export async function saveKitchenOrder(order: KitchenOrder): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            'INSERT INTO kitchen_orders (id, customer_id, status, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING RETURNING id',
            [order.id, order.customerId, order.status, order.createdAt]
        );
        if (result.rowCount && result.rowCount > 0) {
            for (const item of order.items) {
                await client.query(
                    'INSERT INTO kitchen_order_items (order_id, product_id, name, quantity) VALUES ($1, $2, $3, $4)',
                    [order.id, item.id, item.name, item.quantity]
                );
            }
        }
        await client.query('COMMIT');
    } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
    } finally {
        client.release();
    }
}

export async function getKitchenOrderById(id: string): Promise<KitchenOrder | null> {
    const orderResult = await pool.query('SELECT * FROM kitchen_orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) {
        return null;
    }

    const orderRow = orderResult.rows[0];
    const itemsResult = await pool.query('SELECT product_id as id, name, quantity FROM kitchen_order_items WHERE order_id = $1', [id]);

    return {
        id: orderRow.id,
        customerId: orderRow.customer_id,
        status: orderRow.status,
        createdAt: orderRow.created_at,
        items: itemsResult.rows
    };
}

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
    const ordersResult = await pool.query('SELECT * FROM kitchen_orders ORDER BY created_at DESC');
    const orders: KitchenOrder[] = [];
    for (const orderRow of ordersResult.rows) {
        const itemsResult = await pool.query('SELECT product_id as id, name, quantity FROM kitchen_order_items WHERE order_id = $1', [orderRow.id]);
        orders.push({
            id: orderRow.id,
            customerId: orderRow.customer_id,
            status: orderRow.status,
            createdAt: orderRow.created_at,
            items: itemsResult.rows
        });
    }
    return orders;
}

export async function updateKitchenOrderStatus(id: string, status: string): Promise<void> {
    await pool.query('UPDATE kitchen_orders SET status = $1 WHERE id = $2', [status, id]);
}
