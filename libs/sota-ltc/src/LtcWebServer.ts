import { BaseWebServer, BlockchainPlatform } from 'sota-common';

export class LtcWebServer extends BaseWebServer {
  public constructor() {
    super(BlockchainPlatform.Litecoin);
  }
}
