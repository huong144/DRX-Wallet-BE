export interface ICurrencyConfig {
  // Basic information...
  readonly currency: string;
  readonly network: string;
  readonly chainId: string;
  readonly chainName: string;
  readonly averageBlockTime: number;
  readonly requiredConfirmations: number;

  // External endpoint that provides APIs to fetch information from blockchain network
  // Like Insight API for bitcoin, infura's url for Ethereum, ...
  // Sometimes we need more than 1 endpoint, like Cardano: need wallet endpoint & explorer endpoint
  readonly restEndpoint: string;

  // Config to connect (most likely) JSON-RPC endpoint
  // Another method to fetch data from blockchain network, beside the rest API above
  readonly rpcEndpoint: string;

  // Block explorer webpage to view data more intuitively
  readonly explorerEndpoint: string;

  // Webserver that provides APIs for each currency will be running on this endpoint
  readonly internalEndpoint: string;
}
