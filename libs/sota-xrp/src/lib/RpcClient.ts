import * as Ripple from 'ripple-lib';
import { EnvConfigRegistry } from 'sota-common';
const network = new Map<string, string>();
network.set('mainnet', 'wss://s1.ripple.com');
network.set('testnet', 'wss://s.altnet.rippletest.net:51233');

let rpcClient: Ripple.RippleAPI;
export async function getRpcClient(): Promise<Ripple.RippleAPI> {
  const typeNetwork = EnvConfigRegistry.getNetwork();
  if (!rpcClient) {
    rpcClient = new Ripple.RippleAPI({
      server: network.get(typeNetwork),
    });
  }

  if (!rpcClient.isConnected()) {
    await rpcClient.connect();
  }

  return rpcClient;
}
