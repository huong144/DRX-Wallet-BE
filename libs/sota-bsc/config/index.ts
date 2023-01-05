import mainnetConfig from './network/mainnet.json';
import testnetConfig from './network/testnet.json';

export interface IBscConfig {
  averageBlockTime: number;
  requiredConfirmations: number;
  explorerEndpoint: string;
  chainId: number;
}

export const BscConfig: IBscConfig = Object.assign({}, mainnetConfig);

// Beside fallback values, we also can update the configurations at the runtime
export function updateBscConfig(network: string) {
  switch (network) {
    case 'bsc':
      Object.assign(BscConfig, mainnetConfig);
      break;
    case 'testnet':
      Object.assign(BscConfig, testnetConfig);
      break;

    default:
      throw new Error(`Invalid environment variable value: NETWORK=${process.env.NETWORK}`);
  }
}
