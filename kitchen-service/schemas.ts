export const completeOrderParamsSchema = {
    type: 'object',
    required: ['id'],
    properties: {
        id: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' }
    }
};
