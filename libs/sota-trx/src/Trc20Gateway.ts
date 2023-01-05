import TrxGateway from './TrxGateway';
import { tronWeb } from './tronWeb';
import Web3 from 'web3';
import _ from 'lodash';
import {
  IRawTransaction,
  ITrc20Token,
  Account,
  Address,
  BigNumber,
  CurrencyRegistry,
  GatewayRegistry,
  AccountBasedGateway,
  Block,
  ISignedRawTransaction,
  TransactionStatus,
  ISubmittedTransaction,
  getLogger,
  implement,
} from 'sota-common';
import Trc20Transaction from './Trc20Transaction';
import TRC20ABI from '../config/abi/trc20.json';

const logger = getLogger('Trc20Gateway');
const web3 = new Web3();

CurrencyRegistry.onTRC20TokenRegistered((token: ITrc20Token) => {
  logger.info(`Register Trc20Gateway to the registry: ${token.symbol}`);
  GatewayRegistry.registerLazyCreateMethod(token, () => new Trc20Gateway(token));
});

export class Trc20Gateway extends AccountBasedGateway {
  protected _currency: ITrc20Token;
  protected _trxGateway: TrxGateway;

  public constructor(currency: ITrc20Token) {
    super(currency);
    this._trxGateway = GatewayRegistry.getGatewayInstance(CurrencyRegistry.Tron) as TrxGateway;
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    throw new Error('Method not implemented.');
  }

  @implement
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const contract = await tronWeb.contract().at(this._currency.contractAddress);
    const result = await contract.balanceOf(address).call();
    return new BigNumber(result._hex);
  }

  @implement
  public async constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    value: BigNumber
  ): Promise<IRawTransaction> {
    // Check whether the balance of hot wallet is enough to send
    const balance = await this.getAddressBalance(fromAddress);
    if (balance.lt(value)) {
      throw new Error(
        `Trc20Gateway::constructRawTransaction could not construct tx because of insufficient balance: \
          address=${fromAddress}, balance=${balance}, amount=${value}`
      );
    }
    const trxBalance = await this._trxGateway.getAddressBalance(fromAddress);
    const fee = await this._trxGateway.getAverageSeedingFee();
    if (trxBalance.lt(fee)) {
      throw new Error(
        `Could not construct tx because of lacking fee: address=${fromAddress}, fee=${fee}, trxBalance=${trxBalance}`
      );
    }

    const parameter = [{ type: 'address', value: toAddress }, { type: 'uint256', value: value.toFixed() }];
    const options = {
      feeLimit: 100_000_000,
    };
    const result = await tronWeb.transactionBuilder.triggerSmartContract(
      this._currency.contractAddress,
      'transfer(address,uint256)',
      options,
      parameter,
      fromAddress
    );
    if (!result.hasOwnProperty('transaction')) {
      throw Error('Failed to construct raw transaction.');
    }
    // extend expiration time of transaction for 5 minutes
    const extendExpirationTx = await tronWeb.transactionBuilder.extendExpiration(result.transaction, 300);
    if (!extendExpirationTx.hasOwnProperty('txID')) {
      throw Error('Failed to construct raw transaction.');
    }

    return {
      txid: extendExpirationTx.txID,
      unsignedRaw: JSON.stringify(extendExpirationTx),
    };
  }

  // Wrap TRX gateway
  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    return this._trxGateway.signRawTransaction(unsignedRaw, secret);
  }

  // Wrap TRX gateway
  public async sendRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction> {
    return this._trxGateway.sendRawTransaction(signedRawTx);
  }

  public async createAccountAsync(): Promise<Account> {
    return this._trxGateway.createAccountAsync();
  }

  public async getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    return this._trxGateway.getAccountFromPrivateKey(privateKey);
  }

  public async getBlockCount(): Promise<number> {
    return this._trxGateway.getBlockCount();
  }

  public getTransactionStatus(txid: string): Promise<TransactionStatus> {
    return this._trxGateway.getTransactionStatus(txid);
  }

  protected async _getOneTransaction(txid: string): Promise<Trc20Transaction> {
    const tx = await this._trxGateway.getTransactionInfo(txid);
    const [block, receipt, blockHeight] = await Promise.all([
      this.getOneBlock(tx.blockNumber),
      this._trxGateway.getTransaction(txid),
      this.getBlockCount(),
    ]);

    const log = _.find(
      receipt.logs,
      l =>
        l.address.toLowerCase() === this._currency.contractAddress.toLocaleLowerCase() &&
        l.topics[0] &&
        l.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    // Cannot find any transfer log event
    // Just treat the transaction as failed
    if (!log) {
      return null;
    }

    const inputs = _.find(TRC20ABI, abi => abi.type === 'event' && abi.name === 'Transfer').inputs;
    let parsedLog;

    try {
      parsedLog = web3.eth.abi.decodeLog(inputs, log.data, log.topics.slice(1)) as any;
    } catch (e) {
      throw new Error(`Cannot decode log for transaction: ${txid} of contract ${this._currency.contractAddress}`);
    }

    const txProps = {
      amount: new BigNumber(parsedLog.value),
      contractAddress: this._currency.contractAddress,
      fromAddress: parsedLog.from,
      originalTx: tx,
      toAddress: parsedLog.to,
      txid,
      isFailed: false,
    };

    return new Trc20Transaction(this._currency, txProps, block, receipt, blockHeight);
  }

  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    return this._trxGateway.getOneBlock(blockNumber);
  }
}

export default Trc20Gateway;
