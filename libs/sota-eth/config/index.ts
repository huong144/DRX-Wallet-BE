import mainnetConfig from './network/mainnet.json';
import rinkebyConfig from './network/rinkeby.json';

export interface IEthConfig {
  averageBlockTime: number;
  requiredConfirmations: number;
  explorerEndpoint: string;
  chainId: number;
}

export const EthConfig: IEthConfig = Object.assign({}, mainnetConfig);

// Beside fallback values, we also can update the configurations at the runtime
export function updateEthConfig(network: string) {
  switch (network) {
    case 'mainnet':
      Object.assign(EthConfig, mainnetConfig);
      break;
    case 'rinkeby':
      Object.assign(EthConfig, rinkebyConfig);
      break;

    default:
      throw new Error(`Invalid environment variable value: NETWORK=${process.env.NETWORK}`);
  }
}
