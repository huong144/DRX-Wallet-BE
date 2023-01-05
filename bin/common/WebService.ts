import fs from 'fs';
import path from 'path';
import express from 'express';
import morgan from 'morgan';
import rfs from 'rotating-file-stream';
import * as http from 'http';
import { getLogger, CurrencyRegistry, BlockchainPlatform, TokenType } from 'sota-common';
import { prepareEnvironment, hd } from 'wallet-core';
import util from 'util';
import { getConnection } from 'wallet-core/node_modules/typeorm';
import axios from 'axios';
import { PREFIX_BEP20, PREFIX_ERC20, PREFIX_OMNI, PREFIX_SPL } from '../../libs/wallet-core/src/hd_wallet/Const';
import { getEnvConfig, updateEnvConfig } from 'wallet-core/src/rawdb/envConfig';
import httpProxy from 'http-proxy';

const apiProxy = httpProxy.createProxyServer();
const logger = getLogger('WebService');
const map = new Map<string, string>();
const host = process.env.INTERNAL_HOST_IP;
const port = 9000;
const protocol = 'http';

const logDir = path.resolve(__dirname, '../../.logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// create a rotating write stream
const accessLogStream = rfs('access.log', {
  interval: '1d', // rotate daily
  path: logDir,
});

prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const currencies = CurrencyRegistry.getAllCurrencies();
  currencies.forEach(currency => {
    if (currency.isNative) {
      try {
        const config = CurrencyRegistry.getCurrencyConfig(currency);
        map.set(currency.symbol, config.internalEndpoint);
      } catch (e) {
        logger.info(e);
      }
    }
  });
  const worker = new WebService();
  worker.start();
}

function defaultHandleProxyError(res: express.Response, serviceName: string, err: Error, req: http.IncomingMessage) {
  if (err) {
    logger.error(`Proxy request failed. Original url=[${req.method} ${req.url}] err=[${err.message}]`);
    res.status(500).json({ error: `Cannot call ${serviceName} service` });
    return;
  }
}
export class WebService {
  protected app: express.Express = express();
  constructor() {
    this.app.use(morgan('combined'));
    this.app.use(morgan('combined', { stream: accessLogStream }));
    this.setup();
  }
  public start() {
    this.app.listen(port, host, () => {
      console.log(`server started at ${protocol}://${host}:${port}`);
    });
  }
  public async settingMailer(req: any, res: any) {
    const mailerReceive = req.body.mailerReceiver;
    await getConnection().transaction(async manager => {
      await hd.saveMailerReceive(mailerReceive, manager);
    });

    return res.json('ok');
  }

  public async getAllCurrenciesWallet(): Promise<string[]> {
    return await hd.getAllCurrenciesWallet();
  }

  public async getSettingThreshold(req: any, res: any) {
    const list = await hd.getSettingThreshold();
    return res.json(list);
  }

  protected setup() {
    this.app.use((req: any, res: any, next: any) => {
      const authToken = req.headers['x-api-key'];
      if (authToken === process.env.API_KEY) {
        next();
      } else {
        res.status(401).json('Unauthorized');
      }
    });
    // this.app.get('/api/reset_cold_wallet_setting/:currency', async (req: any, res: any) => {
    //   apiProxy.web(req: any, res: any, { target: map.get(BlockchainPlatform.Ethereum) });
    // });
    this.app.post('/api/setting_mailer', express.json(), async (req: any, res: any) => {
      apiProxy.web(req, res, { target: map.get(BlockchainPlatform.Bitcoin) });
    });
    this.app.get('/api/get_seed', async (req: any, res: any) => {
      apiProxy.web(req, res, { target: map.get(BlockchainPlatform.Bitcoin) });
    });
    this.app.get('/api/setting_threshold', async (req: any, res: any) => {
      try {
        await this.getSettingThreshold(req, res);
      } catch (e) {
        logger.error(`get threshold err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });

    this.app.all('/api/btc/*', (req: any, res: any) => {
      const platform = BlockchainPlatform.Bitcoin;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/usdt/*', (req: any, res: any) => {
      const platform = BlockchainPlatform.Bitcoin;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/eth/*', (req: any, res: any) => {
      const platform = BlockchainPlatform.Ethereum;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/erc20*', (req: any, res: any) => {
      const platform = BlockchainPlatform.Ethereum;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/currency_config/:currency', (req: any, res: any) => {
      const currency = req.params.currency;
      let platform;
      if (currency.startsWith(PREFIX_ERC20)) {
        platform = BlockchainPlatform.Ethereum;
      } else if (currency.startsWith(PREFIX_BEP20)) {
        platform = BlockchainPlatform.BSC;
      } else if (currency.startsWith(PREFIX_SPL)) {
        platform = BlockchainPlatform.Solana;
      } else {
        const err = 'Invalid currency';
        logger.error(err);
        res.status(500).json({ error: err });
      }
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/ltc/*', (req: any, res: any) => {
      const platform = BlockchainPlatform.Litecoin;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/xrp/*', (req: any, res: any) => {
      const platform = BlockchainPlatform.Ripple;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/trx/*', (req, res) => {
      const platform = BlockchainPlatform.Tron;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/bnb/*', (req: any, res: any) => {
      const platform = BlockchainPlatform.BSC;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/bep20*', (req: any, res: any) => {
      const platform = BlockchainPlatform.BSC;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/matic/*', (req, res) => {
      const platform = BlockchainPlatform.Polygon;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.all('/api/sol/*', (req, res) => {
      const platform = BlockchainPlatform.Solana;
      const target = map.get(platform);
      apiProxy.web(req, res, { target }, defaultHandleProxyError.bind(null, res, platform));
    });

    this.app.get('/api/all/statistical_hotwallet', async (req: any, res: any) => {
      const allCurrencies = await this.getAllCurrenciesWallet();
      const responses: any = {};
      await Promise.all(
        allCurrencies.map(async currency => {
          let _host = map.get(currency);
          if (currency.startsWith(PREFIX_ERC20)) {
            _host = map.get(BlockchainPlatform.Ethereum);
          } else if (currency.startsWith(PREFIX_BEP20)) {
            _host = map.get(BlockchainPlatform.BSC);
          } else if (currency.startsWith(PREFIX_OMNI)) {
            _host = map.get(BlockchainPlatform.Bitcoin);
          } else if (currency.startsWith(PREFIX_SPL)) {
            _host = map.get(BlockchainPlatform.Solana);
          }

          const url = `${_host}/api/${currency}/statistical_hotwallet`;
          try {
            return (responses[currency] = (await axios.get(url)).data);
          } catch (e) {
            let errorMsg = `Could not get statistical hotwallet data url=${url} error=${e.toString()}`;
            if (e.response) {
              errorMsg += ` status=${e.response.status} response=${JSON.stringify(e.response.data)}`;
            } else if (e.request) {
              errorMsg += ` no response was received`;
            }

            logger.error(errorMsg);
            return (responses[currency] = null);
          }
        })
      );

      return res.json(responses);
    });
    this.app.get('/api/env-config', async (req: any, res: any) => {
      try {
        await getEnvConfig(req, res);
      } catch (error) {
        logger.error(`list env config err=${util.inspect(error)}`);
        res.status(500).json({ error: error.message || error.toString() });
      }
    });
    this.app.put('/api/env-config', express.json(), async (req: any, res: any) => {
      try {
        await updateEnvConfig(req, res);
      } catch (error) {
        logger.error(`update env config err=${util.inspect(error)}`);
        res.status(500).json({ error: error.message || error.toString() });
      }
    });
  }
}
