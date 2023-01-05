import EthGateway from './EthGateway';
import { web3 } from './web3';
import _ from 'lodash';
import { keccak256 } from 'ethereum-cryptography/keccak';
import { AbiItem } from 'web3-utils';
import { Common, Hardfork } from '@ethereumjs/common';
import { Contract } from 'web3-eth-contract';
import {
  IRawTransaction,
  IErc20Token,
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
import Erc20Transaction from './Erc20Transaction';
import ERC20ABI from '../config/abi/erc20.json';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
const logger = getLogger('Erc20Gateway');

CurrencyRegistry.onERC20TokenRegistered((token: IErc20Token) => {
  logger.info(`Register Erc20Gateway to the registry: ${token.symbol}`);
  GatewayRegistry.registerLazyCreateMethod(token, () => new Erc20Gateway(token));
});
const maxPriorityFeePerGas = 2000000000; // 2 gwei
export class Erc20Gateway extends AccountBasedGateway {
  protected _contract: Contract;
  protected _currency: IErc20Token;
  protected _ethGateway: EthGateway;

  public constructor(currency: IErc20Token) {
    super(currency);
    this._contract = new web3.eth.Contract(ERC20ABI as AbiItem[], currency.contractAddress);
    this._ethGateway = GatewayRegistry.getGatewayInstance(CurrencyRegistry.Ethereum) as EthGateway;
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    throw new Error('Method not implemented.');
  }

  @implement
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const balance = await this._contract.methods.balanceOf(address).call();
    return new BigNumber(balance.toString());
  }

  @implement
  public async constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    value: BigNumber,
    options: {
      useLowerNetworkFee?: boolean;
    }
  ): Promise<IRawTransaction> {
    const amount = web3.utils.toBN(value.toFixed());
    const nonce = await web3.eth.getTransactionCount(fromAddress);
    const maxFeePerGas = web3.utils.toBN(await this._ethGateway.getMaxFeePerGas(options.useLowerNetworkFee));
    let _gasLimit = await this._contract.methods
      .transfer(toAddress, amount.toString())
      .estimateGas({ from: fromAddress });

    // Fix maximum gas limit is 150,000 to prevent draining attack
    if (_gasLimit > 150000) {
      _gasLimit = 150000;
    }

    const gasLimit = web3.utils.toBN(_gasLimit);
    const fee = gasLimit.mul(maxFeePerGas);
    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    // Check whether the balance of hot wallet is enough to send
    const ethBalance = web3.utils.toBN((await web3.eth.getBalance(fromAddress)).toString());
    const balance = web3.utils.toBN((await this.getAddressBalance(fromAddress)).toFixed());
    if (balance.lt(amount)) {
      throw new Error(
        `Could not construct tx because of insufficient balance: address=${fromAddress}, amount=${amount}, fee=${fee}`
      );
    }

    if (ethBalance.lt(fee)) {
      throw new Error(
        `Could not construct tx because of lacking fee: address=${fromAddress}, fee=${fee}, ethBalance=${ethBalance}`
      );
    }
    const common = new Common({ chain: Number(config.chainId), hardfork: Hardfork.London });
    const txData = {
      chainId: web3.utils.toHex(this._ethGateway.getChainId()),
      data: this._contract.methods.transfer(toAddress, amount.toString()).encodeABI(),
      gasLimit: web3.utils.toHex(gasLimit),
      maxPriorityFeePerGas: web3.utils.toHex(maxPriorityFeePerGas),
      maxFeePerGas: web3.utils.toHex(maxFeePerGas),
      nonce: web3.utils.toHex(nonce),
      to: this._currency.contractAddress,
      value: web3.utils.toHex(0),
      type: '0x02',
    };
    const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common });
    const unsignedTx = tx.getMessageToSign(false);
    return {
      txid: `0x${Buffer.from(keccak256(tx.serialize())).toString('hex')}`,
      unsignedRaw: unsignedTx.toString('hex'),
    };
  }

  // Wrap ETH gateway
  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    return this._ethGateway.signRawTransaction(unsignedRaw, secret);
  }

  // Wrap ETH gateway
  public async sendRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction> {
    return this._ethGateway.sendRawTransaction(signedRawTx);
  }

  public async createAccountAsync(): Promise<Account> {
    return this._ethGateway.createAccountAsync();
  }

  public async getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    return this._ethGateway.getAccountFromPrivateKey(privateKey);
  }

  public async getBlockCount(): Promise<number> {
    return this._ethGateway.getBlockCount();
  }

  public getTransactionStatus(txid: string): Promise<TransactionStatus> {
    return this._ethGateway.getTransactionStatus(txid);
  }

  protected async _getOneTransaction(txid: string): Promise<Erc20Transaction> {
    const tx = await this._ethGateway.getRawTransaction(txid);
    const [block, receipt, blockHeight] = await Promise.all([
      this.getOneBlock(tx.blockNumber),
      this._ethGateway.getRawTransactionReceipt(txid),
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

    return new Erc20Transaction(this._currency, txProps, block, receipt, blockHeight);
  }

  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    return this._ethGateway.getOneBlock(blockNumber);
  }
}

export default Erc20Gateway;
