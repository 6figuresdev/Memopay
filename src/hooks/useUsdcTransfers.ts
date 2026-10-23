/**
 * Fetches live USDC Transfer events for a given address on Arc Testnet
 * using wagmi's useWatchContractEvent + useReadContract patterns.
 */
import { useEffect, useState, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem, type Address } from 'viem'
import { getUsdc, requireChain } from '@/onchain-facts'

const ARC_TESTNET_ID = 5042002
const usdcFact = getUsdc(ARC_TESTNET_ID)!
const USDC_ADDRESS = usdcFact.address as Address
const EXPLORER_BASE = requireChain(ARC_TESTNET_ID).explorerBase

export interface LiveTransfer {
  id: string
  direction: 'sent' | 'received'
  from: string
  to: string
  amount: bigint    // raw 6-decimal units
  txHash: string
  blockNumber: bigint
  explorerUrl: string
}

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

// Keep a bounded lookback — head minus this many blocks
const LOOKBACK = 5000n

export function useUsdcTransfers(address: Address | undefined) {
  const client = usePublicClient({ chainId: ARC_TESTNET_ID })
  const [transfers, setTransfers] = useState<LiveTransfer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!address || !client) return
    setLoading(true)
    setError(null)
    try {
      const head = await client.getBlockNumber()
      const fromBlock = head > LOOKBACK ? head - LOOKBACK : 0n

      // Sent: Transfer(from=address, to=any)
      const [sent, received] = await Promise.all([
        client.getLogs({
          address: USDC_ADDRESS,
          event: TRANSFER_EVENT,
          args: { from: address },
          fromBlock,
          toBlock: head,
        }),
        client.getLogs({
          address: USDC_ADDRESS,
          event: TRANSFER_EVENT,
          args: { to: address },
          fromBlock,
          toBlock: head,
        }),
      ])

      const all: LiveTransfer[] = [
        ...sent.map((log) => ({
          id: `${log.transactionHash}-out`,
          direction: 'sent' as const,
          from: (log.args.from ?? '') as string,
          to: (log.args.to ?? '') as string,
          amount: (log.args.value ?? 0n),
          txHash: log.transactionHash ?? '',
          blockNumber: log.blockNumber ?? 0n,
          explorerUrl: `${EXPLORER_BASE}/tx/${log.transactionHash}`,
        })),
        ...received.map((log) => ({
          id: `${log.transactionHash}-in`,
          direction: 'received' as const,
          from: (log.args.from ?? '') as string,
          to: (log.args.to ?? '') as string,
          amount: (log.args.value ?? 0n),
          txHash: log.transactionHash ?? '',
          blockNumber: log.blockNumber ?? 0n,
          explorerUrl: `${EXPLORER_BASE}/tx/${log.transactionHash}`,
        })),
      ]

      // Sort newest first (by block, then direction as tiebreaker)
      all.sort((a, b) => {
        const diff = Number(b.blockNumber - a.blockNumber)
        return diff !== 0 ? diff : a.direction.localeCompare(b.direction)
      })

      setTransfers(all)
    } catch (e) {
      setError('Failed to load transactions. Retrying...')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [address, client])

  // Trigger initial load and poll — we intentionally call fetch (an async external sync fn)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void fetch()
    const interval = setInterval(() => { void fetch() }, 12_000)
    return () => clearInterval(interval)
  }, [fetch]) // eslint-disable-line react/set-state-in-effect

  return { transfers, loading, error, refetch: fetch }
}

// Re-export for convenience
export { USDC_ADDRESS, ARC_TESTNET_ID, EXPLORER_BASE }
