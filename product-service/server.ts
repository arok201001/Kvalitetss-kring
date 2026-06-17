import fastify from "fastify";

const server = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

interface Product {
    id: number;
    name: string;
    price: number;
}

const menu: Product[] = [
    { id: 1, name: "Falafelburgare", price: 89 },
    { id: 2, name: "Pommes", price: 35 },
    { id: 3, name: "Islatte", price: 29 },
    { id: 4, name: "Läsk", price: 25 }
];

server.get("/api/products", async (request, reply) => {
    return menu;
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