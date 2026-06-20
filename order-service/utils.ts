export function validateUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

export interface ItemInput {
    id: number;
    name: string;
    quantity: number;
}

export function validateOrderItems(items: ItemInput[]): boolean {
    if (!Array.isArray(items) || items.length === 0) return false;
    for (const item of items) {
        if (
            typeof item.id !== 'number' ||
            typeof item.name !== 'string' ||
            item.name.trim().length === 0 ||
            typeof item.quantity !== 'number' ||
            item.quantity <= 0
        ) {
            return false;
        }
    }
    return true;
}
