import { BitcoinBasedGateway, implement, CurrencyRegistry, GatewayRegistry, getLogger, BigNumber } from 'sota-common';
const logger = getLogger('LtcGateway');

const bitcore = require('litecore-lib');

GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Litecoin, () => new LtcGateway());

export class LtcGateway extends BitcoinBasedGateway {
  public constructor() {
    super(CurrencyRegistry.Litecoin);
  }

  public async getFeeInSatoshisPerByte(): Promise<number> {
    return 15;
  }

  @implement
  public getBitCoreLib(): any {
    return bitcore;
  }

  /**
   * minimum fee for seeding in almost case
   */
  public async getAverageSeedingFee(): Promise<BigNumber> {
    throw new Error(`TODO: Implement me.`);
  }
}

export default LtcGateway;
