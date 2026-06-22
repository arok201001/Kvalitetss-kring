export const productBodySchema = {
    type: 'object',
    required: ['name', 'price'],
    additionalProperties: false,
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        price: { type: 'integer', minimum: 1 }
    }
};
