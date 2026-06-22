import fastify from 'fastify';
import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import {
    connectDb,
    dbReady,
    saveKitchenOrder,
    getKitchenOrders,
    getKitchenOrderById,
    updateKitchenOrderStatus
} from './db';
import { completeOrderParamsSchema } from './schemas';

const server = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3003;
const RABBITMQ_URL: string = process.env.RABBITMQ_URL || (() => { throw new Error("RABBITMQ_URL is required") })();

let channel: Channel;

connectDb();

async function connectRabbit(): Promise<void> {
    try {
        const connection: Connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertQueue("order_queue", { durable: true });
        await channel.assertQueue("notification_queue", { durable: true });
        await channel.assertQueue("kitchen_updates_queue", { durable: true });

        server.log.info("[Kitchen Service] Ansluten till RabbitMQ!");

        channel.consume("order_queue", async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
                const order = JSON.parse(msg.content.toString());
                server.log.info(`[KÖK KÖ] Mottog order #${order.id} för kund ${order.customerId}. Spara i DB.`);

                order.status = "PREPARING";
                await saveKitchenOrder(order);

                channel.sendToQueue(
                    "kitchen_updates_queue",
                    Buffer.from(JSON.stringify({ id: order.id, status: "PREPARING" })),
                    { persistent: true }
                );

                channel.ack(msg);
            } catch (err) {
                server.log.error("Fel vid hantering av inkommande order i kön:", err);
                channel.nack(msg, false, true);
            }
        });

    } catch (error) {
        server.log.error("Kunde inte ansluta till RabbitMQ, försöker igen om 5 sekunder...", error);
        setTimeout(connectRabbit, 5000);
    }
}

connectRabbit();

server.get("/api/kitchen/orders", async (request, reply) => {
    if (!dbReady) {
        return reply.status(503).send({ error: "Databasen är inte redo än." });
    }
    try {
        const orders = await getKitchenOrders();
        return orders;
    } catch (err) {
        server.log.error("Fel vid hämtning av köksordrar:", err);
        return reply.status(500).send({ error: "Internt fel vid hämtning av köksordrar." });
    }
});

server.post("/api/kitchen/orders/:id/complete", {
    schema: {
        params: completeOrderParamsSchema
    }
}, async (request, reply) => {
    if (!dbReady || !channel) {
        return reply.status(503).send({ error: "Kötjänsten eller databasen är inte redo än." });
    }

    const { id } = request.params as { id: string };

    try {
        const order = await getKitchenOrderById(id);
        if (!order) {
            return reply.status(404).send({ error: "Hittade inte ordern i köket." });
        }

        if (order.status === "READY") {
            return reply.status(400).send({ error: "Ordern är redan klar." });
        }

        await updateKitchenOrderStatus(id, "READY");
        order.status = "READY";

        channel.sendToQueue(
            "kitchen_updates_queue",
            Buffer.from(JSON.stringify({ id: order.id, status: "READY" })),
            { persistent: true }
        );

        channel.sendToQueue(
            "notification_queue",
            Buffer.from(JSON.stringify(order)),
            { persistent: true }
        );

        server.log.info(`[KÖK API] Order #${order.id} markerad som klar!`);
        return { success: true, message: "Ordern är nu klar i köket." };

    } catch (err) {
        server.log.error("Fel vid uppdatering av köksorder:", err);
        return reply.status(500).send({ error: "Internt fel vid uppdatering av order." });
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