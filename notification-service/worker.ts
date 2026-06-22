import fastify from 'fastify';
import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { connectDb, dbReady, saveNotification, getNotifications, getNotificationsByCustomerId } from './db';

const server = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3004;
const RABBITMQ_URL: string = process.env.RABBITMQ_URL || (() => { throw new Error("RABBITMQ_URL is required") })();

interface Order {
    id: string;
    customerId: string;
    status: string;
}

connectDb();

async function startNotificationWorker(): Promise<void> {
    try {
        const connection: Connection = await amqp.connect(RABBITMQ_URL);
        const channel: Channel = await connection.createChannel();
        
        await channel.assertQueue('notification_queue', { durable: true });

        server.log.info("Notification Service ansluten till RabbitMQ!");

        channel.consume('notification_queue', async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
                const order: Order = JSON.parse(msg.content.toString());
                const message = `Kund ${order.customerId}: Din order #${order.id} är redo för upphämtning!`;
                
                await saveNotification(order.id, order.customerId, message);
                server.log.info(`Notifikation sparad: ${message}`);
                
                channel.ack(msg);
            } catch (err) {
                server.log.error("Fel vid hantering av notifikation:", err);
                channel.nack(msg, false, true);
            }
        });

    } catch (error) {
        server.log.error("Fel i Notification Service RabbitMQ, startar om om 5 sekunder...", error);
        setTimeout(startNotificationWorker, 5000);
    }
}

server.get('/api/notifications', async (request, reply) => {
    if (!dbReady) {
        return reply.status(503).send({ error: "Databasen är inte redo än." });
    }
    
    const { customerId } = request.query as { customerId?: string };
    
    try {
        if (customerId) {
            const notifications = await getNotificationsByCustomerId(customerId);
            return notifications;
        } else {
            const notifications = await getNotifications();
            return notifications;
        }
    } catch (err) {
        server.log.error("Kunde inte hämta notifikationer", err);
        return reply.status(500).send({ error: "Internt fel vid hämtning av notifikationer" });
    }
});

const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' });
        startNotificationWorker();
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();