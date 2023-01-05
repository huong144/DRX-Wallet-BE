import { BlockHeader } from './BlockHeader';
import { Transaction } from './Transaction';
import { TransferEntry } from './TransferEntry';
import { implement } from '../Utils';
import { IBoiledVIn, IBoiledVOut, IUtxoTxInfo, ICurrency } from '../interfaces';
import BigNumber from 'bignumber.js';

export class UTXOBasedTransaction extends Transaction {
  public readonly inputs: IBoiledVIn[];
  public readonly outputs: IBoiledVOut[];

  constructor(currency: ICurrency, tx: IUtxoTxInfo, block: BlockHeader) {
    // Construct tx props
    const txProps = {
      confirmations: tx.confirmations,
      height: block.number,
      timestamp: new Date(block.timestamp).getTime(),
      txid: tx.txid,
    };

    // Construct base transaction
    super(currency, txProps, block);

    // And vin/vout for utxo-based
    this.inputs = tx.inputs;
    this.outputs = tx.outputs;
  }

  public getSatoshiFactor(): number {
    return 1e8;
  }

  @implement
  public _extractEntries(): TransferEntry[] {
    const entries: TransferEntry[] = [];

    // All in v Ins
    this.inputs.forEach(input => {
      const entry = this._convertVInToTransferEntry(input);
      if (entry) {
        entries.push(entry);
      }
    });

    // All in v Outs
    this.outputs.forEach(output => {
      const entry = this._convertVOutToTransferEntry(output);
      if (entry) {
        entries.push(entry);
      }
    });

    return TransferEntry.mergeEntries(entries);
  }

  /**
   * Network fee is simple total input subtract total output
   */
  public getNetworkFee(): BigNumber {
    let result = new BigNumber(0);
    this.extractEntries().forEach(entry => {
      result = result.plus(entry.amount);
    });

    // We want to retrieve the positive value
    return result.times(-1);
  }

  /**
   * Transform vIn to transfer entry
   *
   * @param vIn
   */
  protected _convertVInToTransferEntry(input: IBoiledVIn): TransferEntry {
    if (!input.address || input.address === 'false') {
      return null;
    }

    return {
      amount: new BigNumber(-input.value), // * this.getSatoshiFactor()),
      currency: this.currency,
      address: input.address,
      txid: this.txid,
      tx: this,
    };
  }

  /**
   * Transform vOut to transfer entry
   */
  protected _convertVOutToTransferEntry(output: IBoiledVOut): TransferEntry {
    if (!output.address || output.address === 'false') {
      return null;
    }

    // Otherwise it's just a transfer to normal address
    // Handle for vout with single sig :) or unparsed address
    // case: vOut.scriptPubKey.addresses has 1 or 0 element
    // normal vout
    return {
      amount: new BigNumber(output.value), // * this.getSatoshiFactor()),
      currency: this.currency,
      address: output.address,
      txid: this.txid,
      tx: this,
    };
  }
}
