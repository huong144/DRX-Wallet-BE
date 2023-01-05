import { NetworkType } from '../enums';
import { IGlobalEnvConfig } from '../interfaces';

const envConfig = new Map<string, string>();
let _appId: string = 'PP70ExC8Hr';
let _globalEnvConfig: IGlobalEnvConfig = {
  network: NetworkType.TestNet,
};
const onNetworkChangedCallbacks: Array<(network: NetworkType) => void> = [];

export class EnvConfigRegistry {
  public static getCustomEnvConfig(key: string): string {
    return envConfig.get(key);
  }

  public static setCustomEnvConfig(key: string, value: string) {
    console.log(`setCustomEnvConfig key=${key}, value=${value}`);
    switch (key) {
      case 'NETWORK':
        if (value !== NetworkType.MainNet && value !== NetworkType.TestNet && value !== NetworkType.PrivateNet) {
          throw new Error(`Trying to set invalid value for network: ${value}`);
        }

        _globalEnvConfig = Object.assign(_globalEnvConfig, { network: value });
        onNetworkChangedCallbacks.forEach(func => func(value as NetworkType));
        break;

      default:
        break;
    }

    return envConfig.set(key, value);
  }

  public static getGlobalEnvConfig(): IGlobalEnvConfig {
    return _globalEnvConfig;
  }

  public static getAppId(): string {
    return _appId;
  }

  public static setAppId(appId: string) {
    _appId = appId;
  }

  public static getNetwork(): NetworkType {
    return _globalEnvConfig.network;
  }

  // Check whether the environment is mainnet
  public static isMainnet(): boolean {
    return EnvConfigRegistry.getNetwork() === NetworkType.MainNet;
  }

  // Check whether the environment is public testnet
  public static isTestnet(): boolean {
    return EnvConfigRegistry.getNetwork() === NetworkType.TestNet;
  }

  // Check whether the environment is private net
  public static isPrivnet(): boolean {
    return EnvConfigRegistry.getNetwork() === NetworkType.PrivateNet;
  }

  public static onNetworkChanged(func: (network: NetworkType) => void) {
    onNetworkChangedCallbacks.push(func);
  }

  public static isUsingRedis(): boolean {
    const redisEnabled = EnvConfigRegistry.getCustomEnvConfig('REDIS_ENABLED');
    if (redisEnabled === 'true') {
      return true;
    }

    return false;
  }
}

export default EnvConfigRegistry;
