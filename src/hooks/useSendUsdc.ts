import { useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useAccount } from 'wagmi'
import { erc20Abi, type Address } from 'viem'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { USDC_ADDRESS, ARC_TESTNET_ID } from './useUsdcTransfers'

export function useSendUsdc() {
  const { chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const {
    writeContract,
    data: hash,
    isPending,
    reset,
    error: writeError,
  } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const wrongChain = chainId !== ARC_TESTNET_ID

  const send = (to: Address, amountStr: string) => {
    if (wrongChain) {
      switchChain({ chainId: ARC_TESTNET_ID })
      return
    }
    const parsed = Amount.parse(amountStr, usdcDecimalsFor(ARC_TESTNET_ID))
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, parsed.raw],
      chainId: ARC_TESTNET_ID,
    })
  }

  return {
    send,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    isSwitching,
    wrongChain,
    reset,
    writeError,
  }
}
