import { Block } from 'sota-common';

interface IXrpBlockData {
  hash: string;
  number: number;
  timestamp: number;
  txids: string[];
}

class XrpBlock extends Block {
  constructor(data: IXrpBlockData) {
    super(
      {
        hash: data.hash,
        number: data.number,
        timestamp: data.timestamp,
      },
      data.txids
    );
  }
}

export default XrpBlock;
