# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
(modification: no type change headlines) and this project adheres to
[Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

### Breaking Changes

- Remove Blob parent-header and block transaction accounting; preserve ordinary header validation and canonical-chain selection.
- Default to `TronMainnet` and require an explicit genesis block or network genesis metadata. Reject mismatched genesis chainIds and consensus validation without explicit network metadata.
- Support local execution block storage without an implicit Ethereum consensus implementation.

### Fixes

- Remove the London activation-block fee override. Validate fees against the parent's `calcNextBaseFee()` and retain normal gas-limit bounds, rejection behavior and canonical-head selection.
- Migrate Geth allocation examples and genesis regressions to explicitly supplied local TRON metadata after removal of the Geth execution constructor; preserve the allocation state root and custom consensus contracts.
- Choose the canonical head by block number when the Common has no consensus metadata: a higher block extends the head, while re-put or lower blocks are stored without moving it. TRON execution presets default block difficulty to zero, so the total-difficulty comparison alone left the head at genesis after the consensus guard was introduced.
- Require Clique epoch checkpoint signer lists to exactly match the active signer list, rejecting empty, truncated, extended, duplicated, and reordered checkpoints

### Chores

- Update internal `@tvmjs/*` dependencies for the coordinated TVMJS release

## 1.0.0

### Tests

- Update genesis `stateRoot` and block hash expectations to match TRON account model (includes `asset` and `activePermissions` fields in RLP encoding)
- Skip MuirGlacier-dependent tests in `iterator.spec.ts` and `reorg.spec.ts` (hardfork not supported)
- Comment out Ethash uncle validation test in `blockValidation.spec.ts` (depends on removed `@tvmjs/ethash`)

### Chores

- Remove `@tvmjs/ethash` dev dependency; remove `ethash` and `genesis` from TypeScript project references
- Rename package namespace from `@ethereumjs/blockchain` to `@tvmjs/blockchain`; update all internal imports to `@tvmjs/*`
- Bump package version to `1.0.0`
- Lock all dependency versions by removing `^` and `~` prefixes
