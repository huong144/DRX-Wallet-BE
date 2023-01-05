interface IXrpKeyPair {
  readonly privateKey: string;
  readonly publicKey: string;
}

class XrpKeyPair implements IXrpKeyPair {
  public readonly privateKey: string;
  public readonly publicKey: string;

  constructor(keypair: IXrpKeyPair) {
    this.privateKey = keypair.privateKey;
    this.publicKey = keypair.publicKey;
  }
}

export default XrpKeyPair;
