import type { BlockRecord, TronTxRecord } from './blockStore.ts'
import type { NodeCore } from './node.ts'

/** A protocol rejection drops one queued transaction, not the rest of its block. */
export class TransactionRejectedError extends Error {}

export class DuplicateTransactionError extends TransactionRejectedError {}

/** Admission previews execution; mining re-executes and assigns the final block and receipt. */
export interface PendingTransaction {
  txid: string
  execute(node: NodeCore): Promise<{
    record: TronTxRecord
    merkleLeaf: string
    finalize(block: BlockRecord): void
  }>
}
