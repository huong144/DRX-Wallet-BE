import { Address } from './Address';
import { PrivateKey } from './PrivateKey';

export class Account {
  public readonly address: Address;
  public readonly privateKey: PrivateKey;

  constructor(privateKey: PrivateKey, address: Address) {
    this.address = address;
    this.privateKey = privateKey;
  }
}

export default Account;
