import { Connection } from '@solana/web3.js';
import { EnvConfigRegistry, NetworkType, CurrencyRegistry, getLogger, RPCClient, Utils, BlockchainPlatform } from 'sota-common';

const logger = getLogger('web3');
interface IRpcConfig {
  protocol: string;
  host: string;
  port: string;
  user: string;
  pass: string;
}

let conn: Connection;

// EnvConfigRegistry.onNetworkChanged(network => {
//   logger.info(`web3::onNetworkChanged network=${network}`);
//   if (network === NetworkType.MainNet) {
//     const rpcEndpoint = process.env.MAIN_NET_RPC_ENDPOINT;
//     try {
//       if (Utils.isValidURL(rpcEndpoint)) {
//         conn = new Connection(rpcEndpoint, 'finalized');
//       }
//     } catch (e) {
//       logger.error(`onNetworkChanged::could not get connection to solana FullNode due to error: ` + e);
//     }
//     return;
//   }

//   if (network === NetworkType.TestNet) {
//     const rpcEndpoint = process.env.TEST_NET_RPC_ENDPOINT;
//     try {
//       if (Utils.isValidURL(rpcEndpoint)) {
//         conn = new Connection(rpcEndpoint, 'finalized');
//       }
//     } catch (e) {
//       logger.error(`onNetworkChanged::could not get connection to solana FullNode due to error: ` + e);
//     }
//     return;
//   }
// });

CurrencyRegistry.onCurrencyConfigSet(function getSolanaConnection(currency, config) {
  if (currency.symbol !== BlockchainPlatform.Solana) {
    return;
  }

  logger.info(`web3::onCurrencyConfigSet currency=${currency.symbol} config=${JSON.stringify(config)}`);
  if (!config.rpcEndpoint) {
    return;
  }

  try {
    const rpcConfig = Object.assign({}, JSON.parse(config.rpcEndpoint)) as IRpcConfig;
    let endpoint: string;

    if (rpcConfig.port) {
      const rpcClient = new RPCClient(rpcConfig);
      endpoint = rpcClient._getEndpoint();
    } else {
      endpoint = `${rpcConfig.protocol}://${rpcConfig.host}`;
    }
    logger.info(`BaseGateway::provider endpoint: ${config.rpcEndpoint}`);
    conn = new Connection(endpoint , 'finalized');
  } catch (e) {
    logger.error(`CurrencyConfigSet::could not get connection to solana FullNode due to error: ` + e);
    throw e;
  }
});

export { conn };
