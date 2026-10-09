import { assert, describe, it } from 'vitest'

import { createBinaryTree } from '../src/index.ts'

describe('delete', () => {
  it.each([
    { branch: 'right root child', firstByte: 0xff, lastByte: 0xff, siblingByte: 0 },
    { branch: 'left root child', firstByte: 0, lastByte: 0, siblingByte: 0xff },
    { branch: 'nested child', firstByte: 0x40, lastByte: 0, siblingByte: 0 },
    { branch: 'child after a 247-bit prefix', firstByte: 0, lastByte: 1, siblingByte: 0 },
  ])('removes the last value of a stem at the $branch', async (testCase) => {
    const tree = await createBinaryTree({ cacheSize: 0 })
    const siblingStem = new Uint8Array(31).fill(testCase.siblingByte)
    const stem = new Uint8Array(31).fill(testCase.firstByte)
    stem[30] = testCase.lastByte
    const siblingValues = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2)]
    const value = new Uint8Array(32).fill(3)

    await tree.put(siblingStem, [0, 255], siblingValues)
    await tree.put(stem, [1], [value])
    assert.deepEqual(await tree.get(stem, [1]), [value])
    const originalRoot = tree.root().slice()
    const originalTree = tree.shallowCopy()

    await tree.del(stem, [1])

    assert.deepEqual(await tree.get(stem, [1]), [])
    assert.notDeepEqual(tree.root(), originalRoot)
    assert.deepEqual(await tree.get(siblingStem, [0, 255]), siblingValues)
    assert.deepEqual(await originalTree.get(stem, [1]), [value])

    const deletedRoot = tree.root().slice()
    await tree.del(stem, [1])
    assert.deepEqual(tree.root(), deletedRoot)
    await tree.put(stem, [1], [value])
    assert.deepEqual(await tree.get(stem, [1]), [value])
    assert.deepEqual(tree.root(), originalRoot)
  })

  it('preserves other values in the same stem when deleting only one suffix', async () => {
    const tree = await createBinaryTree()
    const siblingStem = new Uint8Array(31)
    const stem = new Uint8Array(31).fill(0xff)
    const value = new Uint8Array(32).fill(1)
    const remainingValue = new Uint8Array(32).fill(2)
    await tree.put(siblingStem, [0], [value])
    await tree.put(stem, [1, 255], [value, remainingValue])
    const originalRoot = tree.root().slice()

    await tree.del(stem, [1])

    assert.deepEqual(await tree.get(stem, [1, 255]), [null, remainingValue])
    assert.deepEqual(await tree.get(siblingStem, [0]), [value])
    assert.notDeepEqual(tree.root(), originalRoot)
  })

  it('removes a branch through put with null values', async () => {
    const tree = await createBinaryTree()
    const siblingStem = new Uint8Array(31)
    const stem = new Uint8Array(31).fill(0xff)
    const value = new Uint8Array(32).fill(3)
    await tree.put(siblingStem, [0], [value])
    await tree.put(stem, [0, 255], [value, value])
    const originalRoot = tree.root().slice()

    await tree.put(stem, [0, 255], [null, null])

    assert.deepEqual(await tree.get(stem, [0, 255]), [])
    assert.deepEqual(await tree.get(siblingStem, [0]), [value])
    assert.notDeepEqual(tree.root(), originalRoot)
  })

  it('removes empty internal branches after deleting their remaining stems', async () => {
    const tree = await createBinaryTree()
    const siblingStem = new Uint8Array(31)
    const stems = [new Uint8Array(31).fill(0x80), new Uint8Array(31).fill(0xc0)]
    const value = new Uint8Array(32).fill(3)
    await tree.put(siblingStem, [0], [value])
    for (const stem of stems) {
      await tree.put(stem, [1], [value])
    }
    const originalRoot = tree.root().slice()

    for (const stem of stems) {
      await tree.del(stem, [1])
      assert.deepEqual(await tree.get(stem, [1]), [])
      assert.deepEqual(await tree.get(siblingStem, [0]), [value])
    }
    for (const stem of stems) {
      assert.deepEqual(await tree.get(stem, [1]), [])
      await tree.put(stem, [1], [value])
    }
    assert.deepEqual(tree.root(), originalRoot)

    await tree.del(siblingStem, [0])
    for (const stem of stems) {
      await tree.del(stem, [1])
    }
    assert.deepEqual(tree.root(), tree.EMPTY_TREE_ROOT)
    assert.deepEqual(await tree.get(siblingStem, [0]), [])
  })

  it.each([0, 32])('can revert and commit stem deletion with cacheSize %i', async (cacheSize) => {
    const tree = await createBinaryTree({ cacheSize })
    const siblingStem = new Uint8Array(31)
    const stem = new Uint8Array(31).fill(0xff)
    const value = new Uint8Array(32).fill(3)
    await tree.put(siblingStem, [0], [value])
    await tree.put(stem, [1], [value])
    const originalRoot = tree.root().slice()

    tree.checkpoint()
    await tree.del(stem, [1])
    const deletedRoot = tree.root().slice()
    assert.deepEqual(await tree.get(stem, [1]), [])
    await tree.revert()
    assert.deepEqual(tree.root(), originalRoot)
    assert.deepEqual(await tree.get(stem, [1]), [value])

    tree.checkpoint()
    await tree.del(stem, [1])
    await tree.commit()
    assert.deepEqual(tree.root(), deletedRoot)
    assert.deepEqual(await tree.get(stem, [1]), [])
    assert.deepEqual(await tree.shallowCopy(false).get(stem, [1]), [])
    assert.deepEqual(await tree.get(siblingStem, [0]), [value])
  })
})
