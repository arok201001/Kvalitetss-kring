export const productBodySchema = {
    type: 'object',
    required: ['name', 'price'],
    properties: {
        name: { type: 'string', minLength: 1 },
        price: { type: 'integer', minimum: 1 }
    }
};
