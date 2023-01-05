export * from './EnvConfigRegistry';
export * from './CurrencyRegistry';
export * from './GatewayRegistry';

export async function settleEnvironment() {
  // Do something here when the things get more complicated
  // For now just skip a beat should be enough
  // Wait for next 500ms
  await new Promise(resolve => setTimeout(resolve, 500));
}
