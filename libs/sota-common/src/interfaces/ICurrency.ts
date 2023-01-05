import { Address } from '../types';
import BlockchainPlatform from '../enums/BlockchainPlatform';
import { TokenType } from '../enums';

export interface ICurrency {
  // Currency symbol. It can be primary assets of a platform like btc, eth
  // Or a kind of utility token/asset on that platform
  readonly symbol: string;

  // Symbol on its own network. This property maybe not unique
  readonly networkSymbol: string;

  // Full name of the currency
  readonly name: string;

  // The blockchain platform that currency is based on
  // Maybe there're various currencies on a same platform
  readonly platform: BlockchainPlatform;

  // Account-based or UTXO-based
  readonly isUTXOBased: boolean;

  // Currency is native asset
  readonly isNative: boolean;

  // The factor between ordinary unit that humans are usually working with
  // and the smallest unit that is handle in core platform and APIs
  // For example:
  // - In Bitcoin it's 8: 1 bitcoin = 10^8 satoshi
  // - In Ethereum it's 18: 1 ether = 10^18 wei
  // - In Ripple it's 0: xrp is just used by both humans and APIs
  readonly humanReadableScale: number;

  // Maximum number of digit that is handle natively
  // Notice it's different from humanReadableScale:
  // - In Bitcoin it's 0: native runtime consume satoshi, and satoshi is indivisible
  // - In Ripple it's 6: native runtime consume xrp, and xrp can be divided to 0.000001 (10^-6)
  readonly nativeScale: number;
}

export default ICurrency;

export interface IToken extends ICurrency {
  readonly tokenType: TokenType;
}

export interface IErc20Token extends IToken {
  readonly contractAddress: Address;
  readonly decimals: number;
}

export interface IBep20Token extends IToken {
  readonly contractAddress: Address;
  readonly decimals: number;
}

export interface IErc20TokenTomo extends IToken {
  readonly contractAddress: Address;
  readonly decimals: number;
}

export interface INep5Token extends IToken {
  readonly contractAddress: Address;
  readonly decimals: number;
}

export interface IOmniAsset extends IToken {
  readonly propertyId: number;
}

export interface IEosToken extends IToken {
  readonly code: string;
  readonly networkSymbol: string;
}

export interface ITrc20Token extends IToken {
  readonly contractAddress: Address;
  readonly decimals: number;
}

export interface ISplToken extends IToken {
  readonly programId: string;
  readonly decimals: number;
}
