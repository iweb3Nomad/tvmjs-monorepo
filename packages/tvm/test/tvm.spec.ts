import { assert, describe, expect, it } from 'vitest'

import {
  Address,
  bytesToBigInt,
  bytesToHex,
  generateTronCreateAddress,
  hexToBytes,
} from '@tvmjs/util'

import { Message, TVMError, createTVM, paramsTVM } from '../src/index.ts'

// TODO: This whole file was missing for quite some time and now (July 2024)
// has been side introduced along another PR. We should add basic initialization
// tests for options and the like.
describe('initialization', () => {
  it('basic initialization', async () => {
    const tvm = await createTVM()
    const msg = 'should use the correct parameter defaults'
    assert.isFalse(tvm.allowUnlimitedContractSize, msg)
  })

  it('TVM parameter customization', async () => {
    let tvm = await createTVM()
    assert.strictEqual(
      tvm.common.param('bn254AddGas'),
      BigInt(150),
      'should use default TVM parameters',
    )

    const params = JSON.parse(JSON.stringify(paramsTVM))
    params['1679']['bn254AddGas'] = 100 // 150
    tvm = await createTVM({ params })
    assert.strictEqual(
      tvm.common.param('bn254AddGas'),
      BigInt(100),
      'should use custom parameters provided',
    )
  })

  it('initializes transaction context for a top-level prebuilt Message', async () => {
    const tvm = await createTVM()
    const contract = new Address(hexToBytes('0x0000000000000000000000000000000000000100'))
    const message = new Message({
      to: contract,
      gasLimit: 100000n,
      // GASPRICE; MSTORE(0); RETURN(0, 32)
      code: hexToBytes('0x3a60005260206000f3'),
    })

    const result = await tvm.runCall({ message, gasPrice: 42n })

    assert.isUndefined(result.execResult.exceptionError)
    assert.strictEqual(bytesToBigInt(result.execResult.returnValue), 42n)
  })

  it('honors skipBalance for a top-level prebuilt Message', async () => {
    const tvm = await createTVM()
    const caller = new Address(hexToBytes('0x0000000000000000000000000000000000000100'))
    const recipient = new Address(hexToBytes('0x0000000000000000000000000000000000000101'))
    const message = new Message({
      caller,
      to: recipient,
      value: 1n,
      gasLimit: 100000n,
      code: hexToBytes('0x00'),
    })

    const result = await tvm.runCall({ message, skipBalance: true })

    assert.isUndefined(result.execResult.exceptionError)
    assert.strictEqual((await tvm.stateManager.getAccount(caller))?.balance, 0n)
    assert.strictEqual((await tvm.stateManager.getAccount(recipient))?.balance, 1n)
  })

  it('still honors skipBalance for a self-built nested call', async () => {
    const tvm = await createTVM()
    const caller = new Address(hexToBytes('0x0000000000000000000000000000000000000104'))
    const recipient = new Address(hexToBytes('0x0000000000000000000000000000000000000105'))

    const result = await tvm.runCall({
      caller,
      to: recipient,
      value: 1n,
      gasLimit: 100000n,
      depth: 1,
      skipBalance: true,
    })

    assert.isUndefined(result.execResult.exceptionError)
    assert.strictEqual((await tvm.stateManager.getAccount(recipient))?.balance, 1n)
  })

  it('does not honor skipBalance for a caller-supplied nested Message', async () => {
    const tvm = await createTVM()
    const caller = new Address(hexToBytes('0x0000000000000000000000000000000000000102'))
    const recipient = new Address(hexToBytes('0x0000000000000000000000000000000000000103'))
    const message = new Message({
      caller,
      to: recipient,
      value: 1n,
      gasLimit: 100000n,
      depth: 1,
      code: hexToBytes('0x00'),
    })

    const result = await tvm.runCall({ message, skipBalance: true })

    assert.strictEqual(
      result.execResult.exceptionError?.error,
      TVMError.errorMessages.INSUFFICIENT_BALANCE,
    )
  })

  it('resets TRON transaction context when a top-level Message is reused', async () => {
    const tvm = await createTVM()
    const contract = new Address(hexToBytes('0x0000000000000000000000000000000000000200'))
    const message = new Message({
      to: contract,
      gasLimit: 100000n,
      // CREATE with empty initcode; MSTORE(0); RETURN(0, 32)
      code: hexToBytes('0x600060006000f060005260206000f3'),
    })
    const firstRootTransactionId = new Uint8Array(32)
    const secondRootTransactionId = new Uint8Array(32)
    secondRootTransactionId[31] = 1

    const firstResult = await tvm.runCall({
      message,
      rootTransactionId: firstRootTransactionId,
    })
    const result = await tvm.runCall({ message, rootTransactionId: secondRootTransactionId })

    const firstAddress = bytesToHex(firstResult.execResult.returnValue.subarray(-20))
    const secondAddress = bytesToHex(result.execResult.returnValue.subarray(-20))

    assert.strictEqual(
      secondAddress,
      bytesToHex(generateTronCreateAddress(secondRootTransactionId, 0n)),
    )
    assert.strictEqual(message.createdAddresses?.size, 1)
    assert.isFalse(message.createdAddresses?.has(firstAddress))
    assert.isTrue(message.createdAddresses?.has(secondAddress))

    await expect(tvm.runCall({ message })).rejects.toThrow(
      /rootTransactionId is required for TRON internal CREATE/,
    )
  })

  it('does not leak selfdestruct entries when a top-level Message is reused', async () => {
    const tvm = await createTVM()
    const firstContract = new Address(hexToBytes('0x0000000000000000000000000000000000000200'))
    const secondContract = new Address(hexToBytes('0x0000000000000000000000000000000000000201'))
    const beneficiary = '00000000000000000000000000000000000000ff'
    const message = new Message({
      to: firstContract,
      gasLimit: 100000n,
      code: hexToBytes(`0x73${beneficiary}ff`),
    })

    const firstResult = await tvm.runCall({ message })
    assert.strictEqual(firstResult.execResult.selfdestruct?.size, 1)

    message.to = secondContract
    message.code = hexToBytes('0x00')
    const secondResult = await tvm.runCall({ message })

    assert.strictEqual(secondResult.execResult.selfdestruct?.size, 0)
    assert.strictEqual(message.selfdestruct?.size, 0)
  })
})
