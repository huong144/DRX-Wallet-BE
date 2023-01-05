import AWS from 'aws-sdk';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getConnection, Connection } from 'typeorm';

let instance: Kms;
const LOCAL_CACHED_RECORDS = new Map<string, any>();
const ENCRYPT_ALGORITHM = 'aes256';

export class Kms {
  public static getInstance(): Kms {
    if (!instance) {
      instance = new Kms();
    }
    return instance;
  }

  private connection: Connection;

  constructor() {
    AWS.CredentialProviderChain.defaultProviders = [
      function sharedIniFileCredentials() {
        return new AWS.SharedIniFileCredentials({
          profile: process.env.AWS_PROFILE_NAME || 'default',
        });
      },
      function eC2MetadataCredentials() {
        return new AWS.EC2MetadataCredentials();
      },
    ];
    AWS.config.setPromisesDependency(Promise);
    this.connection = getConnection();
  }

  // Get details of CMK for provided KeyId
  public async getMasterKey(cmkId: string) {
    const kms = await this.getKMSInstanceByKeyId(cmkId);
    const result = await kms.describeKey({ KeyId: cmkId }).promise();
    return result;
  }

  // Generate a new random data key with provided KeyId
  // Use this practice: https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html
  public async generateDataKey(cmkId: string) {
    if (!cmkId) {
      throw new Error(`Cannot generate data key with invalid cmk id: ${cmkId}`);
    }

    const kms = await this.getKMSInstanceByKeyId(cmkId);
    const { Plaintext, CiphertextBlob } = await kms.generateDataKey({ KeyId: cmkId, KeySpec: 'AES_256' }).promise();
    return {
      plain: Plaintext.toString('base64'),
      cipher: CiphertextBlob.toString('base64'),
    };
  }

  // Get plain text data key from encrypted data key
  // Suppose the KeyId that was used to generate the data key is still exists
  public async getDataKey(dataKeyId: number) {
    const dataKeyRecord = await this.getCachedRecordById('kms_data_key', dataKeyId.toString());
    const encryptedDataKey = dataKeyRecord.encrypted_data_key;
    const kms = await this.getKMSInstanceByKeyId(dataKeyRecord.cmk_id);
    const { Plaintext } = await kms.decrypt({ CiphertextBlob: Buffer.from(encryptedDataKey, 'base64') }).promise();
    return Plaintext.toString('base64');
  }

  // Encrypt arbitrary data, using the data key that is defined in environment variable
  public async encrypt(plainText: string, dataKeyId: number) {
    if (typeof plainText !== 'string') {
      throw new Error(`Only support encrypt string for now.`);
    }

    const dataKey = await this.getDataKey(dataKeyId);
    const cipher = crypto.createCipher(ENCRYPT_ALGORITHM, Buffer.from(dataKey, 'base64'));
    let crypted = cipher.update(plainText, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
  }

  // Decrypt data, using the data key that is defined in environment variable
  public async decrypt(cipherText: string, dataKeyId: number) {
    if (!dataKeyId) {
      return cipherText;
    }

    const dataKey = await this.getDataKey(dataKeyId);
    const decipher = crypto.createDecipher(ENCRYPT_ALGORITHM, Buffer.from(dataKey, 'base64'));
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  public async hash(plainText: string, dataKeyId: number) {
    const result = await bcrypt.hash(await this.combineData(plainText, dataKeyId), 7);
    return result;
  }

  public async verify(plainText: string, hash: string, dataKeyId: number) {
    const result = await bcrypt.compare(await this.combineData(plainText, dataKeyId), hash);
    return result;
  }

  private async getCachedRecordById(tableName: string, id: string) {
    if (!LOCAL_CACHED_RECORDS.get(tableName)) {
      LOCAL_CACHED_RECORDS.set(tableName, {});
    }

    if (LOCAL_CACHED_RECORDS.get(tableName)[id]) {
      return LOCAL_CACHED_RECORDS.get(tableName)[id];
    }

    const records = await this.connection.query(`SELECT * FROM ${tableName} WHERE id=? LIMIT 1`, [id]);
    if (records.length < 1) {
      throw new Error(`Not found record: table=${tableName}, id=${id}`);
    }
    const record = records[0];

    const cached = LOCAL_CACHED_RECORDS.get(tableName);
    cached[id] = JSON.parse(JSON.stringify(record));
    LOCAL_CACHED_RECORDS.set(tableName, cached);
    return LOCAL_CACHED_RECORDS.get(tableName)[id];
  }

  private async getKMSInstanceByKeyId(cmkId: string) {
    const cmk = await this.getCachedRecordById('kms_cmk', cmkId);
    return new AWS.KMS({ region: cmk.region });
  }

  private async combineData(plainText: string, dataKeyId: number) {
    const dataKey = await this.getDataKey(dataKeyId);
    return `${plainText}:${dataKey}`;
  }
}

export default Kms;
