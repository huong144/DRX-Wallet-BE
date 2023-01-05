import {
  BlockHeader,
  AccountBasedTransaction,
  IOmniAsset,
  IUtxoBlockInfo,
  BigNumber,
  UTXOBasedTransaction,
} from 'sota-common';
import { IOmniTxInfo } from './OmniTypes';

export class OmniTransaction extends AccountBasedTransaction {
  public readonly block: BlockHeader;
  private readonly propertyId: number;
  private readonly originalTx: IOmniTxInfo;
  private readonly originalUtxoTx: UTXOBasedTransaction;

  constructor(currency: IOmniAsset, tx: IOmniTxInfo, utxoTx: UTXOBasedTransaction, block: IUtxoBlockInfo) {
    const blockHeader = new BlockHeader({
      hash: block.hash,
      number: block.height,
      timestamp: block.time,
    });

    let amount = tx.amount;

    // Transaction that has Send_All type
    if (tx.type_int === 4 && tx.subsends && tx.subsends.length > 0) {
      const subsend = tx.subsends.find(s => s.propertyid === currency.propertyId);
      if (subsend) {
        amount = subsend.amount;
      }
    }

    if (!amount) {
      throw new Error(`Construct Omni tx with invalid amount tx=${JSON.stringify(tx)}`);
    }

    const txProps = {
      confirmations: tx.confirmations,
      height: block.height,
      timestamp: new Date(block.time).getTime(),
      txid: tx.txid,
      fromAddress: tx.sendingaddress,
      toAddress: tx.referenceaddress,
      amount: new BigNumber(amount),
    };

    super(currency, txProps, blockHeader);

    if (currency.propertyId !== tx.propertyid) {
      throw new Error(`Something went wrong. Property ID does not match: ${currency.propertyId} <> ${tx.propertyid}`);
    }

    this.propertyId = tx.propertyid;
    this.block = blockHeader;
    this.originalTx = tx;
    this.originalUtxoTx = utxoTx;
    this.isFailed = !tx.valid;
  }

  public getNetworkFee(): BigNumber {
    const fee = new BigNumber(this.originalTx.fee).multipliedBy(1e8);
    let additionalFee = new BigNumber(0);
    this.originalUtxoTx.extractOutputEntries().map(output => {
      if (output.address === this.originalTx.referenceaddress) {
        additionalFee = additionalFee.plus(output.amount);
      }
    });

    return fee.plus(additionalFee);
  }

  public getExtraDepositData(): any {
    return Object.assign({}, super.getExtraDepositData(), {
      propertyId: this.propertyId,
    });
  }
}
