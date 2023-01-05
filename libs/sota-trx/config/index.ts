import mainnetConfig from './network/mainnet.json';
import testnetConfig from './network/testnet.json';

export interface ITrxConfig {
  averageBlockTime: number;
  requiredConfirmations: number;
  explorerEndpoint: string;
  chainId: number;
}

export const TrxConfig: ITrxConfig = Object.assign({}, mainnetConfig);

// Beside fallback values, we also can update the configurations at the runtime
export function updateTrxConfig(network: string) {
  switch (network) {
    case 'Mainnet':
      Object.assign(TrxConfig, mainnetConfig);
      break;
    case 'Shasta':
      Object.assign(TrxConfig, testnetConfig);
      break;

    default:
      throw new Error(`Invalid environment variable value: NETWORK=${process.env.NETWORK}`);
  }
}
