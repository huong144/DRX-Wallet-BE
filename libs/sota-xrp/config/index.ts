import mainnetConfig from './network/mainnet.json';
import testnetConfig from './network/testnet.json';

interface INetworkConfig {
  averageBlockTime: number;
  requiredConfirmation: number;
}

let xrpNetworkConfig: INetworkConfig;

// Beside fallback values, we also can update the configurations at the runtime
export function updateXrpConfig(network: string) {
  switch (network) {
    case 'mainnet':
      xrpNetworkConfig = mainnetConfig;
      break;
    case 'rinkeby':
      xrpNetworkConfig = testnetConfig;
      break;

    default:
      throw new Error(`Invalid environment variable value: NETWORK=${process.env.NETWORK}`);
  }
}

export { xrpNetworkConfig };
