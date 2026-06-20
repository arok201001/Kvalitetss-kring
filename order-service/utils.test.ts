import test from 'node:test';
import assert from 'node:assert';
import { validateUuid, validateOrderItems } from './utils';

test('validateUuid - success cases', () => {
    assert.strictEqual(validateUuid('f7b0f69a-2415-4ba3-8b77-8d0718d0521e'), true);
    assert.strictEqual(validateUuid('00000000-0000-0000-0000-000000000000'), true);
});

test('validateUuid - failure cases', () => {
    assert.strictEqual(validateUuid('invalid-uuid'), false);
    assert.strictEqual(validateUuid(''), false);
    assert.strictEqual(validateUuid('f7b0f69a-2415-4ba3-8b77-8d0718d0521g'), false);
});

test('validateOrderItems - success case', () => {
    const validItems = [
        { id: 1, name: 'Falafelburgare', quantity: 2 },
        { id: 2, name: 'Pommes', quantity: 1 }
    ];
    assert.strictEqual(validateOrderItems(validItems), true);
});

test('validateOrderItems - failure cases', () => {
    assert.strictEqual(validateOrderItems([]), false);
    assert.strictEqual(validateOrderItems([{ id: '1', name: 'Falafelburgare', quantity: 2 }] as any), false);
    assert.strictEqual(validateOrderItems([{ id: 1, name: '', quantity: 2 }]), false);
    assert.strictEqual(validateOrderItems([{ id: 1, name: 'Falafelburgare', quantity: -1 }]), false);
});
