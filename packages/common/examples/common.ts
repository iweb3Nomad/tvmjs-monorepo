import { Common, Hardfork, TronMainnet, createCustomCommon } from '@tvmjs/common'

// With enums:
const commonWithEnums = new Common({ chain: TronMainnet, hardfork: Hardfork.Tron })

// Instantiate with the chain (and the default hardfork)
let c = new Common({ chain: TronMainnet })

// Get bootstrap nodes for chain/network
console.log('Below are the known bootstrap nodes')
console.log(c.bootstrapNodes()) // Array with current nodes

// Explicitly activate the CLZ instruction
c = new Common({ chain: TronMainnet, hardfork: Hardfork.Tron, eips: [7939] })
console.log(`CLZ is active -- ${c.isActivatedEIP(7939)}`)

// Instantiate common with custom chainID
const commonWithCustomChainId = createCustomCommon({ chainId: 1234 }, TronMainnet)
console.log(`The current chain ID is ${commonWithCustomChainId.chainId()}`)
