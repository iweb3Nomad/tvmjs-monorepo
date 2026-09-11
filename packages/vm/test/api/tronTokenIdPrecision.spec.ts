import { SIGNER_A } from '@tvmjs/testdata'
import { createLegacyTx } from '@tvmjs/tx'
import { createAccount, createAddressFromString, tokenIdToKey } from '@tvmjs/util'
import { assert, describe, it } from 'vitest'

import { createVM, runTx } from '../../src/index.ts'

const LOW = 2n ** 53n
const HIGH = LOW + 1n
const recipient = createAddressFromString('0x2000000000000000000000000000000000000002')

describe('TRC-10 token ID precision in runTx', () => {
  it('transfers the exact high token ID', async () => {
    const vm = await createVM()
    await vm.stateManager.putAccount(
      SIGNER_A.address,
      createAccount({
        balance: 10n ** 18n,
        asset: { [tokenIdToKey(LOW)]: 5n, [tokenIdToKey(HIGH)]: 5n },
      }),
    )
    const tx = createLegacyTx(
      { to: recipient, gasLimit: 100000n, gasPrice: 10n, tokenId: HIGH, tokenValue: 3n },
      { common: vm.common },
    ).sign(SIGNER_A.privateKey)
    assert.strictEqual(tx.tokenId, HIGH)
    const result = await runTx(vm, { tx })
    assert.isUndefined(result.execResult.exceptionError)

    const sender = (await vm.stateManager.getAccount(SIGNER_A.address))!
    const to = (await vm.stateManager.getAccount(recipient))!
    assert.strictEqual(sender.getTokenBalance(HIGH), 2n)
    assert.strictEqual(sender.getTokenBalance(LOW), 5n)
    assert.strictEqual(to.getTokenBalance(HIGH), 3n)
    assert.strictEqual(to.getTokenBalance(LOW), 0n)
  })

  it('checks token existence by exact ID', async () => {
    const vm = await createVM()
    await vm.stateManager.putAccount(
      SIGNER_A.address,
      createAccount({ balance: 10n ** 18n, asset: { [tokenIdToKey(HIGH)]: 5n } }),
    )
    const tx = createLegacyTx(
      { to: recipient, gasLimit: 100000n, gasPrice: 10n, tokenId: LOW, tokenValue: 1n },
      { common: vm.common },
    ).sign(SIGNER_A.privateKey)
    let error: unknown
    try {
      await runTx(vm, { tx })
    } catch (cause) {
      error = cause
    }
    assert.instanceOf(error, Error)
    assert.match((error as Error).message, /No asset/)
    assert.strictEqual(
      (await vm.stateManager.getAccount(SIGNER_A.address))!.getTokenBalance(HIGH),
      5n,
    )
  })
})
