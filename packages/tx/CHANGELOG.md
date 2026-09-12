# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
(modification: no type change headlines) and this project adheres to
[Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

### Breaking Changes

- Remove EIP-3860 initcode validation and word metering, `TxOptions.allowUnlimitedInitCodeSize` and `paramsTx[3860]`. Reject the removed option regardless of its value; retain ordinary data fees, creation overhead, signing and serialization.
- Remove EIP-7702 transactions (type `0x04`), constructors, capabilities, type guards, authorization data types and dedicated examples. Reject type `0x04` and both authorization field spellings before normalization or transaction construction; preserve ordinary signing and serialization.
- Remove Blob transactions (type `0x03`), constructors, network wrappers, type guards and public data types. Reject Blob inputs through object, RPC, RLP and block-body constructors while preserving ordinary transaction encoding and signing.
- Keep access-list transaction encoding while removing Ethereum address and storage-key access-list charges from TRON intrinsic gas.
- Default transaction configuration to `TronMainnet` and use the TRON capability matrix for legacy signature and replay-protection behavior. Pass the intended network's Common explicitly when constructing and signing transactions.

### Fixes

- Do not apply Ethereum EIP-3860 initcode-size validation or word metering when constructing transactions for a TRON chain profile, independently of the selected hardfork
- Reject nonzero `tokenId` and `tokenValue` on retained EIP-2930 and EIP-1559 transactions because these fields are not part of their signing payloads or serialization; TRC-10 transaction-level transfers remain supported by the signed legacy format

### Chores

- Update internal `@tvmjs/*` dependencies for the coordinated TVMJS release

## 1.0.0

### Features

- **TRC-10 token support**: Add `tokenId` and `tokenValue` fields to all transaction types (Legacy, EIP-1559, EIP-2930, EIP-4844, EIP-7702); expose both fields in `TxData` / `JsonTx` types and include them in serialization via `internal.ts` ([4932e3ce](https://github.com/tronweb3/tvmjs-monorepo/commit/4932e3ce3))

### Tests

- Rename `eip7825.spec.ts`, `t9n.spec.ts`, and `transactionRunner.spec.ts` with underscore prefix to skip incompatible tests
- Skip EIP-4844 invalid constructor scenario tests (not supported in TRON)

### Chores

- Rename package namespace from `@ethereumjs/tx` to `@tvmjs/tx`; update all internal imports to `@tvmjs/*`
- Bump package version to `1.0.0`
- Lock all dependency versions by removing `^` and `~` prefixes
