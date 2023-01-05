export interface IOmniBalanceInfo {
  balance: string;
  reserved: string;
}

export interface IOmniTxInfo {
  txid: string;
  fee: string;
  sendingaddress: string;
  referenceaddress: string;
  ismine: boolean;
  version: number;
  type_int: number;
  type: string;
  propertyid: number;
  divisible: boolean;
  amount: string;
  valid: boolean;
  blockhash: string;
  blocktime: number;
  positioninblock: number;
  block: number;
  confirmations: number;
  subsends?: [
    {
      propertyid: number;
      divisible: boolean;
      amount: string;
    }
  ];
}

export interface IOmniSignedTxInfo {
  hex: string;
  complete: boolean;
}
