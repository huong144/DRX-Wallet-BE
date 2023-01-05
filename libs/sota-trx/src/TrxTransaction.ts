import { BlockHeader, BigNumber, AccountBasedTransaction, BlockchainPlatform, CurrencyRegistry } from 'sota-common';
import { tronWeb } from './tronWeb';

export class TrxTransaction extends AccountBasedTransaction {
  public readonly fee: BigNumber;
  public readonly data: string;
  public readonly memo: string;

  constructor(block: BlockHeader, lastNetworkBlockNumber: number, fee: BigNumber, tx: any) {
    const currency = CurrencyRegistry.getOneNativeCurrency(BlockchainPlatform.Tron);
    const txParam = tx.raw_data.contract[0].parameter.value;
    const memo = tx.raw_data.data ? Buffer.from(tx.raw_data.data, 'hex').toString() : null;
    const txProps = {
      confirmations: lastNetworkBlockNumber - block.number + 1,
      height: block.number,
      timestamp: block.timestamp,
      txid: tx.txID,
      fromAddress: tronWeb.address.fromHex(txParam.owner_address),
      toAddress: tronWeb.address.fromHex(txParam.to_address),
      amount: new BigNumber(txParam.amount),
    };

    super(currency, txProps, block);
    this.memo = memo;
    this.fee = fee;
    this.isFailed = tx.ret[0].contractRet !== 'SUCCESS';
  }

  public getExtraDepositData(): any {
    return Object.assign({}, super.getExtraDepositData(), {
      data: this.data,
      memo: this.memo,
    });
  }

  public getNetworkFee(): BigNumber {
    return this.fee;
  }

  public extractAdditionalField(): any {
    return {
      data: this.data,
      memo: this.memo,
    };
  }
}

export default TrxTransaction;
