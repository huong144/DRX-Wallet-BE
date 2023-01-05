export interface IBlockProps {
  readonly hash: string;
  readonly number: number;
  readonly timestamp: string | number;
}

export class BlockHeader implements IBlockProps {
  public readonly hash: string;
  public readonly number: number;
  public readonly timestamp: string | number;

  constructor(props: IBlockProps) {
    Object.assign(this, props);
  }
}

export default BlockHeader;
