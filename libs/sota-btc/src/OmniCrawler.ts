import { OmniGateway } from './OmniGateway';
import {
  ICrawlerOptions,
  BaseGateway,
  CustomAssetCrawler,
  IOmniAsset,
  CurrencyRegistry,
  GatewayRegistry,
} from 'sota-common';
import BtcGateway from './BtcGateway';

export class OmniCrawler extends CustomAssetCrawler {
  constructor(options: ICrawlerOptions) {
    const assets: IOmniAsset[] = CurrencyRegistry.getAllOmniAssets();
    super(options, assets);
  }

  public getPlatformGateway(): BaseGateway {
    return GatewayRegistry.getGatewayInstance(CurrencyRegistry.Bitcoin) as BtcGateway;
  }

  public getGateway(currency: IOmniAsset): OmniGateway {
    return GatewayRegistry.getGatewayInstance(currency) as OmniGateway;
  }
}

export default OmniCrawler;
