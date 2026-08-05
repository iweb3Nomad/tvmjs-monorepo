// cspell:ignore selfdestructor
import { Common, Hardfork, Mainnet } from '@tvmjs/common'
import {
  Address,
  bigIntToBytes,
  bytesToHex,
  generateAddress,
  generateAddress2,
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
      (`0x6000600060006000600073${bytesToHex(callee.bytes).slice(2)}61fffff150` +
        '600060006000f060005260206000f3') as `0x${string}`
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

  it('advances nonce even when CREATE collides, so the next CREATE uses nonce+1', async () => {
    const tvm = await createTVM()
    const firstAddr = generateTronCreateAddress(ROOT_TRANSACTION_ID, 0n)
    // Pre-occupy the first address
    await tvm.stateManager.putCode(new Address(firstAddr), hexToBytes('0x00'))

    // CREATE twice: first collides, second should use nonce=1
    await tvm.stateManager.putCode(
      CREATOR,
      hexToBytes('0x600060006000f050600060006000f060005260206000f3'),
    )

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    // The second CREATE should use nonce=1
    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 1n)),
    )
  })

  it('advances nonce even when CREATE2 collides, so the next CREATE uses nonce+1', async () => {
    const tvm = await createTVM()

    // Calculate the actual CREATE2 target address
    const salt = new Uint8Array(32)
    salt[31] = 1
    const emptyCode = new Uint8Array(0)
    const create2Addr = generateAddress2(CREATOR.bytes, salt, emptyCode)

    // Pre-occupy the address CREATE2 will attempt to use
    await tvm.stateManager.putCode(new Address(create2Addr), hexToBytes('0x00'))

    // CREATE2 (collides) then CREATE
    // Bytecode: CREATE2 with value=0, offset=0, size=0, salt=1, POP, then CREATE and return address
    await tvm.stateManager.putCode(
      CREATOR,
      hexToBytes('0x6001600060006000f550600060006000f060005260206000f3'),
    )

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    // The CREATE should use nonce=1 (CREATE2 collision advanced nonce to 1)
    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 1n)),
    )
  })

  it('advances nonce when SELFDESTRUCT executes in a nested call before CREATE', async () => {
    const tvm = await createTVM()
    const selfdestructor = new Address(hexToBytes('0x0000000000000000000000000000000000000200'))
    // SELFDESTRUCT to caller
    await tvm.stateManager.putCode(selfdestructor, hexToBytes('0x33ff'))

    // CALL selfdestructor, then CREATE
    const callThenCreate =
      (`0x6000600060006000600073${bytesToHex(selfdestructor.bytes).slice(2)}61fffff150` +
        '600060006000f060005260206000f3') as `0x${string}`
    await tvm.stateManager.putCode(CREATOR, hexToBytes(callThenCreate))

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    // CALL advances nonce to 1, SELFDESTRUCT advances to 2, so CREATE uses nonce=2
    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 2n)),
    )
  })

  it('advances nonce for every repeated SELFDESTRUCT invocation', async () => {
    const tvm = await createTVM()
    const selfdestructor = new Address(hexToBytes('0x0000000000000000000000000000000000000200'))
    await tvm.stateManager.putCode(selfdestructor, hexToBytes('0x33ff'))

    // A pre-existing contract remains callable until transaction finalization.
    // Invoke it twice from the outer frame, then CREATE and return the address.
    const callSelfdestructor = `6000600060006000600073${bytesToHex(selfdestructor.bytes).slice(2)}61fffff150`
    const callTwiceThenCreate = (`0x${callSelfdestructor}${callSelfdestructor}` +
      '600060006000f060005260206000f3') as `0x${string}`
    await tvm.stateManager.putCode(CREATOR, hexToBytes(callTwiceThenCreate))

    const result = await tvm.runCall({
      to: CREATOR,
      rootTransactionId: ROOT_TRANSACTION_ID,
    })

    // CALL1 -> 1, SELFDESTRUCT1 -> 2, CALL2 -> 3, SELFDESTRUCT2 -> 4.
    assert.strictEqual(
      returnedAddress(result.execResult.returnValue),
      bytesToHex(generateTronCreateAddress(ROOT_TRANSACTION_ID, 4n)),
    )
  })
})
