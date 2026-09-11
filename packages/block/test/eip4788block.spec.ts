import { Common, Hardfork, Mainnet } from '@tvmjs/common'
import { bytesToHex } from '@tvmjs/util'
import { assert, describe, it } from 'vitest'

import { createBlock, createBlockHeader } from '../src/index.ts'

describe('EIP4788 header tests', () => {
  it('should work', () => {
    const earlyCommon = new Common({ chain: Mainnet, hardfork: Hardfork.Istanbul })
    const common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun, eips: [4788] })

    assert.throws(
      () => {
        createBlockHeader(
          {
            parentBeaconBlockRoot: new Uint8Array(32),
          },
          {
            common: earlyCommon,
          },
        )
      },
      'A parentBeaconBlockRoot for a header can only be provided with EIP4788 being activated',
      undefined,
      'should throw when setting parentBeaconBlockRoot with EIP4788 not being activated',
    )

    assert.doesNotThrow(() => {
      createBlockHeader(
        {
          parentBeaconBlockRoot: new Uint8Array(32),
        },
        {
          common,
          skipConsensusFormatValidation: true,
        },
      )
    }, 'correctly instantiates an EIP4788 block header')

    const block = createBlock(
      {
        header: createBlockHeader({}, { common }),
      },
      { common, skipConsensusFormatValidation: true },
    )
    assert.strictEqual(
      block.toJSON().header?.parentBeaconBlockRoot,
      bytesToHex(new Uint8Array(32)),
      'JSON output includes parentBeaconBlockRoot',
    )
  })
})
