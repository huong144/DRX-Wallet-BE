import { BlockHeader, AccountBasedTransaction, IBep20Token, BigNumber, Address } from 'sota-common';
// import * as web3_types from 'web3/types';
import * as eth_types from 'web3/eth/types';
import * as web3_core from 'web3-core';
import { web3 } from './web3';
interface IBEP20TransactionProps {
  readonly fromAddress: Address;
  readonly toAddress: Address;
  readonly amount: BigNumber;
  readonly txid: string;
  readonly originalTx: eth_types.Transaction;
  readonly isFailed: boolean;
}

export class Bep20Transaction extends AccountBasedTransaction {
  public readonly currency: IBep20Token;
  public readonly receiptStatus: boolean;
  public readonly block: BlockHeader;
  public readonly receipt: web3_core.TransactionReceipt;
  public readonly originalTx: eth_types.Transaction;

  constructor(
    currency: IBep20Token,
    tx: IBEP20TransactionProps,
    block: BlockHeader,
    receipt: web3_core.TransactionReceipt,
    lastNetworkBlockNumber: number
  ) {
    if (!web3.utils.isAddress(currency.contractAddress)) {
      throw new Error(`Invalid BEP20 contract address: ${currency.contractAddress}`);
    }

    const txProps = {
      confirmations: lastNetworkBlockNumber - block.number + 1,
      height: block.number,
      timestamp: block.timestamp,
      txid: tx.txid,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      amount: tx.amount,
    };

    super(currency, txProps, block);

    this.receiptStatus = receipt.status;
    this.block = block;
    this.receipt = receipt;
    this.originalTx = tx.originalTx;
    this.isFailed = !this.receiptStatus;
  }

  public getExtraDepositData(): any {
    return Object.assign({}, super.getExtraDepositData(), {
      contractAddress: this.currency.contractAddress,
      tokenSymbol: this.currency.symbol,
      txIndex: this.receipt.transactionIndex,
    });
  }

  public getNetworkFee(): BigNumber {
    const gasUsed = web3.utils.toBN(this.receipt.gasUsed);
    const gasPrice = web3.utils.toBN(this.originalTx.gasPrice);
    return new BigNumber(gasPrice.mul(gasUsed).toString());
  }
}

export default Bep20Transaction;
