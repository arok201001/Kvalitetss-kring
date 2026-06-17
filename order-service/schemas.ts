export const orderBodySchema = {
    type: 'object',
    required: ['customerId', 'items'],
    properties: {
        customerId: { type: 'string', minLength: 1 },
        items: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['id', 'name', 'quantity'],
                properties: {
                    id: { type: 'integer' },
                    name: { type: 'string', minLength: 1 },
                    quantity: { type: 'integer', minimum: 1 }
                }
            }
        }
    }
};
