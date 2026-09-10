import { Hardfork } from './enums.ts'

/**
 * The TRON execution profile. Parameter groups are listed explicitly instead of
 * inheriting an Ethereum network's hardfork schedule or consensus transitions.
 *
 * EIP numbers identify shared implementations, not Ethereum network upgrades.
 * Access accounting is retained here until the separate TRON Energy migration.
 * Blob transactions, beacon roots, withdrawals and Ethereum consensus are absent.
 * Governance proposals remain independent of explicitly selected capabilities.
 */
export const tronExecutionProfile = Object.freeze({
  hardfork: Hardfork.Tron,
  eips: Object.freeze([
    1, 606, 608, 607, 609, 1013, 1716, 1679, 2565, 2929, 2718, 2930, 1559, 3198, 3529, 3541, 3651,
    3855, 3860, 1153, 5656, 6780,
  ]),
  optionalEIPs: Object.freeze([7939]),
})
