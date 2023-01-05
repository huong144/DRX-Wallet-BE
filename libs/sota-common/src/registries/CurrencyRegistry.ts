import { getLogger } from '../Logger';
import { ICurrency, IEosToken, IErc20TokenTomo } from '../interfaces/ICurrency';
import { ICurrencyConfig, IOmniAsset, IErc20Token, ISplToken } from '../interfaces';
import { BlockchainPlatform, TokenType } from '../enums';

/**
 * Environment data is usually loaded from database at runtime
 * These are some pre-defined types of data
 * Is there any case we need to defined it as generic?
 */
const logger = getLogger('CurrencyRegistry');
const allCurrencies = new Map<string, ICurrency>();
const allCurrencyConfigs = new Map<string, ICurrencyConfig>();
const allErc20Tokens: IErc20Token[] = [];
const allBep20Tokens: IErc20Token[] = [];
const allTrc20Tokens: IErc20TokenTomo[] = [];
const allOmniAssets: IOmniAsset[] = [];
const allEosTokens: IEosToken[] = [];
const allPolygonErc20Tokens: IErc20Token[] = [];
const allSplTokens: ISplToken[] = [];

const onCurrencyRegisteredCallbacks: Array<(currency: ICurrency) => void> = [];
const onSpecificCurrencyRegisteredCallbacks = new Map<string, Array<() => void>>();
const onCurrencyConfigSetCallbacks: Array<(currency: ICurrency, config: ICurrencyConfig) => void> = [];

const eventCallbacks = {
  'erc20-registered': Array<(token: IErc20Token) => void>(),
  'bep20-registered': Array<(token: IErc20Token) => void>(),
  'trc20-registered': Array<(token: IErc20TokenTomo) => void>(),
  'omni-registered': Array<(asset: IOmniAsset) => void>(),
  'eos-token-registered': Array<(asset: IEosToken) => void>(),
  'polygon-erc20-token-registered': Array<(asset: IErc20Token) => void>(),
  'spl-token-registered': Array<(asset: ISplToken) => void>(),
};

/**
 * Built-in currencies
 */
const Bitcoin = {
  symbol: BlockchainPlatform.Bitcoin,
  networkSymbol: BlockchainPlatform.Bitcoin,
  name: 'Bitcoin',
  platform: BlockchainPlatform.Bitcoin,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 8,
  nativeScale: 0,
};

const Ethereum = {
  symbol: BlockchainPlatform.Ethereum,
  networkSymbol: BlockchainPlatform.Ethereum,
  name: 'Ethereum',
  platform: BlockchainPlatform.Ethereum,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 18,
  nativeScale: 0,
};

const BSC = {
  symbol: BlockchainPlatform.BSC,
  networkSymbol: BlockchainPlatform.BSC,
  name: 'BSC',
  platform: BlockchainPlatform.BSC,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 18,
  nativeScale: 0,
};

const Cardano = {
  symbol: BlockchainPlatform.Cardano,
  networkSymbol: BlockchainPlatform.Cardano,
  name: 'Cardano',
  platform: BlockchainPlatform.Cardano,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 6,
  nativeScale: 0,
};

const BitcoinCash = {
  symbol: BlockchainPlatform.BitcoinCash,
  networkSymbol: BlockchainPlatform.BitcoinCash,
  name: 'BitcoinCash',
  platform: BlockchainPlatform.BitcoinCash,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 8,
  nativeScale: 0,
};

const BitcoinSV = {
  symbol: BlockchainPlatform.BitcoinSV,
  networkSymbol: BlockchainPlatform.BitcoinSV,
  name: 'BitcoinSV',
  platform: BlockchainPlatform.BitcoinSV,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 8,
  nativeScale: 0,
};

const EOS = {
  symbol: BlockchainPlatform.EOS,
  networkSymbol: BlockchainPlatform.EOS,
  name: 'EOS',
  platform: BlockchainPlatform.EOS,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 0,
  nativeScale: 4,
};

const Litecoin = {
  symbol: BlockchainPlatform.Litecoin,
  networkSymbol: BlockchainPlatform.Litecoin,
  name: 'Litecoin',
  platform: BlockchainPlatform.Litecoin,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 8,
  nativeScale: 0,
};

const Dash = {
  symbol: BlockchainPlatform.Dash,
  networkSymbol: BlockchainPlatform.Dash,
  name: 'Dash',
  platform: BlockchainPlatform.Dash,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 8,
  nativeScale: 0,
};

const EthereumClassic = {
  symbol: BlockchainPlatform.EthereumClassic,
  networkSymbol: BlockchainPlatform.EthereumClassic,
  name: 'EthereumClassic',
  platform: BlockchainPlatform.EthereumClassic,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 18,
  nativeScale: 0,
};

const NEO = {
  symbol: BlockchainPlatform.NEO,
  networkSymbol: BlockchainPlatform.NEO,
  name: 'NEO',
  platform: BlockchainPlatform.NEO,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 0,
  nativeScale: 0,
};

const NEOGAS = {
  symbol: 'gas',
  networkSymbol: 'gas',
  name: 'GAS',
  platform: BlockchainPlatform.NEO,
  isNative: true,
  isUTXOBased: true,
  humanReadableScale: 0,
  nativeScale: 8,
};

const Tomo = {
  symbol: BlockchainPlatform.Tomo,
  networkSymbol: BlockchainPlatform.Tomo,
  name: 'Tomo',
  platform: BlockchainPlatform.Tomo,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 18,
  nativeScale: 0,
};

const Ripple = {
  symbol: BlockchainPlatform.Ripple,
  networkSymbol: BlockchainPlatform.Ripple,
  name: 'Ripple',
  platform: BlockchainPlatform.Ripple,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 0,
  nativeScale: 6,
};

const Stellar = {
  symbol: BlockchainPlatform.Stellar,
  networkSymbol: BlockchainPlatform.Stellar,
  name: 'Stellar',
  platform: BlockchainPlatform.Stellar,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 0,
  nativeScale: 6,
};

const Nem = {
  symbol: BlockchainPlatform.Nem,
  networkSymbol: BlockchainPlatform.Nem,
  name: 'XEM',
  platform: BlockchainPlatform.Nem,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 6,
  nativeScale: 0,
};

const Tron = {
  symbol: BlockchainPlatform.Tron,
  networkSymbol: BlockchainPlatform.Tron,
  name: 'Tron',
  platform: BlockchainPlatform.Tron,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 6,
  nativeScale: 0,
};

const Polygon = {
  symbol: BlockchainPlatform.Polygon,
  networkSymbol: BlockchainPlatform.Polygon,
  name: 'Polygon',
  platform: BlockchainPlatform.Polygon,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 18,
  nativeScale: 0,
};

const Solana = {
  symbol: BlockchainPlatform.Solana,
  networkSymbol: BlockchainPlatform.Solana,
  name: 'Solana',
  platform: BlockchainPlatform.Solana,
  isNative: true,
  isUTXOBased: false,
  humanReadableScale: 9,
  nativeScale: 0,
};

const nativeCurrencies: ICurrency[] = [
  Bitcoin,
  Ethereum,
  Cardano,
  BitcoinCash,
  BitcoinSV,
  EOS,
  Litecoin,
  Dash,
  EthereumClassic,
  NEO,
  NEOGAS,
  Tomo,
  Ripple,
  Stellar,
  Nem,
  Tron,
  BSC,
  Polygon,
  Solana,
];

export class CurrencyRegistry {
  public static readonly Bitcoin: ICurrency = Bitcoin;
  public static readonly Ethereum: ICurrency = Ethereum;
  public static readonly Cardano: ICurrency = Cardano;
  public static readonly BitcoinCash: ICurrency = BitcoinCash;
  public static readonly BitcoinSV: ICurrency = BitcoinSV;
  public static readonly EOS: ICurrency = EOS;
  public static readonly Litecoin: ICurrency = Litecoin;
  public static readonly Dash: ICurrency = Dash;
  public static readonly EthereumClassic: ICurrency = EthereumClassic;
  public static readonly NEO: ICurrency = NEO;
  public static readonly NEOGAS: ICurrency = NEOGAS;
  public static readonly Tomo: ICurrency = Tomo;
  public static readonly Ripple: ICurrency = Ripple;
  public static readonly Stellar: ICurrency = Stellar;
  public static readonly Nem: ICurrency = Nem;
  public static readonly Tron: ICurrency = Tron;
  public static readonly Bsc: ICurrency = BSC;
  public static readonly Polygon: ICurrency = Polygon;
  public static readonly Solana: ICurrency = Solana;

  /**
   * Register a currency on environment data
   * Native assets have been registered above
   * Most likely the tokens or other kind of programmatic assets will be added here
   *
   * @param c currency
   */
  public static registerCurrency(c: ICurrency): boolean {
    const symbol = c.symbol.toLowerCase();
    logger.info(`CurrencyRegistry::registerCurrency symbol=${symbol}`);
    if (allCurrencies.has(symbol)) {
      logger.warn(`Currency register multiple times: ${symbol}`);
      return false;
    }

    allCurrencies.set(symbol, c);
    onCurrencyRegisteredCallbacks.forEach(callback => callback(c));

    if (onSpecificCurrencyRegisteredCallbacks.has(symbol)) {
      onSpecificCurrencyRegisteredCallbacks.get(symbol).forEach(callback => callback());
    }

    return true;
  }

  public static registerOmniAsset(propertyId: number, networkSymbol: string, name: string, scale: number): boolean {
    logger.info(
      `register Omni: propertyId=${propertyId}, networkSymbol=${networkSymbol}, name=${name}, scale=${scale}`
    );
    const platform = BlockchainPlatform.Bitcoin;
    const symbol = [TokenType.OMNI, propertyId].join('.');
    const currency: IOmniAsset = {
      symbol,
      networkSymbol,
      tokenType: TokenType.OMNI,
      name,
      platform,
      isNative: false,
      isUTXOBased: false,
      propertyId,
      humanReadableScale: 0,
      nativeScale: scale,
    };

    allOmniAssets.push(currency);
    eventCallbacks['omni-registered'].forEach(callback => callback(currency));

    return CurrencyRegistry.registerCurrency(currency);
  }

  public static registerErc20Token(
    contractAddress: string,
    networkSymbol: string,
    name: string,
    decimals: number
  ): boolean {
    logger.info(
      `register erc20: contract=${contractAddress}, networkSymbol=${networkSymbol}, name=${name}, decimals=${decimals}`
    );
    const platform = BlockchainPlatform.Ethereum;
    const symbol = [TokenType.ERC20, contractAddress].join('.');
    const currency: IErc20Token = {
      symbol,
      networkSymbol,
      tokenType: TokenType.ERC20,
      name,
      platform,
      isNative: false,
      isUTXOBased: false,
      contractAddress,
      decimals,
      humanReadableScale: decimals,
      nativeScale: 0,
    };

    allErc20Tokens.push(currency);
    eventCallbacks['erc20-registered'].forEach(callback => callback(currency));

    return CurrencyRegistry.registerCurrency(currency);
  }

  public static unregisterErc20Token(contractAddress: string) {
    logger.info(`unregister erc20: contract=${contractAddress}`);
    const symbol = [TokenType.ERC20, contractAddress].join('.');
    for (let i = 0; i < allErc20Tokens.length; i++) {
      const token = allErc20Tokens[i];
      if (token.contractAddress.toLowerCase() === contractAddress.toLowerCase()) {
        allErc20Tokens.splice(i, 1);
        break;
      }
    }

    CurrencyRegistry.unregisterCurrency(symbol);
  }

  public static registerBEP20Token(
    contractAddress: string,
    networkSymbol: string,
    name: string,
    decimals: number
  ): boolean {
    logger.info(
      `register bep20: contract=${contractAddress}, networkSymbol=${networkSymbol}, name=${name}, decimals=${decimals}`
    );
    const platform = BlockchainPlatform.BSC;
    const symbol = [TokenType.BEP20, contractAddress].join('.');
    const currency: IErc20Token = {
      symbol,
      networkSymbol,
      tokenType: TokenType.BEP20,
      name,
      platform,
      isNative: false,
      isUTXOBased: false,
      contractAddress,
      decimals,
      humanReadableScale: decimals,
      nativeScale: 0,
    };

    allBep20Tokens.push(currency);
    eventCallbacks['bep20-registered'].forEach(callback => callback(currency));

    return CurrencyRegistry.registerCurrency(currency);
  }

  public static unregisterBep20Token(contractAddress: string) {
    logger.info(`unregister bep20: contract=${contractAddress}`);
    const symbol = [TokenType.BEP20, contractAddress].join('.');
    for (let i = 0; i < allBep20Tokens.length; i++) {
      const token = allBep20Tokens[i];
      if (token.contractAddress.toLowerCase() === contractAddress.toLowerCase()) {
        allBep20Tokens.splice(i, 1);
        break;
      }
    }

    CurrencyRegistry.unregisterCurrency(symbol);
  }

  public static registerTrc20Token(
    contractAddress: string,
    networkSymbol: string,
    name: string,
    decimals: number
  ): boolean {
    logger.info(
      `register trc20: contract=${contractAddress}, networkSymbol=${networkSymbol}, name=${name}, decimals=${decimals}`
    );
    const platform = BlockchainPlatform.Tomo;
    const symbol = [TokenType.TRC20, contractAddress].join('.');
    const currency: IErc20TokenTomo = {
      symbol,
      networkSymbol,
      tokenType: TokenType.TRC20,
      name,
      platform,
      isNative: false,
      isUTXOBased: false,
      contractAddress,
      decimals,
      humanReadableScale: decimals,
      nativeScale: 0,
    };

    allTrc20Tokens.push(currency);
    eventCallbacks['trc20-registered'].forEach(callback => callback(currency));

    return CurrencyRegistry.registerCurrency(currency);
  }

  public static registerEosToken(code: string, networkSymbol: string, scale: number): boolean {
    const platform = BlockchainPlatform.EOS;
    const symbol = [TokenType.EOS, networkSymbol].join('.');
    const currency: IEosToken = {
      symbol,
      networkSymbol,
      tokenType: TokenType.EOS,
      name: networkSymbol,
      platform,
      isNative: false,
      isUTXOBased: false,
      code,
      humanReadableScale: 0,
      nativeScale: scale,
    };

    allEosTokens.push(currency);
    eventCallbacks['eos-token-registered'].forEach(callback => callback(currency));

    return CurrencyRegistry.registerCurrency(currency);
  }

  public static getOneOmniAsset(propertyId: number): IOmniAsset {
    const symbol = [TokenType.OMNI, propertyId].join('.');
    return CurrencyRegistry.getOneCurrency(symbol) as IOmniAsset;
  }

  public static getAllOmniAssets(): IOmniAsset[] {
    return allOmniAssets;
  }

  public static getOneErc20Token(contractAddress: string): IErc20Token {
    const symbol = [TokenType.ERC20, contractAddress].join('.');
    return CurrencyRegistry.getOneCurrency(symbol) as IErc20Token;
  }

  public static getAllErc20Tokens(): IErc20Token[] {
    return allErc20Tokens;
  }

  public static getAllBep20Tokens(): IErc20Token[] {
    return allBep20Tokens;
  }

  public static getAllTrc20Tokens(): IErc20Token[] {
    return allTrc20Tokens;
  }

  public static getOneEosToken(contractAddress: string): IEosToken {
    const symbol = [TokenType.EOS, contractAddress].join('.');
    return CurrencyRegistry.getOneCurrency(symbol) as IEosToken;
  }

  public static getAllEosTokens(): IEosToken[] {
    return allEosTokens;
  }

  public static getAllPolygonErc20Tokens(): IErc20Token[] {
    return allPolygonErc20Tokens;
  }

  /**
   * Just return all currencies that were registered
   */
  public static getAllCurrencies(): ICurrency[] {
    return Array.from(allCurrencies.values());
  }

  public static hasOneCurrency(symbol: string): boolean {
    return allCurrencies.has(symbol);
  }

  public static hasOneNativeCurrency(symbol: string): boolean {
    return nativeCurrencies.map(c => c.symbol).indexOf(symbol) > -1;
  }

  /**
   * Get information of one currency by its symbol
   *
   * @param symbol
   */
  public static getOneCurrency(symbol: string): ICurrency {
    symbol = symbol.toLowerCase();
    if (!allCurrencies.has(symbol)) {
      throw new Error(`CurrencyRegistry::getOneCurrency cannot find currency has symbol: ${symbol}`);
    }

    return allCurrencies.get(symbol);
  }

  public static getOneNativeCurrency(platform: BlockchainPlatform): ICurrency {
    const symbol = (platform as string).toLowerCase();
    if (!allCurrencies.has(symbol)) {
      throw new Error(`CurrencyRegistry::getOneNativeCurrency cannot find currency has symbol: ${symbol}`);
    }

    return allCurrencies.get(symbol);
  }

  public static getCurrenciesOfPlatform(platform: BlockchainPlatform): ICurrency[] {
    const result: ICurrency[] = [];
    switch (platform) {
      case BlockchainPlatform.Bitcoin:
        result.push(Bitcoin);
        result.push(...CurrencyRegistry.getAllOmniAssets());
        break;

      case BlockchainPlatform.Ethereum:
        result.push(Ethereum);
        result.push(...CurrencyRegistry.getAllErc20Tokens());
        break;

      case BlockchainPlatform.BSC:
        result.push(BSC);
        result.push(...CurrencyRegistry.getAllBep20Tokens());
        break;

      case BlockchainPlatform.Tomo:
        result.push(Tomo);
        result.push(...CurrencyRegistry.getAllTrc20Tokens());
        break;

      case BlockchainPlatform.EOS:
        result.push(...CurrencyRegistry.getAllEosTokens());
        break;

      case BlockchainPlatform.BitcoinCash:
        result.push(CurrencyRegistry.BitcoinCash);
        break;

      case BlockchainPlatform.Litecoin:
        result.push(CurrencyRegistry.Litecoin);
        break;

      case BlockchainPlatform.Dash:
        result.push(CurrencyRegistry.Dash);
        break;

      case BlockchainPlatform.EthereumClassic:
        result.push(CurrencyRegistry.EthereumClassic);
        break;

      case BlockchainPlatform.Tomo:
        result.push(CurrencyRegistry.Tomo);
        break;

      case BlockchainPlatform.Cardano:
        result.push(CurrencyRegistry.Cardano);
        break;

      case BlockchainPlatform.Ripple:
        result.push(CurrencyRegistry.Ripple);
        break;

      case BlockchainPlatform.Stellar:
        result.push(CurrencyRegistry.Stellar);
        break;

      case BlockchainPlatform.Nem:
        result.push(CurrencyRegistry.Nem);
        break;

      case BlockchainPlatform.Tron:
        result.push(CurrencyRegistry.Tron);
        break;

      case BlockchainPlatform.Polygon:
        result.push(CurrencyRegistry.Polygon);
        break;

      case BlockchainPlatform.Solana:
        result.push(CurrencyRegistry.Solana);
        break;

      default:
        throw new Error(`CurrencyRegistry::getCurrenciesOfPlatform hasn't been implemented for ${platform} yet.`);
    }

    return result;
  }

  /**
   * Update config for a currency
   *
   * @param c
   * @param config
   */
  public static setCurrencyConfig(c: ICurrency, config: ICurrencyConfig) {
    const symbol = c.symbol.toLowerCase();
    let finalConfig: ICurrencyConfig;

    // Keep configs that is already set on the environment
    if (allCurrencyConfigs.has(symbol)) {
      const oldConfig = allCurrencyConfigs.get(symbol);
      finalConfig = Object.assign({}, finalConfig, oldConfig);
    }

    // And merge it with desired config
    finalConfig = Object.assign({}, finalConfig, config);

    logger.info(`CurrencyRegistry::setCurrencyConfig: symbol=${symbol} endpoint=${finalConfig.internalEndpoint}`);

    // Put it to the environment again
    allCurrencyConfigs.set(symbol, finalConfig);
    onCurrencyConfigSetCallbacks.forEach(callback => callback(c, config));
  }

  /**
   * Get config of a single currency
   * @param c
   */
  public static getCurrencyConfig(c: ICurrency): ICurrencyConfig {
    const symbol = c.symbol.toLowerCase();
    let config = allCurrencyConfigs.get(symbol);

    // If config for particular currency is not available, try the platform's one
    if (!config) {
      config = allCurrencyConfigs.get(c.platform);
    }

    // Something went wrong if the config still could not be found
    if (!config) {
      throw new Error(`CurrencyRegistry::getCurrencyConfig cannot find currency has symbol: ${symbol}`);
    }

    return config;
  }

  /**
   * Add listener that is triggered when a new currency is registered
   *
   * @param callback
   */
  public static onCurrencyRegistered(callback: (currency: ICurrency) => void) {
    onCurrencyRegisteredCallbacks.push(callback);
  }

  /**
   * Add listener that is triggered when a new currency is registered
   *
   * @param callback
   */
  public static onSpecificCurrencyRegistered(currency: ICurrency, callback: () => void) {
    const symbol = currency.symbol.toLowerCase();

    // If currency has been registered before, just invoke the callback
    if (allCurrencies.has(symbol)) {
      callback();
      return;
    }

    if (!onSpecificCurrencyRegisteredCallbacks.has(symbol)) {
      onSpecificCurrencyRegisteredCallbacks.set(symbol, []);
    }

    onSpecificCurrencyRegisteredCallbacks.get(symbol).push(callback);
  }

  /**
   * Add listener that is triggered when an ERC20 token is registered
   *
   * @param callback
   */
  public static onERC20TokenRegistered(callback: (token: IErc20Token) => void) {
    if (allErc20Tokens.length > 0) {
      allErc20Tokens.forEach(token => {
        callback(token);
      });
    }

    eventCallbacks['erc20-registered'].push(callback);
  }

  /**
   * Add listener that is triggered when an ERC20 token is registered
   *
   * @param callback
   */
  public static onBep20TokenRegistered(callback: (token: IErc20Token) => void) {
    if (allBep20Tokens.length > 0) {
      allBep20Tokens.forEach(token => {
        callback(token);
      });
    }

    eventCallbacks['bep20-registered'].push(callback);
  }

  /**
   * Add listener that is triggered when an TRC20 token is registered
   *
   * @param callback
   */
  public static onTRC20TokenRegistered(callback: (token: IErc20TokenTomo) => void) {
    if (allTrc20Tokens.length > 0) {
      allTrc20Tokens.forEach(token => {
        callback(token);
      });
    }

    eventCallbacks['trc20-registered'].push(callback);
  }

  /**
   * Add listener that is triggered when an Omni Asset is registered
   *
   * @param callback
   */
  public static onOmniAssetRegistered(callback: (asset: IOmniAsset) => void) {
    if (allOmniAssets.length > 0) {
      allOmniAssets.forEach(token => {
        callback(token);
      });
    }

    eventCallbacks['omni-registered'].push(callback);
  }

  /**
   * Add listener that is triggered when an EOS token is registered
   *
   * @param callback
   */
  public static onEOSTokenRegistered(callback: (token: IEosToken) => void) {
    if (allEosTokens.length > 0) {
      allEosTokens.forEach(token => {
        callback(token);
      });
    }

    eventCallbacks['eos-token-registered'].push(callback);
  }

  /**
   * Add listener that is triggered when an Polygon ERC20 token is registered
   *
   * @param callback
   */
  public static onPolygonERC20TokenRegistered(callback: (token: IErc20Token) => void) {
    if (allPolygonErc20Tokens.length > 0) {
      allPolygonErc20Tokens.forEach(token => {
        callback(token);
      });
    }

    eventCallbacks['polygon-erc20-token-registered'].push(callback);
  }

  /**
   * Add listener that is triggered when an SPL token is registered
   *
   * @param callback
   */
  public static onSplTokenRegistered(callback: (token: ISplToken) => void) {
    if (allSplTokens.length > 0) {
      allSplTokens.forEach(token => {
        callback(token);
      });
    }

    eventCallbacks['spl-token-registered'].push(callback);
  }

  /**
   * Add listener that is triggered when a currency config is setup
   *
   * @param callback
   */
  public static onCurrencyConfigSet(callback: (currency: ICurrency, config: ICurrencyConfig) => void) {
    onCurrencyConfigSetCallbacks.push(callback);
  }

  protected static unregisterCurrency(symbol: string): boolean {
    if (!allCurrencies.has(symbol)) {
      logger.error(`Try to unregister an invalid currency symbol=${symbol}`);
      return false;
    }

    return allCurrencies.delete(symbol);
  }
}

process.nextTick(() => {
  // Add native currencies to the list first
  nativeCurrencies.forEach(c => CurrencyRegistry.registerCurrency(c));
});

export default CurrencyRegistry;
