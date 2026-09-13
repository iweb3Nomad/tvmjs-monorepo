import { Common, TronMainnet, TronNile, TronShasta } from '@tvmjs/common'
import { RLP } from '@tvmjs/rlp'
import {
  KECCAK256_RLP,
  createWithdrawal,
  createWithdrawalFromBytesArray,
  hexToBytes,
} from '@tvmjs/util'
import { describe, expect, it } from 'vitest'

import { genWithdrawalsTrieRoot } from '../src/helpers.ts'
import {
  createBlock,
  createBlockFromBytesArray,
  createBlockFromExecutionPayload,
  createBlockFromRLP,
  createBlockHeader,
} from '../src/index.ts'

import type { WithdrawalBytes } from '@tvmjs/util'
import type { BlockBytes } from '../src/index.ts'

const gethWithdrawals8BlockRlp =
  '0xf903e1f90213a0fe950635b1bd2a416ff6283b0bbd30176e1b1125ad06fa729da9f3f4c1c61710a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794aa00000000000000000000000000000000000000a07f7510a0cb6203f456e34ec3e2ce30d6c5590ded42c10a9cf3f24784119c5afba056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b901000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080018401c9c380802f80a0ff0000000000000000000000000000000000000000000000000000000000000088000000000000000007a0b695b29ec7ee934ef6a68838b13729f2d49fffe26718de16a1a9ed94a4d7d06dc0c0f901c6da8082ffff94000000000000000000000000000000000000000080f83b0183010000940100000000000000000000000000000000000000a00100000000000000000000000000000000000000000000000000000000000000f83b0283010001940200000000000000000000000000000000000000a00200000000000000000000000000000000000000000000000000000000000000f83b0383010002940300000000000000000000000000000000000000a00300000000000000000000000000000000000000000000000000000000000000f83b0483010003940400000000000000000000000000000000000000a00400000000000000000000000000000000000000000000000000000000000000f83b0583010004940500000000000000000000000000000000000000a00500000000000000000000000000000000000000000000000000000000000000f83b0683010005940600000000000000000000000000000000000000a00600000000000000000000000000000000000000000000000000000000000000f83b0783010006940700000000000000000000000000000000000000a00700000000000000000000000000000000000000000000000000000000000000'

describe('Retained withdrawals data tools', () => {
  it('should correctly generate withdrawalsRoot', async () => {
    const raw = RLP.decode(hexToBytes(gethWithdrawals8BlockRlp)) as BlockBytes
    const withdrawals = (raw[3] as WithdrawalBytes[]).map(createWithdrawalFromBytesArray)
    expect(withdrawals).toHaveLength(8)
    expect(await genWithdrawalsTrieRoot(withdrawals)).toEqual(raw[0][16])
  })

  it('preserves empty, single and multiple withdrawal trie vectors', async () => {
    const first = createWithdrawal({
      index: 0n,
      validatorIndex: 0n,
      address: `0x${'20'.repeat(20)}`,
      amount: 1000n,
    })
    const second = createWithdrawal({
      index: 1n,
      validatorIndex: 11n,
      address: `0x${'30'.repeat(20)}`,
      amount: 2000n,
    })
    expect(await genWithdrawalsTrieRoot([])).toEqual(KECCAK256_RLP)
    expect(await genWithdrawalsTrieRoot([first])).toEqual(
      hexToBytes('0x897ca49edcb278aecab2688bcc2b7b7ee43524cc489672534fee332a172f1718'),
    )
    expect(await genWithdrawalsTrieRoot([first, second])).toEqual(
      hexToBytes('0x3b514862c42008079d461392e29d5b6775dd5ed370a6c4441ccb8ab742bf2436'),
    )
  })
})

describe.each([TronMainnet, TronNile, TronShasta])('Unavailable withdrawals on $name', (chain) => {
  it('rejects withdrawals in object, raw, RLP and execution payload inputs', async () => {
    const common = new Common({ chain })
    const block = createBlock({}, { common })
    expect(common.isActivatedEIP(4895)).toBe(false)
    expect(() => common.setEIPs([4895])).toThrow()
    expect(block.withdrawals).toBeUndefined()
    expect(block.toJSON()).not.toHaveProperty('withdrawals')
    expect(() => createBlockHeader({ withdrawalsRoot: KECCAK256_RLP }, { common })).toThrow(
      'EIP4895',
    )
    expect(() => createBlock({ withdrawals: [] }, { common })).toThrow('EIP 4895')
    expect(() => createBlockFromRLP(hexToBytes(gethWithdrawals8BlockRlp), { common })).toThrow(
      'EIP4895',
    )
    await expect(
      createBlockFromExecutionPayload(
        { ...block.toExecutionPayload(), withdrawals: [] },
        { common },
      ),
    ).rejects.toThrow('EIP4895')
    // Reject a body extension even when no corresponding header root is present.
    const raw: BlockBytes = [block.header.raw(), [], [], []]
    expect(() => createBlockFromBytesArray(raw, { common })).toThrow(
      'Unsupported block body extension',
    )
    expect(() => createBlockFromRLP(RLP.encode(raw), { common })).toThrow(
      'Unsupported block body extension',
    )
  })
})
