import express from 'express';
import morgan from 'morgan';
import util from 'util';
import BaseGateway from './BaseGateway';
import * as URL from 'url';
import { BlockchainPlatform } from './enums';
import { getLogger } from './Logger';
import { ICurrency } from './interfaces';
import { CurrencyRegistry, GatewayRegistry } from './registries';

const logger = getLogger('BaseWebServer');

export abstract class BaseWebServer {
  public readonly protocol: string;
  public readonly host: string;
  public readonly port: number;
  protected app: express.Express = express();
  protected readonly _currency: ICurrency;

  public constructor(platform: BlockchainPlatform) {
    this._currency = CurrencyRegistry.getOneNativeCurrency(platform);
    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    if (!config) {
      throw new Error(`Cannot find configuration for ${this._currency.symbol} at config table`);
    }

    const internalEndpoint = URL.parse(`${config.internalEndpoint}`);
    if (!internalEndpoint.protocol || !internalEndpoint.hostname || !internalEndpoint.port) {
      logger.info(`Set api endpoint: ${config.internalEndpoint}. Need corrected format: {host}:{port}`);
      throw new Error(`Api endpoint for ${this._currency.symbol} have incorrect format`);
    }

    this.protocol = internalEndpoint.protocol;
    this.host = internalEndpoint.hostname;
    this.port = parseInt(internalEndpoint.port, 10);
    this.setup();
  }

  public start() {
    this.app.listen(this.port, this.host, () => {
      console.log(`server started at ${this.protocol}://${this.host}:${this.port}`);
    });
  }

  public getGateway(symbol: string): BaseGateway {
    const currency = CurrencyRegistry.getOneCurrency(symbol);
    return GatewayRegistry.getGatewayInstance(currency);
  }

  protected async createNewAddress(req: any, res: any) {
    const address = await this.getGateway(this._currency.symbol).createAccountAsync();
    res.json(address);
  }

  protected async getAddressBalance(req: any, res: any) {
    const { currency, address } = req.params;
    const balance = (await this.getGateway(currency).getAddressBalance(address)).toFixed();
    res.json({ balance });
  }

  protected async validateAddress(req: any, res: any) {
    const { address } = req.params;
    const isValid = await this.getGateway(this._currency.symbol).isValidAddressAsync(address, this._currency.symbol);
    res.json({ isValid });
  }

  protected async isNeedTag(req: any, res: any) {
    const { address } = req.params;
    const isNeed = await this.getGateway(this._currency.symbol).isNeedTagAsync(address);
    res.json({ isNeed });
  }

  protected async getTransactionDetails(req: any, res: any) {
    const { currency, txid } = req.params;
    // TODO: Update check txid
    const tx = await this.getGateway(currency).getOneTransaction(txid);
    if (!tx) {
      return res.status(404).json({ error: `Transaction not found: ${txid}` });
    }

    const entries: any[] = [];
    const extractedEntries = tx.extractEntries();
    extractedEntries.forEach(e => {
      entries.push({
        address: e.address,
        value: e.amount.toFixed(),
        valueString: e.amount.toFixed(),
      });
    });

    let resObj = {
      id: txid,
      date: '',
      timestamp: tx.block.timestamp,
      blockHash: tx.block.hash,
      blockHeight: tx.block.number,
      confirmations: tx.confirmations,
      entries,
    };

    resObj = { ...resObj, ...tx.extractAdditionalField() };
    return res.json(resObj);
  }

  protected async normalizeAddress(req: any, res: any) {
    const { address } = req.params;
    const normalizedAddr = await this.getGateway(this._currency.symbol).normalizeAddress(address);
    logger.info(`WebService::normalizeAddress address=${address} result=${normalizedAddr}`);
    return res.json(normalizedAddr);
  }

  protected setup() {
    this.app.use(morgan('dev'));

    this.app.get('/api/:currency/address', async (req: any, res: any) => {
      try {
        await this.createNewAddress(req, res);
      } catch (e) {
        logger.error(`createNewAddress err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });

    this.app.get('/api/:currency/address/:address/balance', async (req: any, res: any) => {
      try {
        await this.getAddressBalance(req, res);
      } catch (e) {
        logger.error(`getAddressBalance err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });

    this.app.get('/api/:currency/address/:address/validate', async (req: any, res: any) => {
      try {
        await this.validateAddress(req, res);
      } catch (e) {
        logger.error(`validateAddress err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });

    this.app.get('/api/:currency/address/:address/tag', async (req: any, res: any) => {
      try {
        await this.isNeedTag(req, res);
      } catch (e) {
        logger.error(`validateAddress err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });

    this.app.get('/api/:currency/tx/:txid', async (req: any, res: any) => {
      try {
        await this.getTransactionDetails(req, res);
      } catch (e) {
        logger.error(`getTransactionDetails err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });

    this.app.get('/api/:currency/address/:address/normalized', async (req: any, res: any) => {
      try {
        await this.normalizeAddress(req, res);
      } catch (e) {
        logger.error(`convertChecksumAddress err=${util.inspect(e)}`);
        res.status(500).json({ error: e.toString() });
      }
    });
  }
}
