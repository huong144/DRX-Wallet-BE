import util from 'util';
import { BaseWebServer, BlockchainPlatform, override, getLogger, EnvConfigRegistry } from 'sota-common';
import BscGateway from './BscGateway';

const logger = getLogger('BscWebServer');

export class BscWebServer extends BaseWebServer {
  public constructor() {
    super(BlockchainPlatform.BSC);
  }

  protected async getBEP20TokenInfo(req: any, res: any) {
    const currency = req.params.currency;
    const gateway = (await this.getGateway(this._currency.symbol)) as BscGateway;
    const tokenInfo = await gateway.getBep20TokenInfo(currency);
    const result = Object.assign({}, tokenInfo, { network: EnvConfigRegistry.getNetwork() });
    res.json(result);
  }

  @override
  protected setup() {
    super.setup();

    this.app.get('/api/currency_config/:currency', async (req: any, res: any) => {
      try {
        await this.getBEP20TokenInfo(req, res);
      } catch (e) {
        logger.error(`err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });
  }
}
