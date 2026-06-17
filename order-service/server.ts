import fastify from 'fastify';
import { Pool } from 'pg';
import amqp, { Channel } from 'amqplib';

const server = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const DATABASE_URL = process.env.DATABASE_URL;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

const pool = new Pool({
    connectionString: DATABASE_URL,
});

let channel: Channel;

async function connectRabbit() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue("order_queue", { durable: true });
        server.log.info("Order Service ansluten till RabbitMQ!");
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

server.post("/api/orders", async (request, reply) => {
    const { customerId, items } = request.body as OrderRequest;

    if (!customerId || !items) {
        return reply.status(400).send({ error: "customerId och items krävs." });
    }

    const order = {
        id: crypto.randomUUID(),
        customerId,
        items,
        status: "PENDING",
        createdAt: new Date()
    };

    try {
        if (channel) {
            channel.sendToQueue("order_queue", Buffer.from(JSON.stringify(order)), { persistent: true });
            return reply.status(202).send({
                message: "Order mottagen!",
                orderId: order.id
            });
        } else {
            return reply.status(503).send({ error: "Kötjänsten är inte redo än." });
        }
    } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ error: "Internt systemfel." });
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