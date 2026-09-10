import {
  eip4844GethGenesis,
  goerliGethGenesis,
  invalidSpuriousDragonGethGenesis,
  kilnGethGenesis,
  postMergeGethGenesis,
} from '@tvmjs/testdata'
import { assert, describe, it } from 'vitest'

import { parseGethGenesisState } from '../src/gethGenesis.ts'
import { Hardfork, createCommonFromGethGenesis, parseGethGenesis } from '../src/index.ts'

describe('[Common/genesis]', () => {
  it('should properly generate stateRoot from gethGenesis', () => {
    const genesisState = parseGethGenesisState(kilnGethGenesis)
    // just check for deposit contract inclusion
    assert.exists(genesisState['0x4242424242424242424242424242424242424242'][1])
    assert.strictEqual(
      genesisState['0x4242424242424242424242424242424242424242'][1].includes(
        // sample data check
        '0x60806040526004361061003',
      ),
      true,
      'should have deposit contract',
    )
  })
})

describe('[Utils/Parse]', () => {
  it('should parse geth params file', async () => {
    const params = parseGethGenesis(eip4844GethGenesis)
    assert.strictEqual(
      params.genesis.nonce,
      '0x0000000000000042',
      'nonce should be correctly formatted',
    )
  })

  it('should throw with invalid Spurious Dragon blocks', async () => {
    const f = () => {
      parseGethGenesis(invalidSpuriousDragonGethGenesis, 'bad_params')
    }
    assert.throws(f, undefined, undefined, 'should throw')
  })

  it('should import poa network params correctly', async () => {
    let params = parseGethGenesis(goerliGethGenesis, 'poa')
    assert.strictEqual(params.genesis.nonce, '0x0000000000000000', 'nonce is formatted correctly')
    assert.deepEqual(
      params.consensus,
      { type: 'poa', algorithm: 'clique', clique: { period: 15, epoch: 30000 } },
      'consensus config matches',
    )
    const poaCopy = Object.assign({}, goerliGethGenesis)
    poaCopy.nonce = '00'
    params = parseGethGenesis(poaCopy, 'poa')
    assert.strictEqual(
      params.genesis.nonce,
      '0x0000000000000000',
      'non-hex prefixed nonce is formatted correctly',
    )
    assert.strictEqual(
      params.hardfork,
      Hardfork.Istanbul,
      'should correctly infer current hardfork',
    )
  })

  it('should generate expected hash with london block zero and base fee per gas defined', async () => {
    const params = parseGethGenesis(postMergeGethGenesis, 'post-merge')
    assert.strictEqual(params.genesis.baseFeePerGas, postMergeGethGenesis.baseFeePerGas)
  })

  it('should successfully parse genesis file with no extraData', async () => {
    const params = parseGethGenesis({ ...postMergeGethGenesis, extraData: '' }, 'noExtraData')
    assert.strictEqual(params.genesis.extraData, '0x', 'extraData set to 0x')
    assert.strictEqual(params.genesis.nonce, '0x0000000000000042', 'nonce parsed correctly')
  })

  it('rejects Ethereum genesis as an execution configuration', () => {
    for (const genesis of [eip4844GethGenesis, goerliGethGenesis, postMergeGethGenesis]) {
      assert.throws(
        () => createCommonFromGethGenesis(genesis, {}),
        /Only TRON execution configurations/,
      )
      assert.throws(
        () =>
          createCommonFromGethGenesis(genesis, {
            hardfork: Hardfork.Tron,
            activatedProposals: [95, 96],
          }),
        /Only TRON execution configurations/,
      )
    }
  })

  it.each(['cancun', 'prague', 'tron', 'unknown', 'empty'])(
    'explicitly rejects a %s blob schedule in parsing and execution constructors',
    (name) => {
      const blobSchedule =
        name === 'empty' ? {} : { [name]: { target: 3, max: 6, baseFeeUpdateFraction: 3338477 } }
      const genesis = {
        ...postMergeGethGenesis,
        config: { ...postMergeGethGenesis.config, blobSchedule },
      }
      const message = /blobSchedule is not supported by TRON configuration parsing/
      assert.throws(() => parseGethGenesis(genesis), message)
      assert.throws(() => createCommonFromGethGenesis(genesis, {}), message)
    },
  )
})
