import { BaseWebServer, BlockchainPlatform } from 'sota-common';

export class XrpWebServer extends BaseWebServer {
  public constructor() {
    super(BlockchainPlatform.Ripple);
  }
}
