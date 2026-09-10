# @tvmjs/common

Shared configuration for TVMJS. This development branch introduces the v1.2.0 TRON-only execution configuration.

## Installation

```sh
npm install @tvmjs/common
```

## TRON networks

| Preset | chainId | Execution profile |
| --- | --- | --- |
| `TronMainnet` | `728126428` | `tron` |
| `TronNile` | `3448148188` | `tron` |
| `TronShasta` | `2494104990` | `tron` |

```ts
import { Common, Hardfork, TronMainnet, createTronChainIdCommon } from '@tvmjs/common'

const common = new Common({ chain: TronMainnet, hardfork: Hardfork.Tron })
console.log(common.chainId()) // 728126428n
const nile = createTronChainIdCommon('nile')
console.log(nile.chainId()) // 3448148188n
```

`tron` is the only selectable execution profile. Block numbers and timestamps do not select Ethereum upgrades. The profile's block-zero marker describes an execution configuration, not a historical TRON activation schedule. The `chainId` is returned by the CHAINID opcode when this Common is supplied to a VM or TVM.

Ethereum presets, Ethereum hardforks, custom hardfork schedules and the old `Mainnet + hardfork: 'tron'` combination are rejected. Unknown preset names or IDs also throw instead of selecting a different network.

## Execution capabilities and proposals

The exported `tronExecutionProfile` lists the shared implementation groups explicitly. It has no inherited Ethereum hardfork schedule or consensus transition.

- Baseline execution includes the existing TRON opcode set, transient storage, PUSH0, MCOPY and SELFDESTRUCT behavior.
- `eips: [7939]` explicitly enables CLZ. `common.eips()` returns explicit selections; `common.isActivatedEIP(id)` includes baseline selections.
- Unsupported capabilities, including Blob transactions, beacon roots, withdrawals and Ethereum consensus transitions, cannot be activated through `setEIPs()` or a custom hardfork.
- Proposal 95 and 96 remain independent governance flags. No proposal is active by default, and they do not automatically activate CLZ or the complete Prague/Osaka feature sets.

```ts
import { Common, TronNile } from '@tvmjs/common'

const common = new Common({
  chain: TronNile,
  activatedProposals: [95, 96],
  eips: [7939],
})
console.log(common.isActivatedProposal(96)) // true
console.log(common.isActivatedEIP(7939)) // true
```

The configuration migration currently retains existing EIP-2929 access accounting. Its removal and java-tron Energy comparisons are a separate v1.2.0 development stage; this configuration change does not claim complete Gas alignment.

## Execution presets and network metadata

`TronExecutionChainConfig` contains execution settings without `genesis` or `consensus`. `NetworkChainConfig` describes explicitly supplied network metadata. No TRON preset inherits Ethereum genesis, Ethash, Casper, discovery records or fork hashes.

```ts
import { Common, TronMainnet } from '@tvmjs/common'

const common = new Common({ chain: TronMainnet })
console.log(common.hasGenesis()) // false
console.log(common.hasConsensus()) // false
```

`genesis()`, `consensusType()`, `consensusAlgorithm()` and `consensusConfig()` throw a metadata error when the corresponding data was not supplied. VM/TVM execution and execution block contexts work without it. Creating a `Blockchain` requires an explicit genesis block or network genesis metadata; enabling consensus validation additionally requires explicit consensus metadata and an implementation. This library does not provide a TRON node consensus implementation.

Ethereum fork-hash operations and creating execution configuration from Geth genesis are unsupported. Legacy preset constants and raw parsing helpers may remain available during migration, but they do not enable Ethereum execution.

`parseGethGenesis()` explicitly rejects `blobSchedule`, including empty schedules and entries named `tron`. Other supported genesis fields can still be parsed as raw data.

## Parameters

Execution packages register their parameter dictionaries with Common. Parameters are merged in the explicit order in `tronExecutionProfile.eips`, followed by the `tron` parameter group and explicitly enabled EIPs.

```ts
import { Common, TronMainnet } from '@tvmjs/common'

const common = new Common({
  chain: TronMainnet,
  params: { tron: { exampleLimit: 64 } },
})
console.log(common.param('exampleLimit')) // 64n
common.updateParams({ tron: { exampleLimit: 128 } })
console.log(common.paramByHardfork('exampleLimit', 'tron')) // 128n
```

`updateParams()` merges dictionaries; `resetParams()` replaces them. `paramByEIP()` uses the same supported EIP set as `setEIPs()`. It can read parameters for a supported optional EIP before activation, and querying does not activate that EIP. Retired EIPs are rejected even if their parameter dictionaries were supplied. `paramByHardfork()` accepts the TRON profile, while `paramByBlock()` uses the same profile for the supplied context. Missing parameters throw.

## Custom networks and cryptography

```ts
import { TronMainnet, createCustomCommon } from '@tvmjs/common'

const common = createCustomCommon({ name: 'private-tron', chainId: 123 }, TronMainnet)
console.log(common.chainId()) // 123n
```

Custom networks use the TRON profile. Supply parameter overrides, supported explicit capabilities and governance flags through the corresponding options. Custom Ethereum hardfork dictionaries are rejected.

`customCrypto` continues to support alternative hashing and signing primitives. See [the custom crypto example](./examples/customCrypto.ts). `copy()` isolates parameter dictionaries, proposal state, EIP selections and network metadata; crypto function references are preserved and event listeners are not copied.

## VM/TVM configuration consistency

When `common`, `tvmOpts.common` or `tvm.common` are supplied together, VM checks for conflicting network IDs, capabilities, proposals, crypto functions and supplied active parameter values. Equivalent configurations are accepted and the VM and TVM share the selected Common instance. Parameter defaults are checked again after initialization.

## Builds and development

ES modules, CommonJS and browser builds are supported. The repository validation environment is Node `20.20.0` and npm `10.8.2`.

```sh
npm run test:node --workspace @tvmjs/common
npm run examples --workspace @tvmjs/common
```

## Upstream

This package is derived from EthereumJS Common and retains shared algorithms and parameter dictionaries needed by TVMJS.

## License

[MIT](./LICENSE)
