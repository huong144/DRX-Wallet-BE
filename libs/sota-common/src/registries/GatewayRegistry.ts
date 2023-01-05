import { getLogger } from '../Logger';
import { ICurrency } from '../interfaces';
import BaseGateway from '../BaseGateway';

const logger = getLogger('GatewayRegistry');
const _factory = new Map<string, () => BaseGateway>();
const _registryData = new Map<string, BaseGateway>();

export class GatewayRegistry {
  public static getGatewayInstance(currency: ICurrency | string): BaseGateway {
    const symbol = typeof currency === 'string' ? currency : currency.symbol;
    if (_registryData.has(symbol)) {
      return _registryData.get(symbol);
    }

    if (_factory.has(symbol)) {
      const factoryCreate = _factory.get(symbol);
      const gateway = factoryCreate();
      GatewayRegistry.registerGateway(currency, gateway);
      return gateway;
    } else {
      return null;
    }
  }

  public static registerLazyCreateMethod(currency: ICurrency | string, func: () => BaseGateway) {
    const symbol = typeof currency === 'string' ? currency : currency.symbol;
    logger.info(`GatewayRegistry::registerLazyCreateMethod currency=${symbol}`);
    _factory.set(symbol, func);
  }

  protected static registerGateway(currency: ICurrency | string, gatewayInstance: BaseGateway) {
    const symbol = typeof currency === 'string' ? currency : currency.symbol;
    if (_registryData.has(symbol)) {
      logger.warn(`GatewayRegistry::registerGateway trying to register gateway multiple times: ${symbol}`);
    } else {
      logger.info(`GatewayRegistry::registerGateway currency=${symbol}`);
    }
    _registryData.set(symbol, gatewayInstance);
  }
}

export default GatewayRegistry;
