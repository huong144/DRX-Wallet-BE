import { LtcWebServer } from 'sota-ltc';
import util from 'util';
import { getLogger } from 'sota-common';
import * as bodyParser from 'body-parser';
import { prepareEnvironment, hd } from 'wallet-core';
import { getConnection } from 'wallet-core/node_modules/typeorm';

const logger = getLogger('LtcWebService');

prepareEnvironment()
  .then(start)
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

function start(): void {
  const worker = new DRLtcWebServer();
  worker.start();
}

class DRLtcWebServer extends LtcWebServer {
  /**
   * createAddress
   */

  public async createNewAddress(req: any, res: any) {
    const amount = req.body.amount || 1;
    const coin: string = req.params.currency.toString();
    if (coin !== 'ltc') {
      return res.status(400).json({ error: 'Incorrect currency!' });
    }
    try {
      await getConnection().transaction(async manager => {
        const addresses = await hd.createAddresses(coin, amount, manager);
        if (!addresses.length) {
          return res.status(400).json({ error: 'Do not have HD wallet for this currency' });
        }
        res.json(addresses);
      });
    } catch (e) {
      return res.status(500).json({ error: e.toString() });
    }
  }

  public async approveTransaction(req: any, res: any) {
    const toAddress: string = req.body.toAddress;
    const amount: number = req.body.amount;
    const coin: string = req.params.currency.toString();
    if (coin !== 'ltc') {
      return res.status(400).json({ error: 'Incorrect currency!' });
    }
    try {
      await getConnection().transaction(async manager => {
        const response = await hd.approveTransaction(manager, coin, toAddress, amount);
        if (!response) {
          res.status(500).json({ error: 'Fail!' });
        }
        return res.json({ id: response });
      });
    } catch (e) {
      res.status(400).json({ error: e.toString() });
    }
  }

  public async settingThreshold(req: any, res: any) {
    const upperThreshold = req.body.upperThreshold;
    const lowerThreshold = req.body.lowerThreshold;
    const address = req.body.address;
    const currency = req.params.currency;
    await getConnection().transaction(async manager => {
      await hd.saveThreshold(currency, address, upperThreshold, lowerThreshold, manager);
    });
    return res.json('ok');
  }

  // public async getSettingThreshold(req: any, res: any) {
  //   const list = await hd.getSettingThreshold();
  //   return res.json(list);
  // }

  public async getStatistical(req: any, res: any) {
    const coin: string = req.params.currency.toString();
    const list = await hd.statisticalHotWallet(coin);
    return res.json(list);
  }

  protected setup() {
    super.setup();
    this.app.use(bodyParser.json());
    // api create addresses
    this.app.post('/api/:currency/address', async (req: any, res: any) => {
      try {
        await this.createNewAddress(req, res);
      } catch (e) {
        logger.error(`createNewAddress err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });
    // api insert db to pick
    this.app.post('/api/:currency/withdrawal/approve', async (req: any, res: any) => {
      try {
        await this.approveTransaction(req, res);
      } catch (e) {
        logger.error(`approve err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });
    this.app.post('/api/:currency/setting_threshold', async (req: any, res: any) => {
      try {
        await this.settingThreshold(req, res);
      } catch (e) {
        logger.error(`setting threshold err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });
    // this.app.get('/api/setting_threshold', async (req: any, res: any) => {
    //   try {
    //     await this.getSettingThreshold(req, res);
    //   } catch (e) {
    //     logger.error(`approve err=${util.inspect(e)}`);
    //     res.status(500).json({ error: e.message || e.toString() });
    //   }
    // });
    this.app.get('/api/:currency/statistical_hotwallet', async (req: any, res: any) => {
      try {
        await this.getStatistical(req, res);
      } catch (e) {
        logger.error(`statistical_hotwallet err=${util.inspect(e)}`);
        res.status(500).json({ error: e.message || e.toString() });
      }
    });
    // api health check
    this.app.get('/api/:currency/health-check', (req: any, res: any) => {
      try {
        res.status(200).json({ status: 'ok' });
      } catch (error) {
        logger.error(`health check err=${util.inspect(error)}`);
        res.status(500).json({ error: error.message || error.toString() });
      }
    });
  }
}
