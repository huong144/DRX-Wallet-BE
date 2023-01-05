interface IXrpAccount {
  secret: string;
  address: string;
}

class XrpAccount {
  public readonly privateKey: string;
  public readonly address: string;

  constructor(account: IXrpAccount) {
    this.privateKey = account.secret;
    this.address = account.address;
  }
}

export default XrpAccount;
