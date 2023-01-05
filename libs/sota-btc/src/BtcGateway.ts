import {
  BitcoinBasedGateway,
  override,
  implement,
  CurrencyRegistry,
  GatewayRegistry,
  getLogger,
  BigNumber,
} from 'sota-common';
import axios from 'sota-common/node_modules/axios';
const logger = getLogger('BtcGateway');
const getFeeRestEndpoint = 'https://bitcoinfees.earn.com';
const bitcore = require('bitcore-lib');
const maxFeeInSatoshisPerByte = 60;
GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Bitcoin, () => new BtcGateway());

export class BtcGateway extends BitcoinBasedGateway {
  public constructor() {
    super(CurrencyRegistry.Bitcoin);
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    return new BigNumber(50000); // TBD: make it configurable
  }

  @implement
  public getBitCoreLib(): any {
    return bitcore;
  }

  @override
  public async getFeeInSatoshisPerByte(): Promise<number> {
    try {
      const res = await axios.get(`${getFeeRestEndpoint}/api/v1/fees/recommended`);
      return res.data.fastestFee > maxFeeInSatoshisPerByte ? maxFeeInSatoshisPerByte : res.data.fastestFee;
    } catch (e) {
      return await super.getFeeInSatoshisPerByte();
    }
  }
}

export default BtcGateway;
