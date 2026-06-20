import fastify from "fastify";
import { connectDb, dbReady, getProducts, createProduct } from "./db";
import { productBodySchema } from "./schemas";

const server = fastify({ logger: true });
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

connectDb(server.log);

server.get("/api/products", async (request, reply) => {
    if (!dbReady) {
        return reply.status(503).send({ error: "Databasen är inte redo än." });
    }
    try {
        const products = await getProducts();
        return products;
    } catch (err) {
        server.log.error("Fel vid hämtning av produkter:", err);
        return reply.status(500).send({ error: "Internt fel vid hämtning av produkter." });
    }
});

server.post("/api/products", {
    schema: {
        body: productBodySchema
    }
}, async (request, reply) => {
    if (!dbReady) {
        return reply.status(503).send({ error: "Databasen är inte redo än." });
    }
    const { name, price } = request.body as { name: string; price: number };
    try {
        const product = await createProduct(name, price);
        return reply.status(201).send(product);
    } catch (err) {
        server.log.error("Fel vid skapande av produkt:", err);
        return reply.status(500).send({ error: "Internt fel vid skapande av produkt." });
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