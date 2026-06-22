export const orderBodySchema = {
    type: 'object',
    required: ['customerId', 'items'],
    additionalProperties: false,
    properties: {
        customerId: { type: 'string', minLength: 1, maxLength: 100 },
        items: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['id', 'name', 'quantity'],
                additionalProperties: false,
                properties: {
                    id: { type: 'integer' },
                    name: { type: 'string', minLength: 1 },
                    quantity: { type: 'integer', minimum: 1 }
                }
            }
        }
    }
};
