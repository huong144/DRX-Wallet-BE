import BigNumber from 'bignumber.js';

/**
 * Simple VIn and VOut are formats that are used in constructing transaction
 */
export interface IRawVIn {
  readonly fromAddress: string;
  readonly amount: BigNumber;
}

export interface IRawVOut {
  readonly toAddress: string;
  readonly amount: BigNumber;
}

export interface IRawVOutAda {
  readonly toAddress: string;
  readonly amount: BigNumber;
  readonly fromWallet: string;
}

/**
 * Boilded VIn and VOut are formats that are returned from APIs of a full node.
 * They're a part of a processed transaction, which has ben recorded on the network already
 * We'll just care and extract the coin transferring portion, other information
 * don't need to be exposed here...
 */
export interface IBoiledVIn {
  readonly chain: string;
  readonly network: string;
  readonly coinbase: boolean;
  readonly mintIndex: number;
  readonly spentTxid: string;
  readonly mintTxid: string;
  readonly mintHeight: number;
  readonly spentHeight: number;
  readonly address: string;
  readonly script: string;
  readonly value: number;
  confirmations: number;
  readonly sequenceNumber: number;
}

export interface IBoiledVOut {
  readonly chain: string;
  readonly network: string;
  readonly coinbase: boolean;
  readonly mintIndex: number;
  readonly spentTxid: string;
  readonly mintTxid: string;
  readonly mintHeight: number;
  readonly spentHeight: number;
  readonly address: string;
  readonly script: string;
  readonly value: number;
  confirmations: number;
  readonly sequenceNumber: number;
}

/**
 * This is usually the response when calling JSON-RPC API `getrawtransaction`
 * Also the response format that is return from APIs
 * + Get tx details information: `/tx/:txid`
 * + Get txs in a block: `/txs?block={blockNumber}&pageNum={pageNumber}`
 * Each format has some own additional fields, but we just pick the common ones to this interface
 */
export interface IUtxoTxInfo {
  readonly txid: string;
  confirmations: number;
  readonly size: number;
  readonly lockTime: number;
  readonly blockHash: string;
  readonly blockTime: number;
  readonly blockTimeNormalized: string;
  readonly value: number;
  readonly blockHeight: number;
  readonly inputCount: number;
  readonly outputCount: number;
  readonly fee: number;
  readonly coinbase: boolean;
  readonly _id: string;
  readonly network: string;

  inputs?: IBoiledVIn[];
  outputs?: IBoiledVOut[];
}

export interface IUtxoTxInfoDetail {
  readonly inputs: IBoiledVIn[];
  readonly outputs: IBoiledVOut[];
}

/**
 * This is usually the response when calling JSON-RPC API `getblock`
 */
export interface IUtxoBlockInfo {
  readonly hash: string;
  readonly confirmations: number;
  readonly size: number;
  readonly height: number;
  readonly version: number;
  readonly versionHex: number;
  readonly merkleroot: string;
  readonly time: number;
  readonly mediantime: number;
  readonly nonce: number;
  readonly bits: string;
  readonly difficulty: number;
  readonly previousblockhash: string;
  readonly nextblockhash?: string;
  readonly tx: string[];
  readonly strippedsize: number;
  readonly chainwork: string;
  readonly weight: number;
}

// Response format that is returned from API `/addr/:addr/?noTxList=1`
export interface IInsightAddressInfo {
  readonly addrStr: string;
  readonly balance: number;
  readonly balanceSat: number;
  readonly totalReceived: number;
  readonly totalReceivedSat: number;
  readonly totalSent: number;
  readonly totalSentSat: number;
  readonly unconfirmedBalance: number;
  readonly unconfirmedBalanceSat: number;
  readonly unconfirmedTxApperances: number;
  readonly txApperances: number;
}

export interface IInsightBalanceInfo {
  readonly confirmed: string;
  readonly balance: number;
  readonly unconfirmed: number;
}

// Response format that is return from API `/address/:addr/?unspent=true`
export interface IInsightUtxoInfo {
  readonly _id: string;
  readonly chain: string;
  readonly network: string;
  readonly coinbase: boolean;
  readonly mintIndex: number;
  readonly spentTxid: string;
  readonly mintTxid: string;
  readonly mintHeight: number;
  readonly spentHeight: number;
  readonly address: string;
  readonly script: string;
  readonly value: number;
  readonly confirmations: number;
}

// Response format that is return from API `/txs?block={blockNumber}&pageNum={pageNumber}`
export interface IInsightTxsInfo {
  pagesTotal: number;
  txs: IUtxoTxInfo[];
}

// Format of utxo that is used by bitcore-lib as inputs of transaction
export interface IBitcoreUtxoInput {
  readonly address: string;
  readonly txId: string;
  readonly vout: number;
  readonly outputIndex: number;
  readonly scriptPubKey: string;
  readonly satoshis: number;
}
