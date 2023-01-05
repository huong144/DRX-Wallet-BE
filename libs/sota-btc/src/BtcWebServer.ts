import { BaseWebServer, BlockchainPlatform } from 'sota-common';

export class BtcWebServer extends BaseWebServer {
  public constructor() {
    super(BlockchainPlatform.Bitcoin);
  }
}
