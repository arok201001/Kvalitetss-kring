import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';

const RABBITMQ_URL: string = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

interface Order {
    id: number;
    customerId: string;
    status: string;
}

async function startNotificationWorker(): Promise<void> {
    try {
        const connection: Connection = await amqp.connect(RABBITMQ_URL);
        const channel: Channel = await connection.createChannel();
        
        await channel.assertQueue('notification_queue', { durable: true });

        console.log("[Notification Service] Väntar på färdiga ordrar...");

        channel.consume('notification_queue', (msg: ConsumeMessage | null) => {
            if (!msg) return;

            const order: Order = JSON.parse(msg.content.toString());
            console.log(`\[NOTIFIKATION] Kund ${order.customerId}: Din order #${order.id} är redo för upphämtning! 🍔🎉\n`);

            channel.ack(msg);
        });

    } catch (error) {
        console.error("Fel i Notification Service, startar om om 5 sekunder...", error);
        setTimeout(startNotificationWorker, 5000);
    }
}

startNotificationWorker();