import { postMergeGethGenesis } from '@tvmjs/testdata'
import { describe, expect, it } from 'vitest'

import { Common, TronMainnet, TronNile, TronShasta, parseGethGenesis } from '../src/index.ts'

describe.each([TronMainnet, TronNile, TronShasta])(
  'removed Blob configuration on $name',
  (chain) => {
    it('cannot activate Blob execution or expose a Blob gas schedule', () => {
      const common = new Common({ chain })
      for (const eip of [4844, 7516, 7594, 7691, 7892, 7918]) {
        expect(common.isActivatedEIP(eip)).toBe(false)
        expect(() => common.setEIPs([eip])).toThrow(/not supported/)
        expect(() => common.paramByEIP('blobGasPerBlob', eip)).toThrow(/not supported/)
      }
      expect(common).not.toHaveProperty('getBlobGasSchedule')
    })

    it('rejects removed crypto and genesis fields, including null and undefined', () => {
      for (const value of [undefined, null, 0, 0n, '0x0', {}]) {
        expect(() => new Common({ chain, customCrypto: { kzg: value } } as any)).toThrow(
          'customCrypto.kzg is no longer supported',
        )
        for (const field of ['excessBlobGas', 'blobGasUsed']) {
          expect(
            () => new Common({ chain: { ...chain, genesis: { [field]: value } } } as any),
          ).toThrow('Blob gas fields are not supported')
        }
      }
    })
  },
)

it('rejects removed Blob genesis fields before parsing or copying configuration data', () => {
  for (const value of [undefined, null, 0, 0n, '0x0', {}]) {
    for (const field of ['excessBlobGas', 'blobGasUsed']) {
      expect(() => parseGethGenesis({ ...postMergeGethGenesis, [field]: value })).toThrow(
        'Blob gas fields are not supported',
      )
    }
    expect(() =>
      parseGethGenesis({
        ...postMergeGethGenesis,
        config: { ...postMergeGethGenesis.config, blobSchedule: value },
      } as any),
    ).toThrow('blobSchedule is not supported')
  }
})
