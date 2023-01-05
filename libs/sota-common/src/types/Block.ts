import { IBlockProps, BlockHeader } from './BlockHeader';

export class Block extends BlockHeader {
  public readonly txids: string[];

  constructor(props: IBlockProps, txids: string[]) {
    super(props);
    this.txids = txids;
  }
}

export default Block;
