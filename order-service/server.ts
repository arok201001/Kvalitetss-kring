import fastify from 'fastify';
import amqp, { Channel } from 'amqplib';
import { randomUUID } from 'crypto';
import {
    connectDb,
    dbReady,
    saveOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus
} from './db';
import { orderBodySchema } from './schemas';
import { validateUuid } from './utils';

const server = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

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



server.post("/api/orders", {
    schema: {
        body: orderBodySchema
    }
}, async (request, reply) => {
    if (!dbReady || !channel) {
        return reply.status(503).send({ error: "Kötjänsten eller databasen är inte redo än." });
    }

    const { customerId, items } = request.body as OrderRequest;
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
        server.log.error("Kunde inte spara ordern i databasen:", dbError);
        return reply.status(500).send({ error: "Internt fel vid sparande av order." });
    }

    try {
        channel.sendToQueue("order_queue", Buffer.from(JSON.stringify(order)), { persistent: true });
        return reply.status(201).send({
            message: "Order mottagen!",
            orderId: order.id
        });
    } catch (error) {
        server.log.error("Kunde inte skicka order till RabbitMQ:", error);
        return reply.status(500).send({ error: "Internt systemfel vid kö-publicering." });
    }
});

server.get("/api/orders/:id", async (request, reply) => {
    if (!dbReady) {
        return reply.status(503).send({ error: "Databasen är inte redo än." });
    }

    const { id } = request.params as { id: string };

    if (!validateUuid(id)) {
        return reply.status(404).send({ error: "Ordern hittades inte." });
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