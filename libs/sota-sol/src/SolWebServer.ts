import util from 'util';
import { BaseWebServer, BlockchainPlatform, override, getLogger, EnvConfigRegistry } from 'sota-common';
import SolGateway from './SolGateway';
const logger = getLogger('SolWebServer');

export class SolWebServer extends BaseWebServer {
  public constructor() {
    super(BlockchainPlatform.Solana);
  }

  protected async getSplTokenInfo(req: any, res: any) {
    const currency = req.params.currency;
    const gateway = (await this.getGateway(this._currency.symbol)) as SolGateway;
    const tokenInfo = await gateway.getSplTokenInfo(currency);
    const result = Object.assign({}, tokenInfo, { network: EnvConfigRegistry.getNetwork() });
    res.json(result);
  }

  @override
  protected setup() {
    super.setup();

    this.app.get('/api/currency_config/:currency', async (req, res) => {
      try {
        await this.getSplTokenInfo(req, res);
      } catch (e) {
        logger.error(`err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });
  }
}
