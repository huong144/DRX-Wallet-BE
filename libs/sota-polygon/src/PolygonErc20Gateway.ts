import { keccak256 } from 'ethereum-cryptography/keccak';
import {
  Address,
  BigNumber,
  CurrencyRegistry,
  EnvConfigRegistry,
  GatewayRegistry,
  getLogger,
  IErc20Token,
  IRawTransaction,
  AccountBasedGateway,
  ISignedRawTransaction,
  ISubmittedTransaction,
  TransactionStatus,
  implement,
  Account,
  Block,
} from 'sota-common';
import { PolygonGateway } from './PolygonGateway';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { web3 } from './web3';
import { inspect } from 'util';
import { Common, CustomChain } from '@ethereumjs/common';
import Contract from 'web3/eth/contract';
import PolygonTransaction from './PolygonTransaction';
import PolygonErc20Transaction from './PolygonErc20Transaction';
import ERC20ABI from '../config/abi/erc20.json';
import _ from 'lodash';
const logger = getLogger('PolygonErc20Gateway');
const maxPriorityFeePerGas = 2000000000;
CurrencyRegistry.onPolygonERC20TokenRegistered(token => {
  logger.info(`Register PolygonErc20Gateway to registry: ${token.symbol}`);
  GatewayRegistry.registerLazyCreateMethod(token, () => new PolygonErc20Gateway(token));
});

export class PolygonErc20Gateway extends AccountBasedGateway {
  protected _polygonGateway: PolygonGateway;
  protected _contract: Contract;
  protected _currency: IErc20Token;
  // tslint:disable-next-line:member-access
  private readonly commonOpts: Common;
  constructor(currency: IErc20Token) {
    super(currency);
    this._polygonGateway = GatewayRegistry.getGatewayInstance(CurrencyRegistry.Polygon) as PolygonGateway;
    this.commonOpts = Common.custom(
      EnvConfigRegistry.getCustomEnvConfig('NETWORK') !== 'testnet'
        ? CustomChain.PolygonMainnet
        : CustomChain.PolygonMumbai
    );
  }
  @implement
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const balance = await this._contract.methods.balanceOf(address).call();
    return new BigNumber(balance.toString());
  }
  public async constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    value: BigNumber,
    options: {
      useLowerNetworkFee?: boolean;
      explicitGasPrice?: number;
      explicitGasLimit?: number;
    }
  ): Promise<IRawTransaction> {
    const amount = web3.utils.toBN(value.toFixed());
    const nonce = await web3.eth.getTransactionCount(fromAddress);
    const maxFeePerGas = web3.utils.toBN(await this._polygonGateway.getMaxFeePerGas(options.useLowerNetworkFee));

    let _gasLimit: number;
    if (options.explicitGasLimit) {
      _gasLimit = options.explicitGasLimit;
    } else {
      // The error can be thrown while gas is being estimated
      try {
        _gasLimit = await this._contract.methods
          .transfer(toAddress, amount.toString())
          .estimateGas({ from: fromAddress });
      } catch (e) {
        logger.error(
          `PolygonERC20Gateway::constructRawTransaction cannot estimate gas for transfer method error=${inspect(e)}`
        );
        throw new Error(
          `PolygonERC20Gateway::constructRawTransaction cannot estimate gas for transfer method, error=${e.toString()}`
        );
      }

      // Fix maximum gas limit is 150,000 to prevent draining attack
      if (_gasLimit > 150000) {
        _gasLimit = 150000;
      }
    }

    const gasLimit = web3.utils.toBN(_gasLimit);
    const fee = gasLimit.mul(maxFeePerGas);

    // Check whether the balance of hot wallet is enough to send
    const ethBalance = web3.utils.toBN((await web3.eth.getBalance(fromAddress)).toString());
    const balance = web3.utils.toBN(await (await this.getAddressBalance(fromAddress)).toFixed());
    if (balance.lt(amount)) {
      throw new Error(
        `PolygonERC20Gateway::constructRawTransaction Could not construct tx because of insufficient balance: address=${fromAddress}, amount=${amount}, fee=${fee}`
      );
    }

    if (ethBalance.lt(fee)) {
      throw new Error(
        `PolygonERC20Gateway::constructRawTransaction Could not construct tx because of lacking fee: address=${fromAddress}, fee=${fee}, ethBalance=${ethBalance}`
      );
    }

    const txParams = {
      chainId: web3.utils.toHex(this._polygonGateway.getChainId()),
      data: this._contract.methods.transfer(toAddress, amount.toString()).encodeABI(),
      gasLimit: web3.utils.toHex(gasLimit),
      maxPriorityFeePerGas: web3.utils.toHex(maxPriorityFeePerGas),
      maxFeePerGas: web3.utils.toHex(maxFeePerGas),
      nonce: web3.utils.toHex(nonce),
      to: this._currency.contractAddress,
      value: web3.utils.toHex(0),
      type: '0x02',
    };
    const common = this._polygonGateway.checkChainId();
    const tx = FeeMarketEIP1559Transaction.fromTxData(txParams, { common });
    const unsignedTx = tx.getMessageToSign(false);
    return {
      txid: `0x${Buffer.from(keccak256(tx.serialize())).toString('hex')}`,
      unsignedRaw: unsignedTx.toString('hex'),
    };
  }
  // Wrap ETH gateway
  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    return this._polygonGateway.signRawTransaction(unsignedRaw, secret);
  }
  // Wrap ETH gateway
  public async sendRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction> {
    return this._polygonGateway.sendRawTransaction(signedRawTx);
  }

  public getTransactionStatus(txid: string): Promise<TransactionStatus> {
    return this._polygonGateway.getTransactionStatus(txid);
  }

  public async getBlockCount(): Promise<number> {
    return this._polygonGateway.getBlockCount();
  }
  public async getAverageSeedingFee(): Promise<BigNumber> {
    throw new Error('Method not implemented.');
  }
  public async getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    return this._polygonGateway.getAccountFromPrivateKey(privateKey);
  }
  public async createAccountAsync(): Promise<Account> {
    return this._polygonGateway.createAccountAsync();
  }
  public async _getOneTransaction(txid: string): Promise<PolygonTransaction> {
    const tx = await this._polygonGateway.getRawTransaction(txid);
    const [block, receipt, blockHeight] = await Promise.all([
      this.getOneBlock(tx.blockNumber),
      this._polygonGateway.getRawTransactionReceipt(txid),
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
    const inputs = _.find(ERC20ABI, abi => abi.type === 'event' && abi.name === 'Transfer').inputs;
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
    return new PolygonErc20Transaction(this._currency, txProps, block, receipt, blockHeight);
  }
  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    return this._polygonGateway.getOneBlock(blockNumber);
  }
}
