import { createBlock } from '@tvmjs/block'
import { Common, TronMainnet, TronNile, TronShasta } from '@tvmjs/common'
import { createTVM } from '@tvmjs/tvm'
import { createFeeMarket1559Tx, createTxFromJSONRPCProvider, createTxFromRPC } from '@tvmjs/tx'
import {
  Account,
  bigIntToBytes,
  bytesToBigInt,
  bytesToHex,
  createAddressFromPrivateKey,
  createAddressFromString,
  hexToBytes,
  setLengthLeft,
} from '@tvmjs/util'
import { createVM, runBlock, runTx } from '@tvmjs/vm'
import { assert, afterEach, describe, expect, it, vi } from 'vitest'

import { MerkleStateManager, RPCStateManager, getMerkleStateProof } from '../src/index.ts'

import { mockRPC, provider } from './rpcHelpers.ts'
import { tx as ethereumTransaction } from './testdata/providerData/transactions/0xed1960aa7d0d7b567c946d94331dddb37a1c67f51f30bf51f256ea40db88cfb0.ts'

const privateKey = hexToBytes('0xe331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd109')
const sender = createAddressFromPrivateKey(privateKey)
const recipient = createAddressFromString('0x0000000000000000000000000000000000000101')
const contract = createAddressFromString('0x0000000000000000000000000000000000000102')
const slot = setLengthLeft(bigIntToBytes(1n), 32)
const blockTag = 499999n

// This is an independent local pre-state, not a java-tron RPC response or chain snapshot.
async function fixture(common: Common) {
  const source = new MerkleStateManager({ common })
  await source.putAccount(sender, new Account(0n, 1000000n))
  await source.putAccount(recipient, new Account(0n, 10n))
  await source.putCode(contract, hexToBytes('0x4660005260206000f3'))
  await source.putStorage(contract, slot, hexToBytes('0x01'))
  const transport = mockRPC(async ({ method, params }) => {
    assert.strictEqual(params.at(-1), '0x7a11f', 'every state read uses the chosen snapshot')
    const address = createAddressFromString(params[0] as string)
    switch (method) {
      case 'eth_getProof':
        return getMerkleStateProof(
          source,
          address,
          (params[1] as string[]).map((key) => hexToBytes(key as `0x${string}`)),
        )
      case 'eth_getCode':
        return bytesToHex(await source.getCode(address))
      case 'eth_getStorageAt':
        return bytesToHex(await source.getStorage(address, hexToBytes(params[1] as `0x${string}`)))
      default:
        throw new Error(`Unexpected RPC method: ${method}`)
    }
  })
  const state = new RPCStateManager({ common, provider, blockTag })
  const block = createBlock(
    { header: { number: blockTag + 1n, gasLimit: 1000000n, baseFeePerGas: 0n } },
    { common },
  )
  return { source, state, block, ...transport }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('RPCStateManager defaults', () => {
  it('uses TronMainnet when Common is omitted', () => {
    const state = new RPCStateManager({ provider, blockTag: 0n })
    assert.strictEqual(state.common.chainId(), BigInt(TronMainnet.chainId))
    assert.isFalse(state.common.hasGenesis())
    assert.isFalse(state.common.hasConsensus())
  })
})

describe.each([TronMainnet, TronNile, TronShasta])('RPC state on $name', (chain) => {
  it('executes a signed transfer using provider accounts', async () => {
    const common = new Common({ chain })
    const { state, block, requests } = await fixture(common)
    const vm = await createVM({ common, stateManager: state })
    const tx = createFeeMarket1559Tx(
      { to: recipient, value: 100n, gasLimit: 50000n, maxFeePerGas: 0n },
      { common },
    ).sign(privateKey)
    const result = await runTx(vm, { tx, block })
    assert.isUndefined(result.execResult.exceptionError)
    // VM keeps the transaction envelope's intrinsic gas separate from opcode Energy.
    assert.strictEqual(result.totalGasSpent, 21000n)
    assert.strictEqual((await state.getAccount(sender))!.balance, 999900n)
    assert.strictEqual((await state.getAccount(sender))!.nonce, 1n)
    assert.strictEqual((await state.getAccount(recipient))!.balance, 110n)
    assert.isTrue(requests.some(({ method }) => method === 'eth_getProof'))
  })

  it('reconstructs and executes a TRON chainId RPC transaction without changing its signature', async () => {
    const common = new Common({ chain })
    const { state, block } = await fixture(common)
    const signed = createFeeMarket1559Tx(
      { to: recipient, value: 25n, gasLimit: 50000n, maxFeePerGas: 0n },
      { common },
    ).sign(privateKey)
    const tx = await createTxFromRPC(signed.toJSON(), { common })
    assert.deepEqual(tx.hash(), signed.hash())
    assert.strictEqual(tx.getSenderAddress().toString(), sender.toString())
    assert.strictEqual(tx.common.chainId(), common.chainId())
    const result = await runTx(await createVM({ common, stateManager: state }), { tx, block })
    assert.isUndefined(result.execResult.exceptionError)
    assert.strictEqual(result.totalGasSpent, 21000n)
    assert.strictEqual((await state.getAccount(recipient))!.balance, 35n)
  })

  it('rejects the original Ethereum chainId transaction fixture', async () => {
    const common = new Common({ chain })
    mockRPC(({ method, params }) => {
      assert.strictEqual(method, 'eth_getTransactionByHash')
      assert.deepEqual(params, [ethereumTransaction.hash])
      return ethereumTransaction
    })
    await expect(
      createTxFromJSONRPCProvider(provider, ethereumTransaction.hash, { common }),
    ).rejects.toThrow(/chain ID/i)
  })

  it('executes a local block with the same receipts and accounts as MerkleStateManager', async () => {
    const common = new Common({ chain })
    const { state, source, block: context } = await fixture(common)
    const transactions = [0n, 1n].map((nonce) =>
      createFeeMarket1559Tx(
        { nonce, to: recipient, value: 25n, gasLimit: 50000n, maxFeePerGas: 0n },
        { common },
      ).sign(privateKey),
    )
    const block = createBlock({ header: context.header.toJSON(), transactions }, { common })
    const rpcResult = await runBlock(await createVM({ common, stateManager: state }), {
      block,
      generate: true,
      skipBlockValidation: true,
    })
    const localResult = await runBlock(await createVM({ common, stateManager: source }), {
      block,
      generate: true,
      skipBlockValidation: true,
    })
    assert.strictEqual(rpcResult.gasUsed, 42000n)
    assert.lengthOf(rpcResult.receipts, 2)
    assert.deepEqual(rpcResult.receipts, localResult.receipts)
    for (const result of rpcResult.results) assert.isUndefined(result.execResult.exceptionError)
    for (const address of [sender, recipient]) {
      assert.deepEqual(
        (await state.getAccount(address))!.serialize(),
        (await source.getAccount(address))!.serialize(),
      )
    }
    assert.strictEqual((await state.getAccount(sender))!.nonce, 2n)
    assert.strictEqual((await state.getAccount(recipient))!.balance, 60n)
    // RPCStateManager has no complete trie and must not be treated as a root verifier.
    assert.deepEqual(rpcResult.stateRoot, new Uint8Array(32))
  })

  it('executes CHAINID using code fetched from the provider', async () => {
    const common = new Common({ chain })
    const { state, block, requests } = await fixture(common)
    const tvm = await createTVM({ common, stateManager: state })
    const result = await tvm.runCall({ caller: sender, to: contract, block, gasLimit: 100000n })
    assert.isUndefined(result.execResult.exceptionError)
    assert.strictEqual(bytesToBigInt(result.execResult.returnValue), common.chainId())
    assert.isTrue(requests.some(({ method }) => method === 'eth_getCode'))
  })

  it.each([1n, 'earliest'] as const)(
    'copies network, optional EIPs, crypto and block tag %s',
    (tag) => {
      const keccak256 = (_input: Uint8Array) => new Uint8Array(32).fill(0x5a)
      const common = new Common({ chain, eips: [7939], customCrypto: { keccak256 } })
      const state = new RPCStateManager({ common, provider, blockTag: tag })
      const copy = state.shallowCopy()
      assert.notStrictEqual(copy.common, common)
      assert.isTrue(copy.common.isCompatibleWith(common))
      assert.strictEqual(copy['_blockTag'], tag === 'earliest' ? tag : '0x1')
      assert.deepEqual(copy.getAppliedKey(sender.bytes), new Uint8Array(32).fill(0x5a))
      assert.deepEqual(copy['_caches'].settings, state['_caches'].settings)
      copy.common.setEIPs([])
      assert.isTrue(common.isActivatedEIP(7939))
      assert.isFalse(copy.common.isActivatedEIP(7939))
    },
  )

  it('starts a shallow copy with independent empty caches at the same provider snapshot', async () => {
    const common = new Common({ chain })
    const { state } = await fixture(common)
    await state.putAccount(recipient, new Account(0n, 99n))
    await state.putCode(contract, hexToBytes('0x6001'))
    await state.putStorage(contract, slot, hexToBytes('0x02'))
    const copy = state.shallowCopy()
    assert.strictEqual((await copy.getAccount(recipient))!.balance, 10n)
    assert.deepEqual(await copy.getCode(contract), hexToBytes('0x4660005260206000f3'))
    assert.deepEqual(await copy.getStorage(contract, slot), hexToBytes('0x01'))
    await copy.putAccount(recipient, new Account(0n, 111n))
    await copy.putCode(contract, hexToBytes('0x6002'))
    await copy.putStorage(contract, slot, hexToBytes('0x03'))
    assert.strictEqual((await state.getAccount(recipient))!.balance, 99n)
    assert.deepEqual(await state.getCode(contract), hexToBytes('0x6001'))
    assert.deepEqual(await state.getStorage(contract, slot), hexToBytes('0x02'))
  })

  it('reverts accounts, code and storage together after an inner commit', async () => {
    const state = new RPCStateManager({ common: new Common({ chain }), provider, blockTag })
    const write = async (value: number) => {
      await state.putAccount(recipient, new Account(0n, BigInt(value)))
      await state.putCode(contract, Uint8Array.of(value))
      await state.putStorage(contract, slot, Uint8Array.of(value))
    }
    await write(1)
    await state.checkpoint()
    await write(2)
    await state.checkpoint()
    await write(3)
    await state.commit()
    await state.revert()
    assert.strictEqual((await state.getAccount(recipient))!.balance, 1n)
    assert.deepEqual(await state.getCode(contract), Uint8Array.of(1))
    assert.deepEqual(await state.getStorage(contract, slot), Uint8Array.of(1))
    // A new transaction must start with all three checkpoint stacks aligned.
    await state.checkpoint()
    await write(4)
    await state.commit()
    await state.checkpoint()
    await write(5)
    await state.revert()
    assert.strictEqual((await state.getAccount(recipient))!.balance, 4n)
    assert.deepEqual(await state.getCode(contract), Uint8Array.of(4))
    assert.deepEqual(await state.getStorage(contract, slot), Uint8Array.of(4))
  })

  it.each(['setBlockTag', 'clearCaches'] as const)(
    'invalidates original storage as well as current storage on %s',
    async (reset) => {
      let value = '0x01'
      const { requests } = mockRPC(({ method }) => {
        assert.strictEqual(method, 'eth_getStorageAt')
        return value
      })
      const state = new RPCStateManager({ common: new Common({ chain }), provider, blockTag: 1n })
      assert.deepEqual(await state.originalStorageCache.get(contract, slot), Uint8Array.of(1))
      value = '0x02'
      if (reset === 'setBlockTag') state.setBlockTag(2n)
      else state.clearCaches()
      assert.deepEqual(await state.originalStorageCache.get(contract, slot), Uint8Array.of(2))
      assert.lengthOf(requests, 2)
      assert.strictEqual(requests[1].params[2], reset === 'setBlockTag' ? '0x2' : '0x1')
    },
  )

  it('keeps unsupported remote Token registry and state-root operations explicit', async () => {
    const state = new RPCStateManager({ common: new Common({ chain }), provider, blockTag })
    await expect(state.tokenIdExists(1000088n)).rejects.toThrow('Method not implemented')
    assert.throws(() => state.hasStateRoot(), 'function not implemented')
  })
})
