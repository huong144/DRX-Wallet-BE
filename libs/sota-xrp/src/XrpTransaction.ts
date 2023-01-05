import { BlockHeader, AccountBasedTransaction, CurrencyRegistry, BigNumber } from 'sota-common';

interface IXrpTransactionData {
  txid: string;
  from: string;
  to: string;
  amount: number;
  blockNumber: number;
  timestamp: number;
  destinationTag: number;
  resultStatus: string;
}

class XrpTransaction extends AccountBasedTransaction {
  public readonly destinationTag: number;
  public readonly resultStatus: string;

  constructor(tx: IXrpTransactionData, block: BlockHeader, lastNetworkBlockNumber: number) {
    const currency = CurrencyRegistry.Ripple;
    const txProps = {
      confirmations: lastNetworkBlockNumber - tx.blockNumber + 1,
      height: tx.blockNumber,
      timestamp: tx.timestamp,
      txid: tx.txid,
      fromAddress: tx.from,
      toAddress: tx.to,
      amount: new BigNumber(tx.amount),
    };

    super(currency, txProps, block);
    this.destinationTag = tx.destinationTag;
    this.resultStatus = tx.resultStatus;
  }

  public getExtraDepositData(): any {
    return Object.assign({}, super.getExtraDepositData(), {
      destinationTag: this.destinationTag,
      resultStatus: this.resultStatus,
    });
  }

  public extractAdditionalField(): any {
    return {
      destinationTag: this.destinationTag,
      resultStatus: this.resultStatus,
    };
  }

  public getNetworkFee(): BigNumber {
    return new BigNumber('0.000012');
  }
}

export default XrpTransaction;
