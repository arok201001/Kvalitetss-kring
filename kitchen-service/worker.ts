import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';

const RABBITMQ_URL: string = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

interface Order {
    id: number;
    customerId: string;
    items: Array<{ id: number; name: string; quantity: number }>;
    status: string;
    createdAt: string;
}

async function startKitchenWorker(): Promise<void> {
    try {
        const connection: Connection = await amqp.connect(RABBITMQ_URL);
        const channel: Channel = await connection.createChannel();

        await channel.assertQueue("order_queue", { durable: true });
        await channel.assertQueue("notification_queue", { durable: true });

        console.log("[Kitchen Service] Väntar på ordrar från kön...");

        channel.consume("order_queue", (msg: ConsumeMessage | null) => {
            if (!msg) return;

            const order: Order = JSON.parse(msg.content.toString());
            console.log(`[KÖK] Order #${order.id} för kund ${order.customerId}. Tillagas...`);

            setTimeout(async () => {
                console.log(`[KÖK] Order #${order.id} är klar!`);
                order.status = "READY";

                channel.sendToQueue(
                    "notification_queue",
                    ArrayBuffer.from(JSON.stringify(order)),
                    { persistent: true }
                );

                channel.ack(msg);
            }, 3000);
        });

    } catch (error) {
        console.error("Fel i Kitchen Service, start om om 5 sekunder...", error);
        setTimeout(startKitchenWorker, 5000);
    }
}

startKitchenWorker();