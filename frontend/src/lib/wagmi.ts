import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { baseSepolia, arbitrumSepolia, optimismSepolia, mainnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'LIQUIDMIND',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [arbitrumSepolia, baseSepolia, optimismSepolia, mainnet],
  transports: {
    [arbitrumSepolia.id]: http(),
    [baseSepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
});
