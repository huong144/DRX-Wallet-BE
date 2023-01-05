import { BlockchainPlatform, getLogger } from 'sota-common';
import { BaseWebServer } from '../../sota-common';

const logger = getLogger('PolygonWebServer');

export class PolygonWebServer extends BaseWebServer {
  constructor() {
    super(BlockchainPlatform.Polygon);
  }
}
