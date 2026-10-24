/**
 * wagmi configuration — uses ConnectKit getDefaultConfig for correct connector wiring
 */
import { getDefaultConfig } from 'connectkit'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// Use the correct Arc Testnet RPC from onchain-facts
const arcFact = requireChain(arcTestnet.id)
const ARC_RPC = arcFact.rpcUrls[0]

registerChain(arcTestnet.id, ARC_RPC)

export const config = createConfig(
  getDefaultConfig({
    appName: 'MemoPay',
    chains: [arcTestnet, mainnet],
    transports: {
      [arcTestnet.id]: http(ARC_RPC),
      [mainnet.id]: http(),
    },
    walletConnectProjectId: 'memopay-dev', // placeholder — replace with real WC project ID for production
  }),
)
