import type { TronProposalsDict } from './types.ts'

/**
 * TRON governance proposals known to TVMJS.
 *
 * Entries are pure gating identities: they only register a proposal ID and
 * name so that activation state can be stored and queried via `Common`
 * (see `CommonOpts.activatedProposals` / `Common.isActivatedProposal`).
 * No EIPs, params, opcodes or precompiles are attached to a proposal at this
 * stage, and activating a proposal does not alter protocol behavior yet.
 * Whether and in which combination these proposals activate on a given
 * network is subject to TRON governance.
 */
export const tronProposalsDict: TronProposalsDict = Object.freeze({
  /**
   * Proposal 95: ALLOW_TVM_PRAGUE
   * Scope (not wired yet): EIP-2935
   */
  95: Object.freeze({ name: 'ALLOW_TVM_PRAGUE' }),
  /**
   * Proposal 96: ALLOW_TVM_OSAKA
   * Scope (not wired yet): EIP-7939, EIP-7823, EIP-7883, EIP-7951, TIP-854, TIP-871
   */
  96: Object.freeze({ name: 'ALLOW_TVM_OSAKA' }),
})
