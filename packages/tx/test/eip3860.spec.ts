import { Common, TronMainnet, TronNile, TronShasta } from '@tvmjs/common'
import { createZeroAddress } from '@tvmjs/util'
import { describe, expect, it } from 'vitest'

import { TransactionType, createTx } from '../src/index.ts'

// The former Ethereum initcode boundary must not restrict TRON deployments.
const ethereumInitCodeLimit = 49152
const txTypes = [
  TransactionType.Legacy,
  TransactionType.AccessListEIP2930,
  TransactionType.FeeMarketEIP1559,
]

describe.each([TronMainnet, TronNile, TronShasta])('TRON initcode on $name', (chain) => {
  it.each([ethereumInitCodeLimit, ethereumInitCodeLimit + 1])(
    'does not limit or charge word gas for %s bytes',
    (size) => {
      const common = new Common({ chain })
      const data = new Uint8Array(size)
      for (const type of txTypes) {
        for (const allowUnlimitedInitCodeSize of [undefined, false, true]) {
          const options = { common, allowUnlimitedInitCodeSize }
          const deployment = createTx({ type, data }, options)
          const call = createTx({ type, data, to: createZeroAddress() }, options)
          expect(deployment.data).toEqual(data)
          expect(deployment.getDataGas()).toBe(call.getDataGas())
          expect(deployment.getDataGas()).toBe(BigInt(size) * 4n)
        }
      }
    },
  )
})
