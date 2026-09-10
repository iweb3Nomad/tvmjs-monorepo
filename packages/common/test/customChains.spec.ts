// cspell:ignore dpos
import { assert, describe, it } from 'vitest'

import { Common, Hardfork, Mainnet, TronMainnet, createCustomCommon } from '../src/index.ts'

import type { ChainConfig } from '../src/index.ts'

describe('[Common]: custom TRON configuration', () => {
  it('preserves custom identity, parameters and governance state', () => {
    const common = createCustomCommon({ name: 'private-tron', chainId: 123 }, TronMainnet, {
      params: { tron: { testValue: 9 } },
      activatedProposals: [96],
      eips: [7939],
    })
    assert.strictEqual(common.chainName(), 'private-tron')
    assert.strictEqual(common.chainId(), 123n)
    assert.strictEqual(common.param('testValue'), 9n)
    assert.isTrue(common.isActivatedProposal(96))
    assert.isTrue(common.isActivatedEIP(7939))
    assert.isFalse(common.hasConsensus())
  })

  it('rejects Ethereum bases and custom hardfork overrides', () => {
    assert.throws(() => createCustomCommon({ chainId: 123 }, Mainnet), /Only TRON execution/)
    const variants: Partial<ChainConfig>[] = [
      { defaultHardfork: Hardfork.Cancun },
      { hardforks: [{ name: Hardfork.Cancun, block: 0 }] },
      { hardforks: [...TronMainnet.hardforks, { name: Hardfork.Cancun, block: 1 }] },
      { hardforks: [{ name: Hardfork.Tron, block: 0, timestamp: 1 }] },
      { hardforks: [{ name: Hardfork.Tron, block: 0, forkHash: '0x12345678' }] },
      { customHardforks: { tron: { eips: [4844] } } },
      { customHardforks: { tron: { consensus: { type: 'pow', algorithm: 'ethash' } } } },
    ]
    for (const variant of variants) {
      assert.throws(
        () => createCustomCommon(variant, TronMainnet),
        /Only the TRON execution profile/,
      )
    }
  })

  it('returns network metadata only when explicitly supplied and copies it independently', () => {
    const chain: ChainConfig = {
      ...TronMainnet,
      name: 'test-network-metadata',
      genesis: { gasLimit: 1, difficulty: 0, nonce: '0x0000000000000000', extraData: '0x' },
      consensus: { type: 'dpos', algorithm: 'dpos' },
    }
    const common = new Common({ chain })
    const copy = common.copy()
    assert.isTrue(common.hasGenesis())
    assert.isTrue(common.hasConsensus())
    assert.strictEqual(common.consensusType(), 'dpos')
    assert.strictEqual(common.consensusAlgorithm(), 'dpos')
    assert.deepEqual(common.consensusConfig(), {})
    assert.deepEqual(common.genesis(), chain.genesis)
    copy.genesis().gasLimit = 2
    assert.strictEqual(common.genesis().gasLimit, 1)
    assert.strictEqual(chain.genesis!.gasLimit, 1)
    assert.isFalse(new Common({ chain: TronMainnet }).hasGenesis())
  })
})
