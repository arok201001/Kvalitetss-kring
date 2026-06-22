import fastify from 'fastify';
import amqp, { Channel } from 'amqplib';
import { randomUUID } from 'crypto';
import {
    connectDb,
    dbReady,
    saveOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    pool
} from './db';
import { orderBodySchema } from './schemas';
import { validateUuid, validateOrderItems } from './utils';

const server = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const RABBITMQ_URL = process.env.RABBITMQ_URL || (() => { throw new Error("RABBITMQ_URL is required") })();
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || (() => { throw new Error("PRODUCT_SERVICE_URL is required") })();

let channel: Channel;

connectDb();

async function connectRabbit() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue("order_queue", { durable: true });
        await channel.assertQueue("kitchen_updates_queue", { durable: true });
        server.log.info("Order Service ansluten till RabbitMQ!");

        channel.consume("kitchen_updates_queue", async (msg) => {
            if (!msg) return;
            try {
                const update = JSON.parse(msg.content.toString()) as { id: string; status: string };
                if (!validateUuid(update.id)) {
                    server.log.warn(`Ogiltigt order-ID format för statusuppdatering: ${update.id}`);
                    channel.ack(msg);
                    return;
                }
                server.log.info(`Uppdaterar order ${update.id} till status ${update.status} i databasen.`);
                await updateOrderStatus(update.id, update.status);
                channel.ack(msg);
            } catch (err) {
                server.log.error("Fel vid hantering av kök-uppdatering:", err);
                channel.nack(msg, false, true);
            }
        });
    } catch (err) {
        server.log.error("Kunde inte ansluta till RabbitMQ, försöker igen om 5 sekunder...", err);
        setTimeout(connectRabbit, 5000);
    }
}

connectRabbit();

interface OrderItem {
    id: number;
    name: string;
    quantity: number;
}

interface OrderRequest {
    customerId: string;
    items: OrderItem[];
}

async function validateProductsExist(items: OrderItem[]): Promise<{ valid: boolean; error?: string }> {
    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products`);
        if (!response.ok) {
            return { valid: false, error: 'Kunde inte hämta produktlistan för validering.' };
        }
        const products = await response.json() as Array<{ id: number; name: string; price: number }>;
        const productIds = new Set(products.map(p => p.id));
        for (const item of items) {
            if (!productIds.has(item.id)) {
                return { valid: false, error: `Produkten med ID ${item.id} finns inte i menyn.` };
            }
        }
        return { valid: true };
    } catch (err) {
        return { valid: false, error: 'Kunde inte nå product-service för validering.' };
    }
}

server.post("/api/orders", {
    schema: {
        body: orderBodySchema
    }
}, async (request, reply) => {
    if (!dbReady || !channel) {
        return reply.status(503).send({ error: "Kötjänsten eller databasen är inte redo än." });
    }

    const { customerId, items } = request.body as OrderRequest;

    if (!validateOrderItems(items)) {
        return reply.status(400).send({ error: 'Ogiltiga order-items. Kontrollera att alla har giltigt id, namn och kvantitet.' });
    }

    const productCheck = await validateProductsExist(items);
    if (!productCheck.valid) {
        return reply.status(400).send({ error: productCheck.error });
    }

    const orderId = randomUUID();
    const order = {
        id: orderId,
        customerId,
        items,
        status: "PENDING",
        createdAt: new Date()
    };

    try {
        await saveOrder(order);
    } catch (dbError) {
        server.log.error('Kunde inte spara ordern i databasen:', dbError);
        return reply.status(500).send({ error: 'Internt fel vid sparande av order.' });
    }

    try {
        channel.sendToQueue('order_queue', Buffer.from(JSON.stringify(order)), { persistent: true });
    } catch (publishError) {
        server.log.error('Kunde inte skicka order till RabbitMQ, rullar tillbaka:', publishError);
        try {
            await pool.query('DELETE FROM orders WHERE id = $1', [order.id]);
        } catch (rollbackError) {
            server.log.error('Kunde inte rulla tillbaka ordern:', rollbackError);
        }
        return reply.status(500).send({ error: 'Internt systemfel vid kö-publicering.' });
    }

    return reply.status(201).send({
        message: 'Order mottagen!',
        orderId: order.id
    });
});

server.get("/api/orders/:id", async (request, reply) => {
    if (!dbReady) {
        return reply.status(503).send({ error: "Databasen är inte redo än." });
    }

    const { id } = request.params as { id: string };

    if (!validateUuid(id)) {
        return reply.status(400).send({ error: 'Ogiltigt order-ID-format.' });
    }

    try {
        const order = await getOrderById(id);
        if (!order) {
            return reply.status(404).send({ error: "Ordern hittades inte." });
        }
        return order;
    } catch (error) {
        server.log.error("Fel vid hämtning av order:", error);
        return reply.status(500).send({ error: "Internt fel vid hämtning av order." });
    }
});

server.get("/api/orders", async (request, reply) => {
    if (!dbReady) {
        return reply.status(503).send({ error: "Databasen är inte redo än." });
    }

    try {
        const orders = await getAllOrders();
        return orders;
    } catch (error) {
        server.log.error("Fel vid hämtning av ordrar:", error);
        return reply.status(500).send({ error: "Internt fel vid hämtning av ordrar." });
    }
});

const start = async () => {
    try {
        await server.listen({ port: PORT, host: "0.0.0.0" });
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();