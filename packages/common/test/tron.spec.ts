import { shanghaiTimeGethGenesis } from '@tvmjs/testdata'
import { assert, describe, it } from 'vitest'

import { hardforksDict } from '../src/hardforks.ts'
import {
  Common,
  Mainnet,
  createCommonFromGethGenesis,
  createCustomCommon,
  tronProposalsDict,
} from '../src/index.ts'

import { paramsTest } from './data/paramsTest.ts'

import type { ChainConfig } from '../src/index.ts'

describe('[Common]: TRON custom hardforks wiring (tronHardforksDict via customHardforks)', () => {
  // Control config: Mainnet without customHardforks, so every hardfork
  // resolves from the Ethereum hardforksDict only
  const controlChain: ChainConfig = { ...Mainnet }
  delete controlChain.customHardforks

  const withDict = new Common({ chain: Mainnet })
  const control = new Common({ chain: controlChain })

  it('should keep the hardfork sequence identical', () => {
    assert.deepEqual(
      withDict.hardforks().map((hf) => hf.name),
      control.hardforks().map((hf) => hf.name),
      'hardfork sequence should not change when tronHardforksDict is attached',
    )
    assert.strictEqual(withDict.hardfork(), control.hardfork(), 'default hardfork should match')
  })

  it('should keep EIP activation results identical on every hardfork', () => {
    // All EIPs referenced anywhere in the hardfork sequence plus prominent ones
    const eipsToCheck = [
      1, 606, 607, 608, 609, 1013, 1153, 1559, 1679, 1716, 2384, 2537, 2565, 2718, 2929, 2930, 3198,
      3529, 3541, 3651, 3675, 3855, 3860, 4399, 4788, 4844, 4895, 5656, 6780, 7516, 7702,
    ]
    for (const hf of control.hardforks()) {
      const a = withDict.copy()
      const b = control.copy()
      a.setHardfork(hf.name)
      b.setHardfork(hf.name)
      for (const eip of eipsToCheck) {
        assert.strictEqual(
          a.isActivatedEIP(eip),
          b.isActivatedEIP(eip),
          `EIP-${eip} activation should match on hardfork ${hf.name}`,
        )
      }
    }
  })

  it('should keep the params cache and activated EIPs cache identical', () => {
    assert.deepEqual(
      (withDict as any)['_paramsCache'],
      (control as any)['_paramsCache'],
      'params cache should not change when tronHardforksDict is attached',
    )
    assert.deepEqual(
      (withDict as any)['_activatedEIPsCache'],
      (control as any)['_activatedEIPsCache'],
      'activated EIPs cache should not change when tronHardforksDict is attached',
    )
  })

  it('should resolve the full HARDFORK_CHANGES config identically to the control', () => {
    // Stronger than per-EIP checks: guards the entire resolved config
    // (eips, params, consensus) for every hardfork in the Mainnet sequence.
    assert.deepEqual(
      (withDict as any)['HARDFORK_CHANGES'],
      (control as any)['HARDFORK_CHANGES'],
      'resolved hardfork config must be byte-identical with and without tronHardforksDict',
    )
  })

  it('should keep param() results identical after injecting real params', () => {
    const withParams = new Common({ chain: Mainnet, params: paramsTest })
    const controlWithParams = new Common({ chain: controlChain, params: paramsTest })
    const paramKeys = ['minerReward', 'bn254AddGas', 'netSstoreNoopGas']
    for (const hf of controlWithParams.hardforks()) {
      for (const key of paramKeys) {
        // param() throws for keys with no config on the active hardfork;
        // compare the outcome (value or throw) on both instances.
        let aResult: bigint | string
        let bResult: bigint | string
        try {
          aResult = withParams.paramByHardfork(key, hf.name).toString()
        } catch {
          aResult = 'throw'
        }
        try {
          bResult = controlWithParams.paramByHardfork(key, hf.name).toString()
        } catch {
          bResult = 'throw'
        }
        assert.strictEqual(
          aResult,
          bResult,
          `param(${key}) on hardfork ${hf.name} should match with and without tronHardforksDict`,
        )
      }
    }
  })

  it('should actually take the customHardforks overlay branch (not silently fall back)', () => {
    // Proves the overlay path in the Common constructor is exercised: a custom
    // dict that overrides cancun with a distinct EIP set must win over
    // hardforksDict, while a hardfork absent from it (berlin) still falls back.
    const overlayChain: ChainConfig = {
      ...Mainnet,
      customHardforks: {
        ...hardforksDict,
        cancun: { eips: [1153] }, // drop 4844/4788/5656/6780/7516 vs. ethereum cancun
      },
    }
    const overlay = new Common({ chain: overlayChain })
    overlay.setHardfork('cancun')
    assert.isTrue(overlay.isActivatedEIP(1153), 'overridden cancun should keep EIP-1153')
    assert.isFalse(
      overlay.isActivatedEIP(4844),
      'overridden cancun should NOT activate EIP-4844 (overlay branch taken)',
    )
    // berlin is absent from the overlay dict -> must fall back to hardforksDict
    overlay.setHardfork('berlin')
    assert.isTrue(overlay.isActivatedEIP(2929), 'berlin should fall back to hardforksDict EIPs')
  })
})

describe('[Common]: TRON proposal gating state', () => {
  it('should default to no activated proposals', () => {
    const c = new Common({ chain: Mainnet })
    assert.deepEqual(c.activatedProposals(), [], 'no proposal should be activated by default')
    assert.isFalse(c.isActivatedProposal(95))
    assert.isFalse(c.isActivatedProposal(96))
  })

  it('should activate proposal 95 only', () => {
    const c = new Common({ chain: Mainnet, activatedProposals: [95] })
    assert.isTrue(c.isActivatedProposal(95))
    assert.isFalse(c.isActivatedProposal(96))
    assert.deepEqual(c.activatedProposals(), [95])
  })

  it('should activate proposal 96 only', () => {
    const c = new Common({ chain: Mainnet, activatedProposals: [96] })
    assert.isFalse(c.isActivatedProposal(95))
    assert.isTrue(c.isActivatedProposal(96))
    assert.deepEqual(c.activatedProposals(), [96])
  })

  it('should activate proposals 95 and 96 together', () => {
    const c = new Common({ chain: Mainnet, activatedProposals: [96, 95] })
    assert.isTrue(c.isActivatedProposal(95))
    assert.isTrue(c.isActivatedProposal(96))
    assert.deepEqual(c.activatedProposals(), [95, 96], 'should be stored in ascending order')
  })

  it('should deduplicate repeated IDs', () => {
    const c = new Common({ chain: Mainnet, activatedProposals: [96, 95, 96, 95, 95] })
    assert.deepEqual(c.activatedProposals(), [95, 96])
  })

  it('should throw on unknown or invalid IDs at instantiation', () => {
    for (const invalid of [[999], [0], [-95], [95.5], [Number.MAX_SAFE_INTEGER + 1]]) {
      assert.throws(
        () => new Common({ chain: Mainnet, activatedProposals: invalid }),
        undefined,
        undefined,
        `should throw for activatedProposals: [${invalid}]`,
      )
    }
  })

  it('should return false for unknown IDs on query', () => {
    const c = new Common({ chain: Mainnet, activatedProposals: [95] })
    assert.isFalse(c.isActivatedProposal(999))
    assert.isFalse(c.isActivatedProposal(0))
  })

  it('should not be affected by external modification of the returned array', () => {
    const c = new Common({ chain: Mainnet, activatedProposals: [95] })
    const external = c.activatedProposals()
    external.push(96)
    external.length = 0
    assert.deepEqual(c.activatedProposals(), [95], 'internal state should stay unchanged')
    assert.isFalse(c.isActivatedProposal(96))
  })

  it('should keep proposal state independent between copies', () => {
    const c = new Common({ chain: Mainnet, activatedProposals: [95] })
    const copied = c.copy()
    assert.deepEqual(copied.activatedProposals(), [95], 'copy should carry the proposal state')
    // biome-ignore lint/complexity/useLiteralKeys: accessing protected state for isolation check
    ;(copied as any)['_activatedProposals'].push(96)
    assert.deepEqual(c.activatedProposals(), [95], 'original should not see copy mutations')
  })

  it('should not alter EIPs, params or hardfork state when proposals are activated', () => {
    const base = new Common({ chain: Mainnet })
    const withProposals = new Common({ chain: Mainnet, activatedProposals: [95, 96] })
    assert.strictEqual(withProposals.hardfork(), base.hardfork())
    for (const eip of [1153, 2929, 2935, 4844, 5656, 7516, 7823, 7883, 7939, 7951]) {
      assert.strictEqual(
        withProposals.isActivatedEIP(eip),
        base.isActivatedEIP(eip),
        `EIP-${eip} activation should not change`,
      )
    }
    assert.deepEqual(
      (withProposals as any)['_paramsCache'],
      (base as any)['_paramsCache'],
      'params cache should not change when proposals are activated',
    )
  })

  it('should register proposals 95/96 in tronProposalsDict', () => {
    assert.strictEqual(tronProposalsDict[95].name, 'ALLOW_TVM_PRAGUE')
    assert.strictEqual(tronProposalsDict[96].name, 'ALLOW_TVM_OSAKA')
  })

  it('should pass activatedProposals through createCustomCommon()', () => {
    const c = createCustomCommon({ chainId: 123 }, Mainnet, { activatedProposals: [95, 96] })
    assert.isTrue(c.isActivatedProposal(95))
    assert.isTrue(c.isActivatedProposal(96))
    assert.deepEqual(c.activatedProposals(), [95, 96])
    const without = createCustomCommon({ chainId: 123 }, Mainnet)
    assert.deepEqual(without.activatedProposals(), [], 'should stay empty when not passed')
  })

  it('should pass activatedProposals through createCommonFromGethGenesis()', () => {
    const c = createCommonFromGethGenesis(shanghaiTimeGethGenesis, {
      chain: 'withdrawals',
      activatedProposals: [95],
    })
    assert.isTrue(c.isActivatedProposal(95))
    assert.isFalse(c.isActivatedProposal(96))
    assert.deepEqual(c.activatedProposals(), [95])
    const without = createCommonFromGethGenesis(shanghaiTimeGethGenesis, {
      chain: 'withdrawals',
    })
    assert.deepEqual(without.activatedProposals(), [], 'should stay empty when not passed')
  })

  it('should keep tronProposalsDict immutable (frozen)', () => {
    assert.isTrue(Object.isFrozen(tronProposalsDict), 'dict itself should be frozen')
    assert.isTrue(Object.isFrozen(tronProposalsDict[95]), 'each entry should be frozen')
    // Mutations must not take effect (throw in strict mode / silently ignored otherwise)
    assert.throws(() => {
      ;(tronProposalsDict as any)[97] = { name: 'ALLOW_TVM_FUTURE' }
    })
    assert.throws(() => {
      ;(tronProposalsDict[95] as any).name = 'MUTATED'
    })
    assert.isUndefined((tronProposalsDict as any)[97], 'new key must not be added')
    assert.strictEqual(tronProposalsDict[95].name, 'ALLOW_TVM_PRAGUE', 'name must be unchanged')
  })
})
