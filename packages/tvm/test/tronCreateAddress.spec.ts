import { Common, Hardfork, Mainnet } from '@tvmjs/common'
import {
  Address,
  bigIntToBytes,
  bytesToHex,
  generateAddress,
  generateTronCreateAddress,
  hexToBytes,
} from '@tvmjs/util'
import { assert, describe, expect, it } from 'vitest'

import { createTVM } from '../src/index.ts'

const ROOT_TRANSACTION_ID = hexToBytes(
  '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
)
const CREATOR = new Address(hexToBytes('0x0000000000000000000000000000000000000100'))

function returnedAddress(returnValue: Uint8Array): string {
  return bytesToHex(returnValue.subarray(-20))
}

describe('TRON CREATE address derivation', () => {
  it('uses rootTransactionId and the transaction-wide internal nonce', async () => {
    const tvm = await createTVM()
    // CREATE with empty initcode, then return the created address.
    await tvm.stateManager.putCode(CREATOR, hexToBytes('0x600060006000f060005260206000f3'))

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 0n)),
    )
  })

  it('increments the shared internal nonce for consecutive CREATE operations', async () => {
    const tvm = await createTVM()
    // CREATE once and discard the result, then CREATE again and return its address.
    await tvm.stateManager.putCode(
      CREATOR,
      hexToBytes('0x600060006000f050600060006000f060005260206000f3'),
    )

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 1n)),
    )
  })

  it('increments the shared internal nonce for a CALL before CREATE', async () => {
    const tvm = await createTVM()
    const callee = new Address(hexToBytes('0x0000000000000000000000000000000000000200'))
    await tvm.stateManager.putCode(callee, hexToBytes('0x00'))

    const callThenCreate =
      `0x6000600060006000600073${bytesToHex(callee.bytes).slice(2)}61fffff150` +
      '600060006000f060005260206000f3'
    await tvm.stateManager.putCode(CREATOR, hexToBytes(callThenCreate))

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 1n)),
    )
  })

  it('increments the shared internal nonce for CREATE2 before CREATE', async () => {
    const tvm = await createTVM()
    // CREATE2 with salt 1 and empty initcode, discard it, then CREATE and return its address.
    await tvm.stateManager.putCode(
      CREATOR,
      hexToBytes('0x6001600060006000f550600060006000f060005260206000f3'),
    )

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 1n)),
    )
  })

  it('requires rootTransactionId when TRON execution reaches internal CREATE', async () => {
    const tvm = await createTVM()
    await tvm.stateManager.putCode(CREATOR, hexToBytes('0x600060006000f000'))

    await expect(tvm.runCall({ to: CREATOR })).rejects.toThrow(
      /rootTransactionId is required for TRON internal CREATE/,
    )
  })

  it('rejects a rootTransactionId that is not 32 bytes', async () => {
    const tvm = await createTVM()

    await expect(
      tvm.runCall({ to: CREATOR, rootTransactionId: new Uint8Array(31) }),
    ).rejects.toThrow(/rootTransactionId to be of length 32/)
  })

  it('keeps Ethereum CREATE derivation unchanged', async () => {
    const common = new Common({ chain: Mainnet, hardfork: Hardfork.Constantinople })
    const tvm = await createTVM({ common })
    await tvm.stateManager.putCode(CREATOR, hexToBytes('0x600060006000f060005260206000f3'))

    const result = await tvm.runCall({ to: CREATOR })

    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateAddress(CREATOR.bytes, bigIntToBytes(0n))),
    )
  })
})
