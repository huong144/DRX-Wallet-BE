import { BlockHeader } from './BlockHeader';
import { Transaction } from './Transaction';
import { TransferEntry } from './TransferEntry';
import { implement } from '../Utils';
import { IBCHBoiledVIn, IBCHBoiledVOut, IBCHUtxoTxInfo, ICurrency } from '../interfaces';
import BigNumber from 'bignumber.js';
import { throws } from 'assert';

const bchaddr = require('bchaddrjs');

export class UTXOBCHBasedTransaction extends Transaction {
  public readonly inputs: IBCHBoiledVIn[];
  public readonly outputs: IBCHBoiledVOut[];

  constructor(currency: ICurrency, tx: IBCHUtxoTxInfo, block: BlockHeader) {
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
    return 1;
    // return 1e8;
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

    // We want to retreive the positive value
    return result.times(-1);
  }

  /**
   * Transform input to transfer entry
   *
   * @param input
   */
  protected _convertVInToTransferEntry(input: IBCHBoiledVIn): TransferEntry {
    if (!input.address || input.address === 'false') {
      return null;
    }

    return {
      amount: new BigNumber(-input.value * this.getSatoshiFactor()),
      currency: this.currency,
      address: bchaddr.isLegacyAddress(input.address) ? input.address : bchaddr.toLegacyAddress(input.address),
      txid: this.txid,
      tx: this,
    };
  }

  /**
   * Transform output to transfer entry
   */
  protected _convertVOutToTransferEntry(output: IBCHBoiledVOut): TransferEntry {
    // If output is not a coin-transfer, just ignore it
    // We don't care about things other than coin transferring in this project
    if (!output.address || output.address === 'false') {
      return null;
    }

    // TODO: check MULTISIG

    // Otherwise it's just a transfer to normal address
    // Handle for vout with single sig :) or unparsed address
    // case: output.scriptPubKey.addresses has 1 or 0 element
    // normal vout
    return {
      amount: new BigNumber(output.value * this.getSatoshiFactor()),
      currency: this.currency,
      address: bchaddr.isLegacyAddress(output.address) ? output.address : bchaddr.toLegacyAddress(output.address),
      txid: this.txid,
      tx: this,
    };
  }
}
