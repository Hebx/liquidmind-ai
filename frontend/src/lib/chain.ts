import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { COORDINATOR_ABI, HOOK_ABI } from './contracts';

const RPC_URL = process.env.BASE_SEPOLIA_RPC || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || '';
const COORDINATOR_ADDRESS = process.env.NEXT_PUBLIC_COORDINATOR_ADDRESS as `0x${string}` | undefined;
const HOOK_ADDRESS = process.env.NEXT_PUBLIC_HOOK_ADDRESS as `0x${string}` | undefined;

export async function getOverview() {
  if (!RPC_URL || !COORDINATOR_ADDRESS || !HOOK_ADDRESS) {
    return {
      ok: false,
      error: 'Missing RPC or contract addresses',
    } as const;
  }

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const [blockNumber, coordinatorCode, hookCode, agentCount, localHook, hookOwner, hookCoordinator] =
    await Promise.all([
      client.getBlockNumber(),
      client.getBytecode({ address: COORDINATOR_ADDRESS }),
      client.getBytecode({ address: HOOK_ADDRESS }),
      client.readContract({ address: COORDINATOR_ADDRESS, abi: COORDINATOR_ABI, functionName: 'agentCount' }),
      client.readContract({ address: COORDINATOR_ADDRESS, abi: COORDINATOR_ABI, functionName: 'localHook' }),
      client.readContract({ address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'owner' }),
      client.readContract({ address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'agentCoordinator' }),
    ]);

  return {
    ok: true,
    blockNumber: blockNumber.toString(),
    coordinatorDeployed: !!coordinatorCode,
    hookDeployed: !!hookCode,
    agentCount: agentCount.toString(),
    localHook,
    hookOwner,
    hookCoordinator,
    coordinatorAddress: COORDINATOR_ADDRESS,
    hookAddress: HOOK_ADDRESS,
  } as const;
}
