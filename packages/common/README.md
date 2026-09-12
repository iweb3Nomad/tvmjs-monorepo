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

EIP-2929 cold/warm pricing, EIP-3529 refund rules and EIP-3651 coinbase warming are disabled and cannot be enabled explicitly. EIP-2930 remains available for transaction encoding; access lists do not change TRON Energy costs. See [TVM Energy accounting](../tvm/README.md#tron-energy-accounting) for the reference schedule and its boundaries.

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

`parseGethGenesis()` explicitly rejects `blobSchedule`, `blobGasUsed` and `excessBlobGas`, including empty schedules and entries named `tron`. Other supported genesis fields can still be parsed as raw data.

## Blob removal in v1.2.0

Blob support has been physically removed from this development branch. EIPs 4844, 7516, 7594, 7691, 7892 and 7918 cannot be activated. This is a breaking API change across the following packages:

| Package | Removed APIs and behavior |
| --- | --- |
| `@tvmjs/common` | `getBlobGasSchedule()`, `BpoSchedule`, `GethGenesisBlobSchedule`, `CustomCrypto.kzg`, and Blob genesis fields. |
| `@tvmjs/tx` | `Blob4844Tx`, `TransactionType.BlobEIP4844`, Blob constructors and type guards, network wrappers, `NetworkWrapperType`, and Blob data/JSON/RLP interfaces. |
| `@tvmjs/block` | `blobGasUsed`, `excessBlobGas`, `getBlobGasPrice()`, `calcDataFee()`, `calcNextExcessBlobGas()`, `calcNextBlobGasPrice()`, and `validateBlobTransactions()`. |
| `@tvmjs/blockchain` | Blob validation and parent-header Blob accounting. |
| `@tvmjs/tvm` | BLOBHASH (`0x49`), BLOBBASEFEE (`0x4a`), `blobVersionedHashes` execution/message context, `blobGasUsed` results, `getBlobBaseFee()`, and KZG precompile errors. TRON's multi-sign precompile remains at `0x0a`. |
| `@tvmjs/vm` | Blob fees/results/receipts, `EIP4844BlobTxReceipt`, `BlockBuilder.blobGasUsed`, `addTransaction({ allowNoBlobs })`, and the last two Blob arguments of `generateTxReceipt()` (now four arguments). |
| `@tvmjs/util` | The `blobs` and `kzg` modules: `KZG`, `CELLS_PER_EXT_BLOB`, `getBlob`, `getBlobs`, `computeVersionedHash`, `commitmentsToVersionedHashes`, and all `blobsTo*` helpers. |

Remove Blob options and KZG initialization from ordinary TRON execution calls. Explicitly supplied retired fields, including zero, empty arrays, `null` and `undefined`, now throw instead of being discarded. Transaction type `0x03` is rejected by object, RPC, RLP and block-body entry points; do not relabel a Blob transaction as another transaction type. Existing Legacy (`0x00`), EIP-2930 (`0x01`) and EIP-1559 (`0x02`) type numbers and encodings are unchanged.

Ordinary TRON execution headers keep their existing 16-field RLP order. Old extended headers containing Blob positions are rejected rather than shifted into later Ethereum fields. The Beacon payload data converter remains available for supported fields and rejects both snake-case and camel-case Blob gas fields before conversion.

The dedicated `kzg-wasm`, `micro-eth-signer` and `@paulmillr/trusted-setups` dependencies and their examples have been removed. Rebuild all affected workspaces together. When upgrading an existing checkout, use a clean build so obsolete Blob files from earlier builds are not included in package artifacts.

## Beacon root removal in v1.2.0

EIP-4788 Beacon root support has been physically removed. It remains unavailable on TronMainnet, TronNile and TronShasta; construction, `setEIPs()` and `paramByEIP()` reject EIP-4788.

| Package | Removed APIs and behavior |
| --- | --- |
| `@tvmjs/common` | EIP-4788 metadata entry. |
| `@tvmjs/block` | `BlockHeader.parentBeaconBlockRoot` and the corresponding HeaderData, JSONHeader, JSONRPCBlock, ExecutionPayload and BeaconPayloadJSON fields; header serialization and input/output mappings. |
| `@tvmjs/tvm` | EIP-4788 support declaration; caller-supplied block contexts containing Beacon root fields are rejected before execution. |
| `@tvmjs/vm` | Beacon root initialization and ring-buffer writes in `runBlock()` and `buildBlock()`, the internal `accumulateParentBeaconBlockRoot()` helper, and the `historicalRootsLength` parameter. |

Omit `parentBeaconBlockRoot` and `parent_beacon_block_root` when creating ordinary TRON block contexts. Both names are rejected by presence, including explicit `undefined`, `null`, zero and empty values. VM block/transaction entry points and builders validate these fields before events, checkpoints or state-root changes. Ethereum Beacon-era blocks remain unsupported; dropping their fields would change the block identity.

Ordinary TRON headers retain their 16-field RLP order and hashes. The Beacon payload converter remains a data tool for ordinary fields and the retained withdrawals/requests mappings; those Ethereum execution features cannot be activated in the TRON profile. EIP-2935 history handling and other inactive extensions remain outside this removal.

## EIP-7702 removal in v1.2.0

EIP-7702 transactions, authorization signing and code delegation have been physically removed. All three TRON presets continue to reject EIP-7702 activation and parameter queries.

| Package | Removed APIs and behavior |
| --- | --- |
| `@tvmjs/common` | EIP-7702 metadata entry. |
| `@tvmjs/tx` | `EOACode7702Tx`, `createEOACode7702Tx*`, `isEOACode7702Tx*`, `TransactionType.EOACodeEIP7702`, `Capability.EIP7702EOACode`, `EIP7702CompatibleTx`, and authorization transaction data/JSON/RLP types. |
| `@tvmjs/util` | The `authorization` module, `eoaCode7702*` signing/recovery/conversion helpers, `EOA_CODE_7702_AUTHORITY_SIGNING_MAGIC`, and `EOACode7702AuthorizationList*` types and guards. |
| `@tvmjs/block` | Acceptance of type `0x04` or authorization fields in object, RPC, binary and payload transactions, including transactions supplied directly to `new Block()`. |
| `@tvmjs/tvm` | Delegation target lookup, its dedicated access tracking, the EIP-7702 support declaration and `DELEGATION_7702_FLAG`. |
| `@tvmjs/vm` | Authorization processing, authority nonce/code updates, authorization refunds and the delegated-sender exception. |

Type `0x04` is rejected at transaction and block input boundaries. Both `authorizationList` and `authorization_list` are rejected by field presence, including `undefined`, `null` and empty lists on ordinary transactions. `runTx()`, `runBlock()` and `BlockBuilder.addTransaction()` validate supplied transaction objects before events or state changes; a retired transaction later in a block is rejected before the first transaction executes.

For ordinary TRON transactions, remove obsolete authorization options from the application code and use types `0x00`, `0x01` or `0x02`. Their signing payloads, type numbers, chain IDs and TRC-10 validation rules are unchanged. There is no replacement for Ethereum delegation: relabeling a signed `0x04` transaction or dropping its authorization list would change its meaning and signature.

Stored code beginning with `0xef0100` is executed as ordinary bytecode and fails with an invalid opcode; it no longer redirects execution. Transaction senders with any deployed code remain rejected. Ordinary CALL/DELEGATECALL storage contexts, execution refunds and state rollback are preserved. Generic signature and address utilities remain available; their shared crypto dependencies are still required.

Rebuild the affected packages together from clean outputs. Incremental TypeScript builds can leave obsolete `tx/7702`, `tx/capabilities/eip7702` and `util/authorization` files in `dist`; they must not be included in release artifacts. EOF, BAL, history and requests implementations remain subject to the existing TRON capability restrictions and are outside this removal.

## Parameters

Execution packages register their parameter dictionaries with Common. Parameters are merged in the explicit order in `tronExecutionProfile.eips`, followed by the `tron` parameter group and explicitly enabled optional EIPs. Selecting an already active baseline EIP does not override the TRON parameter group.

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

Execution constructors preserve existing Common parameters when loading defaults. `updateParams(defaults, false)` fills missing values; the default `updateParams(overrides)` behavior still replaces supplied values. Put custom Energy settings in the `tron` parameter group.

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
