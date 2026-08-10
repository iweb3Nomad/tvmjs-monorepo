import { assert, describe, it } from 'vitest'

import {
  Address,
  bytesToBigInt,
  bytesToHex,
  generateTronCreateAddress,
  hexToBytes,
} from '@tvmjs/util'

import { Message, createTVM, paramsTVM } from '../src/index.ts'

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

    await tvm.runCall({ message, rootTransactionId: firstRootTransactionId })
    const result = await tvm.runCall({ message, rootTransactionId: secondRootTransactionId })

    assert.strictEqual(
      bytesToHex(result.execResult.returnValue.subarray(-20)),
      bytesToHex(generateTronCreateAddress(secondRootTransactionId, 0n)),
    )
  })
})
