# cc-common

## Environment preparation

### EnvConfig

- EnvConfig can be set via `EnvConfigRegistry::setCustomEnvConfig` method
- These variables are usually set in `.env` file or database, depends on particular project

### Currencies

- Native currencies are all fixed in source code, and registered into `CurrencyRegistry` by default.
- Custom currencies (like ERC20 tokens, Omni assets, ...) are loaded from other source (like user inputs, database, ...), then registered into `CurrencyRegistry` via one of these methods:
  - CurrencyRegistry::registerOmniAsset
  - CurrencyRegistry::registerErc20Token
  - CurrencyRegistry::registerEosToken

### Gateways

- A gateway can be registered by `GatewayRegistry::registerLazyCreateMethod` method
- For the platform gateways which can be constructed directly, just remember to call the registration method on top of the gateway module straightforwardly. For example:

```js
GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Bitcoin, () => new BtcGateway());

export class BtcGateway extends BitcoinBasedGateway {
  // BtcGateway implementation here...
}
```

- For the custom gateways which need parameters on constructor, detect everytime a custom currency is registered into `CurrencyRegistry`, also register the corresponding gateway to the `GatewayRegistry`. For example:

```js
CurrencyRegistry.onOmniAssetRegistered((asset: IOmniAsset) => {
  GatewayRegistry.registerLazyCreateMethod(asset, () => new OmniGateway(asset));
});

export class OmniGateway extends AccountBasedGateway {
  // OmniGateway implementation here...
}
```

### Currency configs

- They consist information about the API endpoints, JSON-RPC endpoints, ... that will be utilized when communicating with blockchain network.
- As other kind of configurations, these information can be come from database or anywhere. But no matter where they come from, just load them to the core app via `CurrencyRegistry::setCurrencyConfig` method.

### Settle environment

- Finally just put an `await settleEnvironment()` statement. Actually there's no much things that have to be resolved now, but we reserve this mechanism for the future, when the things become more complicated.
- Complete example for a environment preparation method:

```js
export async function prepareEnvironment(): Promise<void> {
  // First create and get connection to database
  await createConnection({
    // DB connection config here...
  });
  const connection = getConnection();

  // Then load the configurations and dynamic data from db
  // These informations may come from other source like static json files, .env files, ... depends on each particular project
  const [currencyConfigs, envConfigs, omniTokens, eosTokens] = await Promise.all([
    connection.getRepository(CurrencyConfig).find({}),
    connection.getRepository(EnvConfig).find({}),
    connection.getRepository(OmniToken).find({}),
    connection.getRepository(EosToken).find({})
  ]);

  // Setup EnvConfig
  envConfigs.forEach(config => {
    EnvConfigRegistry.setCustomEnvConfig(config.key, config.value);
  });

  // Register custom currencies
  eosTokens.forEach(token => {
    CurrencyRegistry.registerEosToken(token.code, token.symbol, token.scale);
  });

  omniTokens.forEach(token => {
    CurrencyRegistry.registerOmniAsset(token.propertyId, token.symbol, token.name, token.scale);
  });

  // Load currencies config
  currencyConfigs.forEach(config => {
    if (!CurrencyRegistry.hasOneCurrency(config.currency)) {
      throw new Error(`There's config for unknown currency: ${config.currency}`);
    }

    const currency = CurrencyRegistry.getOneCurrency(config.currency);
    CurrencyRegistry.setCurrencyConfig(currency, config);
  });

  // Wait a little bit, until all the environment is settled
  await settleEnvironment();

  // The environment is ready now. Continue your work here. Happy coding...
  return;
}
```
