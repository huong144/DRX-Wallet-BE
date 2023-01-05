import {
  ParsedConfirmedTransaction,
  ParsedInstruction,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AccountLayout,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptAccount,
  createCloseAccountInstruction,
  RawAccount,
} from '@solana/spl-token';
import {
  implement,
  BigNumber,
  getLogger,
  IRawTransaction,
  Address,
  ISignedRawTransaction,
  Account,
  TransactionStatus,
  Block,
  Transactions,
  SolanaBasedGateway,
  SolTransaction,
  ISplToken,
  CurrencyRegistry,
  GatewayRegistry,
  Utils,
  ISubmittedTransaction,
} from 'sota-common';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import pLimit from 'p-limit';
const BN = require('bn.js');

import SolGateway, { IGroupTransferEntries } from './SolGateway';
import { conn } from './SolanaWeb3';
import { addressToPublicKey, isAssociatedTokenProgram, isSystemProgram, isTokenProgram } from './utils';

const logger = getLogger('SplGateway');
CurrencyRegistry.onSplTokenRegistered((token: ISplToken) => {
  logger.info(`Register SplGateway to the registry: ${token.symbol}`);
  GatewayRegistry.registerLazyCreateMethod(token, () => new SplTokenGateway(token));
});

export class SplTokenGateway extends SolanaBasedGateway {
  protected _currency: ISplToken;
  protected _solGateway: SolGateway;
  public constructor(currency: ISplToken) {
    super(currency);
    this._currency = currency;
    this._solGateway = new SolGateway();
  }

  @implement
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const associatedTokenAccount = await this.findAssociatedTokenAddress(address);
    if (!(await this.isTokenAccount(associatedTokenAccount))) {
      return new BigNumber(0);
    }
    const tokenAmount = await conn.getTokenAccountBalance(associatedTokenAccount);
    if (tokenAmount === null) {
      throw new Error(`SplGateway::getAddressBalance Could not get balance for address: ${address}`);
    }
    return new BigNumber(tokenAmount.value.amount);
  }

  @implement
  public async getAverageSeedingFee(createAssociatedAccount?: boolean): Promise<BigNumber> {
    const feeTx = (await this._solGateway.pollNewBlockhash()).fee;
    let fee = new BigNumber(feeTx);
    if (!!createAssociatedAccount) {
      fee = fee.plus(await this.getMinimumBalanceForRentExemption());
    }

    return fee;
  }

  @implement
  public async constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    value: BigNumber,
    options: {
      isConsolidate?: boolean;
      needFunding?: boolean;
      maintainRent?: boolean;
    }
  ): Promise<IRawTransaction> {
    const amount = new BigNumber(value);
    let feeTx = new BigNumber(0);

    const { blockhash, fee } = await this._solGateway.pollNewBlockhash();
    feeTx = feeTx.plus(fee);

    const ownerSource = addressToPublicKey(fromAddress);
    const transaction = new Transaction({
      feePayer: ownerSource,
      recentBlockhash: blockhash,
    });

    const source = await this.findAssociatedTokenAddress(fromAddress);
    if (!(await this.isTokenAccount(source))) {
      throw new Error(
        `SplTokenGateway::constructRawTransaction Could not construct tx because of sender: ${fromAddress} does not have an assoticated token account`
      );
    }

    let destination = addressToPublicKey(toAddress);
    if (!(await this.isTokenAccount(destination))) {
      const toAssociatedAccount = await this.findAssociatedTokenAddress(toAddress);
      if (!(await this.isTokenAccount(toAssociatedAccount))) {
        if (!!options.needFunding) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              addressToPublicKey(this._currency.programId),
              toAssociatedAccount,
              destination,
              ownerSource
            )
          );
          feeTx = feeTx.plus(await this.getMinimumBalanceForRentExemption());
        } else {
          throw new Error(
            `SplTokenGateway::constructRawTransaction Could not construct tx because of receiver: ${toAddress} does not have an assoticated token account`
          );
        }
      }
      destination = toAssociatedAccount;
    }

    // Check whether the balance of hot wallet is enough to send
    let solBalance = await this._solGateway.getAddressBalance(fromAddress);
    if (!!options.maintainRent) {
      const minimumBalance = await this._solGateway.getMinimumBalanceForRentExemption();
      solBalance = solBalance.minus(minimumBalance);
    }

    if (solBalance.lt(feeTx)) {
      throw new Error(
        `SplTokenGateway::constructRawTransaction Could not construct tx because of account ${fromAddress} has insufficient funds for fee=${feeTx}, solBalance=${solBalance}`
      );
    }

    const balance = await this.getAddressBalance(fromAddress);
    if (balance.lt(amount)) {
      throw new Error(
        `SplTokenGateway::constructRawTransaction Could not construct tx because of account ${fromAddress} has insufficient funds spend ${amount} (${
          this._currency.programId
        }) + fee ${feeTx}, balance=${balance}, solBalance=${solBalance}`
      );
    }

    transaction.add(
      createTransferInstruction(
        source,
        destination,
        ownerSource,
        new BigNumber(amount).toNumber(),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const rawTx = transaction.serialize({ verifySignatures: false }).toString('base64');
    return {
      txid: uuidv4(),
      unsignedRaw: rawTx,
    };
  }

  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    return await this._solGateway.signRawTransaction(unsignedRaw, secret);
  }

  // Wrap SOL gateway
  public async sendRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction> {
    return await this._solGateway.sendRawTransaction(signedRawTx);
  }

  public async getMinimumBalanceForRentExemption(): Promise<BigNumber> {
    return new BigNumber(await getMinimumBalanceForRentExemptAccount(conn));
  }

  public async createAccountAsync(): Promise<Account> {
    return this._solGateway.createAccountAsync();
  }

  public async getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    return this._solGateway.getAccountFromPrivateKey(privateKey);
  }

  public async getBlockCount(): Promise<number> {
    return this._solGateway.getBlockCount();
  }

  public getTransactionStatus(txid: string): Promise<TransactionStatus> {
    return this._solGateway.getTransactionStatus(txid);
  }

  public async estimateFee(options: { isConsolidate: boolean; useLowerNetworkFee?: boolean }): Promise<BigNumber> {
    return this._solGateway.estimateFee(options);
  }

  /**
   * @override
   * Returns all transactions in givent block.
   *
   * @param {number} blockHash: height of the block
   * @returns {Transactions}: an array of transactions
   *
   */
  public async getBlockTransactions(blockNumber: number): Promise<Transactions> {
    const txs = new Transactions();
    const [block, lastNetworkBlockNumber] = await Promise.all([this.getOneBlock(blockNumber), this.getBlockCount()]);
    if (!block) {
      return txs;
    }
    // get all raw_confirmed_transactions of block
    const rawTxs = await this._solGateway._getMultiTransactionsByIds(blockNumber, block.txids);
    const limit = pLimit(this._solGateway.getParallelNetworkRequestLimit());
    await Promise.all(
      rawTxs.map(async rawTx => {
        return limit(async () => {
          // initialize sol_transaction from raw_tx and receipt
          const groupEntries = await this.groupTransferEntries(rawTx);
          // Cannot find any transfer
          // Just treat the transaction as failed
          if (groupEntries.outEntries.length === 0 || groupEntries.inEntries.length === 0) {
            return;
          }

          const rawSolTx = {
            txHash: rawTx.transaction.signatures[0],
            height: blockNumber,
            fee: groupEntries.fee,
            status: rawTx.meta.err ? false : true,
            outEntries: groupEntries.outEntries,
            inEntries: groupEntries.inEntries,
          };
          const solTx = new SolTransaction(
            this._currency,
            rawSolTx,
            {
              hash: block.hash,
              number: blockNumber,
              timestamp: block.timestamp,
            },
            lastNetworkBlockNumber
          );
          txs.push(solTx);
        });
      })
    );
    return txs;
  }

  public async groupTransferEntries(rawTx: ParsedConfirmedTransaction): Promise<IGroupTransferEntries> {
    const group: IGroupTransferEntries = {
      outEntries: [],
      inEntries: [],
      fee: new BigNumber(rawTx.meta.fee),
    };
    const instructions = rawTx.transaction.message.instructions;
    await Promise.all(
      instructions.map(async (ins, index) => {
        // check programId
        if (!isTokenProgram(ins.programId) && !isAssociatedTokenProgram(ins.programId)) {
          return;
        }

        const { info, type } = (ins as ParsedInstruction).parsed;

        let amount = new BigNumber(0);
        switch (type) {
          case 'transfer': {
            amount = new BigNumber(info.amount);
            break;
          }
          case 'transferChecked': {
            amount = new BigNumber(info.tokenAmount.amount);
            break;
          }
          case 'create':
            {
              if (isAssociatedTokenProgram(ins.programId)) {
                const { account } = info;
                const innerInstruction = rawTx.meta.innerInstructions ? rawTx.meta.innerInstructions[index] : null;
                if (innerInstruction) {
                  innerInstruction.instructions.map(_ins => {
                    if (isSystemProgram(_ins.programId)) {
                      const { _info, _type } = (_ins as ParsedInstruction).parsed;
                      if (_type === 'transfer') {
                        const { destination, lamports } = _info;
                        if (account === destination) {
                          group.fee = group.fee.plus(new BigNumber(lamports));
                        }
                      }
                    }
                  });
                }
              }
            }
            break;
          default:
            return;
        }
        if (!amount.isZero()) {
          const fromAccount = await this.getAccountInfo(info.source);
          const toAccount = await this.getAccountInfo(info.destination);

          if (!fromAccount.mint.equals(toAccount.mint)) {
            throw new Error(
              'SplTokenGateway::groupTransferEntries source account and destination account are not the same mint'
            );
          }
          // ignore if it's not transfer this token
          if (fromAccount.mint.toBase58() !== this._currency.programId) {
            return;
          }

          const senderEntry = {
            currency: this._currency,
            amount: amount.toFixed(),
            address: fromAccount.owner.toBase58(),
          };

          group.inEntries.push(senderEntry);

          const receiverEntry = {
            currency: this._currency,
            amount: amount.toFixed(),
            address: toAccount.owner.toBase58(),
          };
          group.outEntries.push(receiverEntry);
        }
      })
    );
    return group;
  }

  public async getAccountInfo(account: string): Promise<RawAccount> {
    const info = await conn.getAccountInfo(addressToPublicKey(account));
    if (info == null) {
      throw new Error(
        `SplTokenGateway::getAccountInfo Could not get account info: ${account} due to error: Failed to find account`
      );
    }
    if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
      throw new Error(
        `SplTokenGateway::getAccountInfo Could not get account info: ${account} due to error: Invalid account owner`
      );
    }
    if (info.data.length !== AccountLayout.span) {
      throw new Error(
        `SplTokenGateway::getAccountInfo Could not get account info: ${account} due to error: Invalid account size`
      );
    }

    const accountInfo = AccountLayout.decode(info.data);
    return accountInfo;
  }

  protected async _getOneTransaction(txid: string): Promise<SolTransaction> {
    const rawTx = await this._solGateway.getRawTransaction(txid);

    if (!rawTx) {
      return null;
    }

    if (!rawTx.transaction.message.accountKeys.some(accountKey => isTokenProgram(accountKey.pubkey))) {
      return null;
    }

    const [block, lastNetworkBlockNumber] = await Promise.all([this.getOneBlock(rawTx.slot), this.getBlockCount()]);
    const groupEntries = await this.groupTransferEntries(rawTx);
    const rawSolTx = {
      txHash: rawTx.transaction.signatures[0],
      height: rawTx.slot,
      fee: groupEntries.fee,
      status: rawTx.meta.err ? false : true,
      outEntries: groupEntries.outEntries,
      inEntries: groupEntries.inEntries,
    };
    return new SolTransaction(
      this._currency,
      rawSolTx,
      {
        hash: block.hash,
        number: block.number,
        timestamp: block.timestamp,
      },
      lastNetworkBlockNumber
    );
  }

  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    return this._solGateway.getOneBlock(blockNumber);
  }

  private async findAssociatedTokenAddress(ownerAddress: Address): Promise<PublicKey> {
    const owner = addressToPublicKey(ownerAddress);
    const account = await getAssociatedTokenAddress(
      addressToPublicKey(this._currency.programId),
      owner,
      false, // TODO
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return account;
  }

  private async isTokenAccount(account: PublicKey): Promise<boolean> {
    try {
      await this.getAccountInfo(account.toBase58());
      return true;
    } catch (error) {
      if (
        (error.toString() as string).includes('Failed to find account') ||
        (error.toString() as string).includes('Invalid account owner')
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * We will clean up ancillary token accounts on the user's behalf.
   * @param owner
   * @param associatedAccount - associated token account of owner
   * @returns {TransactionInstruction[]} - list of instructions needed for cleaning
   */
  private async garbageCollecting(owner: PublicKey, associatedAccount: PublicKey): Promise<TransactionInstruction[]> {
    const accounts = await conn.getTokenAccountsByOwner(owner, {
      mint: addressToPublicKey(this._currency.programId),
    });

    if (accounts.value.length === 0) {
      logger.info(`SplTokenGateway::garbageCollecting nothing to do`);
      return [];
    }

    const accountsInfo = new Set<any>();

    _.forEach(accounts.value, (accountInfo: any) => {
      if (accountInfo.account.owner === TOKEN_PROGRAM_ID) {
        const tokenAccount = accountInfo.pubkey;
        const uiTokenAccount = AccountLayout.decode(accountInfo.account.data);
        const { state, amount, closeAuthorityOption, closeAuthority } = uiTokenAccount;
        if (!accountsInfo.has(tokenAccount)) {
          accountsInfo.add({
            tokenAccount,
            amount,
            frozen: state === 2,
            closeAuthority: closeAuthorityOption === 0 ? null : closeAuthority,
          });
        }
      }
    });

    const instructions: TransactionInstruction[] = [];
    logger.info(`SplTokenGateway::garbageCollecting processing for owner: ${owner.toBase58()}`);
    accountsInfo.forEach(info => {
      if ((info.tokenAccount as PublicKey).equals(associatedAccount)) {
        // leave the associated token account alone
        return;
      }

      if (info.frozen) {
        // leave frozen accounts alone
        return;
      }

      // Transfer the account balance into the associated token account
      if (!new BN(info.amount).isZero()) {
        instructions.push(
          createTransferInstruction(info.tokenAccount, associatedAccount, owner, info.amount, [], TOKEN_PROGRAM_ID)
        );
      }

      // Close the account if config.owner is able to
      if (info.closeAuthority && (info.closeAuthority as PublicKey).equals(owner)) {
        instructions.push(createCloseAccountInstruction(info.tokenAccount, owner, owner, [], TOKEN_PROGRAM_ID));
      }
    });
    return instructions;
  }
}
