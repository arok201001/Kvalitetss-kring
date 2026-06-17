import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

export const pool = new Pool({
    connectionString: DATABASE_URL,
});

export let dbReady = false;

export async function connectDb(): Promise<void> {
    try {
        await pool.query('SELECT NOW()');
        console.log("[DB] Order Service ansluten till PostgreSQL!");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY,
                customer_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                product_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                quantity INT NOT NULL
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

export interface OrderItem {
    id: number;
    name: string;
    quantity: number;
}

export interface Order {
    id: string;
    customerId: string;
    items: OrderItem[];
    status: string;
    createdAt: Date;
}

export async function saveOrder(order: Order): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            'INSERT INTO orders (id, customer_id, status, created_at) VALUES ($1, $2, $3, $4)',
            [order.id, order.customerId, order.status, order.createdAt]
        );
        for (const item of order.items) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, name, quantity) VALUES ($1, $2, $3, $4)',
                [order.id, item.id, item.name, item.quantity]
            );
        }
        await client.query('COMMIT');
    } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
    } finally {
        client.release();
    }
}

export async function getOrderById(id: string): Promise<Order | null> {
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) {
        return null;
    }

    const orderRow = orderResult.rows[0];
    const itemsResult = await pool.query('SELECT product_id as id, name, quantity FROM order_items WHERE order_id = $1', [id]);

    return {
        id: orderRow.id,
        customerId: orderRow.customer_id,
        status: orderRow.status,
        createdAt: orderRow.created_at,
        items: itemsResult.rows
    };
}

export async function getAllOrders(): Promise<Order[]> {
    const ordersResult = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    const orders: Order[] = [];
    for (const orderRow of ordersResult.rows) {
        const itemsResult = await pool.query('SELECT product_id as id, name, quantity FROM order_items WHERE order_id = $1', [orderRow.id]);
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

export async function updateOrderStatus(id: string, status: string): Promise<void> {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
}
