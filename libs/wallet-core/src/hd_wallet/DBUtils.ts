import { EntityManager, In, LessThan, Not } from 'typeorm';
import {
  Wallet,
  Address,
  HotWallet,
  WalletBalance,
  WithdrawalTx,
  EnvConfig,
  Withdrawal,
  WalletLog,
  CurrencyConfig,
  Erc20Token,
  Bep20Token,
  InternalTransfer,
  Deposit,
  KmsDataKey,
} from '../entities';
import {
  userId,
  UNSIGNED,
  kmsId,
  indexOfHotWallet,
  PREFIX_OMNI,
  PREFIX_ERC20,
  TYPE_NORMAL,
  NOT_HD,
  ADA_RECEIPT_ADDRESS_INDEX,
  TMP_ADDRESS,
  PREFIX_BEP20,
} from './Const';
import { BigNumber, CurrencyRegistry, GatewayRegistry, BlockchainPlatform, Account, Utils } from 'sota-common';
import * as AdaWalletService from './AdaWalletService';
import * as _ from 'lodash';
import { ColdWallet } from '../entities/ColdWallet';
import { WithdrawalStatus, WithdrawalNote, InternalTransferType } from '../Enums';
import * as hdUtil from './Utils';
import Kms from '../encrypt/Kms';

export function getUSDTGlobalSymbol(): string {
  const allOmniAssets = CurrencyRegistry.getAllOmniAssets();
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < allOmniAssets.length; i++) {
    if (allOmniAssets[i].networkSymbol === 'usdt') {
      return allOmniAssets[i].symbol;
    }
  }

  throw new Error(`Could not find config for USDT currency`);
}

export async function findOrCreateWallet(currency: string, connection: EntityManager): Promise<Wallet> {
  const wallet: Wallet = await connection.getRepository(Wallet).findOne({
    where: {
      currency,
    },
  });
  if (!wallet) {
    wallet.isHd = true;
    wallet.secret = JSON.stringify(await hdUtil.generateSeed(connection));
    if (currency === BlockchainPlatform.EOS || currency === BlockchainPlatform.Ripple) {
      wallet.isHd = false;
      wallet.secret = null;
    }
    wallet.currency = currency;
    wallet.userId = userId;
    wallet.label = currency.toUpperCase() + ' wallet';
    wallet.id = await findWalletId(currency);
    await connection.getRepository(Wallet).save(wallet);
  }
  if (!wallet.secret && wallet.isHd) {
    wallet.secret = JSON.stringify(await hdUtil.generateSeed(connection));
    await connection.getRepository(Wallet).save(wallet);
  }
  return wallet;
}

export async function findOrCreateAdaWallet(currency: string, connection: EntityManager): Promise<Wallet> {
  const wallet: Wallet = await connection.getRepository(Wallet).findOne({
    where: {
      currency,
    },
  });

  if (!wallet) {
    wallet.isHd = true;
    wallet.currency = currency;
    wallet.userId = userId;
    wallet.label = currency.toUpperCase() + ' wallet';
    wallet.id = await findWalletId(currency);
    await connection.getRepository(Wallet).save(wallet);
  }
  if (!wallet.secret) {
    const dataKey = await getRandomKms(connection);
    const walletParams = { wallet_name: `S-Wallet for u${wallet.userId} (${wallet.label})` };
    if (!dataKey || !dataKey.id) {
      throw new Error(`KMS data key is mandatory...`);
    }

    const kms_data_key_id = dataKey.id;
    const private_key = await Kms.getInstance().encrypt(
      await AdaWalletService._generateAdaAccount(currency, walletParams),
      kms_data_key_id
    );
    wallet.secret = JSON.stringify({ private_key, kms_data_key_id });
    await connection.getRepository(Wallet).save(wallet);
  }
  // tslint:disable-next-line: prefer-const
  let [hotWallet, receiptAddress] = await Promise.all([
    connection.getRepository(HotWallet).findOne({
      where: {
        currency,
        walletId: wallet.id,
      },
    }),
    findReceiptAddress(currency, wallet.id, connection),
  ]);

  if (!hotWallet) {
    const secret = JSON.parse(wallet.secret);
    if (!secret) {
      throw new Error('This currency do not have wallet');
    }
    let seed = secret;
    if (secret.private_key) {
      seed = secret.private_key;
      if (secret.kms_data_key_id > 0) {
        seed = await Kms.getInstance().decrypt(secret.private_key, secret.kms_data_key_id);
      }
    }
    hotWallet = new HotWallet();
    hotWallet.address = JSON.parse(seed).wallet_address;
    hotWallet.userId = userId;
    hotWallet.walletId = wallet.id;
    hotWallet.currency = currency;
    hotWallet.secret = wallet.secret;
    hotWallet.type = TYPE_NORMAL;
    await connection.getRepository(HotWallet).save(hotWallet);
  }
  if (!receiptAddress) {
    const secret = JSON.parse(wallet.secret);
    if (!secret) {
      throw new Error('This currency do not have wallet');
    }
    let seed = secret;
    if (secret.private_key) {
      seed = secret.private_key;
      if (secret.kms_data_key_id > 0) {
        seed = JSON.parse(await Kms.getInstance().decrypt(secret.private_key, secret.kms_data_key_id));
        seed.accountId = ADA_RECEIPT_ADDRESS_INDEX;
      }
    }

    const dataKey = await getRandomKms(connection);
    if (!dataKey || !dataKey.id) {
      throw new Error(`KMS data key is mandatory...`);
    }
    const newReceiptAddress = await AdaWalletService._generateOneAdaWalletAddress(
      currency,
      wallet.id,
      JSON.stringify(seed),
      wallet.secret,
      dataKey
    );

    await saveNotHDAddresses(
      wallet.id,
      currency,
      [newReceiptAddress],
      ADA_RECEIPT_ADDRESS_INDEX.toString(),
      connection
    );
  }
  return wallet;
}

export async function saveNotHDAddresses(
  walletId: number,
  currency: string,
  addresses: Account[],
  path: string,
  connection: EntityManager
) {
  const newAddresses: Address[] = [];
  addresses.forEach(address => {
    const newAddress = new Address();
    newAddress.walletId = walletId;
    newAddress.currency = currency;
    newAddress.address = address.address;
    newAddress.secret = address.privateKey;
    newAddress.hdPath = path;
    newAddress.isExternal = false;
    newAddress.isHd = false;
    return newAddresses.push(newAddress);
  });
  await connection.getRepository(Address).save(newAddresses);
}

export async function saveAddresses(
  walletId: number,
  currency: string,
  addresses: Account[],
  path: string,
  firstIndex: number,
  connection: EntityManager
) {
  const newAddresses: Address[] = [];
  addresses.forEach((address, index) => {
    const newAddress = new Address();
    newAddress.walletId = walletId;
    newAddress.currency = currency;
    newAddress.address = address.address;
    newAddress.secret = address.privateKey;
    newAddress.hdPath =
      currency === BlockchainPlatform.Solana
        ? `m/44'/501'/${firstIndex + index}'/0'`
        : path + (firstIndex + index).toString();
    newAddress.isExternal = false;
    newAddress.isHd = true;
    return newAddresses.push(newAddress);
  });
  await connection.getRepository(Address).save(newAddresses);
}

export async function saveHotWallet(
  path: string,
  address: Account,
  currency: string,
  walletId: number,
  connection: EntityManager
) {
  const hotWalletRepo = connection.getRepository(HotWallet);
  let hotWallet = await hotWalletRepo.findOne({
    where: {
      userId,
      currency,
      walletId,
    },
  });
  if (!hotWallet) {
    hotWallet = new HotWallet();
    hotWallet.userId = userId;
    hotWallet.walletId = walletId;
    hotWallet.address = address.address;
    hotWallet.currency = currency;
    hotWallet.secret = address.privateKey;
    hotWallet.type = TYPE_NORMAL;
    await hotWalletRepo.save(hotWallet);
  }
  const hotWalletAddress = await connection.getRepository(Address).findOne({
    where: {
      address: hotWallet.address,
      walletId,
      currency,
      userId,
    },
  });
  if (!hotWalletAddress) {
    await saveAddresses(walletId, currency, [address], path, indexOfHotWallet, connection);
  }
}

export async function findWalletBalance(walletId: number, coin: string, connection: EntityManager) {
  const walletBalance = await connection.getRepository(WalletBalance).findOne({
    where: {
      userId,
      currency: coin,
      walletId,
    },
  });
  return walletBalance;
}

export async function insertWithdrawalRecord(
  connection: EntityManager,
  coin: string,
  walletId: number,
  toAddress: string,
  amount: number,
  tag?: string
) {
  const withdrawal = new Withdrawal();
  withdrawal.userId = userId;
  withdrawal.walletId = walletId;
  withdrawal.txid = `TMP_WITHDRAWAL_TX` + toAddress + Date.now().toString();
  (withdrawal.currency = coin),
    // sub_currency: subcoin,
    (withdrawal.fromAddress = TMP_ADDRESS);
  withdrawal.toAddress = toAddress;
  withdrawal.amount = amount.toString();
  (withdrawal.status = UNSIGNED), (withdrawal.hashCheck = 'TMP_HASHCHECK');
  withdrawal.kmsDataKeyId = kmsId;
  withdrawal.note = tag ? JSON.stringify({ tag }) : '';
  await connection.getRepository(Withdrawal).save(withdrawal);
  return withdrawal.id;
}

export async function findIdDB(id: number, connection: EntityManager) {
  const withdrawal = await connection.getRepository(Withdrawal).findOne({
    where: {
      id,
      status: 'signing',
    },
  });
  if (!withdrawal) {
    return null;
  }
  return withdrawal.withdrawalTxId;
}

export async function findTxHashDB(id: number, connection: EntityManager) {
  const withdrawalTx = await connection.getRepository(WithdrawalTx).findOne(id);
  if (!withdrawalTx) {
    return null;
  }
  return withdrawalTx.txid;
}

export async function getNetworkDB(connection: EntityManager) {
  const env = await connection.getRepository(EnvConfig).findOne({
    where: {
      key: 'NETWORK',
    },
  });
  if (!env) {
    return 'testnet';
  }
  return env.value;
}

export async function getAdaAccountId(connection: EntityManager) {
  const env = await connection.getRepository(EnvConfig).findOne({
    where: {
      key: 'ADA_ACCOUNT_ID',
    },
  });
  return env;
}

export async function increaseAdaAccountId(number: number, connection: EntityManager) {
  const data = await getAdaAccountId(connection);
  data.value = (Number(data.value) + number).toString();
  const env = await connection.getRepository(EnvConfig).save(data);
}

export async function findWalletId(currency: string) {
  switch (currency) {
    case 'btc': {
      return 1001;
    }
    case 'eth': {
      return 1006;
    }
    case 'eos': {
      return 1002;
    }
    case 'ltc': {
      return 1005;
    }
    case 'xrp': {
      return 1004;
    }
    default: {
      // ada
      return 1003;
    }
  }
}

export async function countAddresses(currency: string, connection: EntityManager) {
  return await connection.getRepository(Address).count({
    currency,
  });
}

export async function getSeeder(currency: string, connection: EntityManager) {
  return (await connection.getRepository(Wallet).findOne({
    where: {
      currency,
    },
  })).secret;
}

export async function findHotWalletWithAddress(address: string, currency: string, connection: EntityManager) {
  const hotWallet = await connection.getRepository(HotWallet).findOne({
    where: {
      currency,
      address,
    },
  });
  return hotWallet;
}

export async function findHotWalletWithoutAddress(currency: string) {
  const hotWallet = await HotWallet.createQueryBuilder('hw')
    .where('hw.currency = :currency', { currency })
    .getOne();
  return hotWallet;
}

export async function findSecretWallet(currency: string, connection: EntityManager) {
  const wallet = await connection.getRepository(Wallet).findOne({
    where: {
      currency,
    },
  });
  return wallet.secret;
}

export async function saveMailerReceive(_mailerReceive: string, connection: EntityManager) {
  let receiver = await connection.getRepository(EnvConfig).findOne({
    where: {
      key: 'MAIL_HOLDER_COLD_WALLET',
    },
  });
  if (!receiver) {
    receiver = new EnvConfig();
    receiver.key = 'MAIL_HOLDER_COLD_WALLET';
    receiver.value = _mailerReceive;
  }

  receiver.value = _mailerReceive !== undefined ? _mailerReceive : receiver.value;
  await connection.getRepository(EnvConfig).save(receiver);
  return 'ok';
}

export async function saveCurrencyThresholdInfo(
  currency: string,
  minThreshold: number,
  maxThreshold: number,
  connection: EntityManager
) {
  const walletBalance = await connection.getRepository(WalletBalance).findOne({
    where: {
      currency,
    },
  });
  if (!walletBalance) {
    throw new Error('Do not have currency!');
  }
  walletBalance.upperThreshold = maxThreshold.toString();
  walletBalance.lowerThreshold = minThreshold.toString();
  walletBalance.middleThreshold = new BigNumber(walletBalance.upperThreshold)
    .plus(walletBalance.lowerThreshold)
    .div(new BigNumber(2))
    .toString();
  await connection.getRepository(WalletBalance).save(walletBalance);
  return walletBalance;
}

export async function getSettingThresholdDB() {
  const coldWalletTable = 'cold_wallet';
  const walletBalanceTable = 'wallet_balance';
  const listCurrencies = await WalletBalance.createQueryBuilder(walletBalanceTable)
    .leftJoin(ColdWallet, coldWalletTable, `${coldWalletTable}.currency = ${walletBalanceTable}.currency`)
    .select([
      `${walletBalanceTable}.currency as currency`,
      `${walletBalanceTable}.upper_threshold as upperThreshold`,
      `${walletBalanceTable}.lower_threshold as lowerThreshold`,
      `${coldWalletTable}.address as address`,
    ])
    .getRawMany();
  listCurrencies.map(curCurrency => {
    if (curCurrency.currency === BlockchainPlatform.EOS) {
      const eosToken = listCurrencies.find(_currency => _currency.currency.toLowerCase() === 'eos.eos');
      if (!eosToken) {
        return;
      }
      if (!curCurrency.upperThreshold) {
        curCurrency.upperThreshold = eosToken.upperThreshold;
      }
      if (!curCurrency.lowerThreshold) {
        curCurrency.lowerThreshold = eosToken.lowerThreshold;
      }
      if (!curCurrency.address) {
        curCurrency.address = eosToken.address;
      }
    }
    return curCurrency;
  });
  return listCurrencies.map(listCurrency => filterObject(listCurrency));
}

function filterObject(current: any) {
  const rawData = _.pick(current, ['currency', 'upperThreshold', 'lowerThreshold', 'address']);
  const networkSymbol = CurrencyRegistry.getOneCurrency(rawData.currency).networkSymbol;
  return Object.assign(rawData, { networkSymbol });
}

export async function findHdPathDB(currency: string, connection: EntityManager) {
  const hdPath = (await connection.getRepository(CurrencyConfig).findOne({
    where: {
      currency,
    },
  })).hdPath;
  if (!hdPath) {
    throw new Error('Do not support create hd wallet for this currency: ' + currency);
  }
  return hdPath;
}

export async function saveColdWallet(
  currency: string,
  address: string,
  connection: EntityManager,
  platformCurrency: string
) {
  if (!address) {
    return;
  }
  const wallet = await connection.getRepository(Wallet).findOne({
    where: {
      currency: platformCurrency,
      userId,
    },
  });
  if (!wallet) {
    throw new Error('Do not have wallet for this currency: ' + platformCurrency);
  }
  let _coldWallet = await findColdWallet(currency);
  if (!_coldWallet) {
    _coldWallet = new ColdWallet();
    _coldWallet.currency = currency;
    _coldWallet.userId = userId;
    _coldWallet.walletId = wallet.id;
    _coldWallet.type = 'common';
  }
  _coldWallet.address = address;
  await connection.getRepository(ColdWallet).save(_coldWallet);
}

export async function findColdWallet(currency: string) {
  return await ColdWallet.createQueryBuilder('cw')
    .where('cw.currency = :currency', { currency })
    .getOne();
}

export async function coldWallet(connection: EntityManager) {
  return await connection.getRepository(ColdWallet).find();
}

export async function mailerReceive() {
  return await EnvConfig.find({
    where: {
      key: 'MAIL_HOLDER_COLD_WALLET',
    },
  });
}

export async function addErc20DB(
  symbol: string,
  name: string,
  contractAddress: string,
  decimal: number,
  manager: EntityManager
) {
  const erc20 = new Erc20Token();
  erc20.contractAddress = contractAddress;
  erc20.decimal = decimal;
  erc20.name = name;
  erc20.network = await getNetworkDB(manager);
  erc20.symbol = symbol;
  const walletId = (await manager.getRepository(Wallet).findOne({
    where: {
      currency: BlockchainPlatform.Ethereum,
    },
  })).id;
  let walletBalance = await manager.getRepository(WalletBalance).findOne({
    where: {
      currency: PREFIX_ERC20 + contractAddress,
      walletId,
    },
  });
  if (!walletBalance) {
    walletBalance = new WalletBalance();
    walletBalance.currency = PREFIX_ERC20 + contractAddress;
    walletBalance.balance = '0';
    walletBalance.walletId = walletId;
    walletBalance.withdrawalPending = '0';
    walletBalance.withdrawalTotal = '0';
  }
  await Utils.PromiseAll([
    manager.getRepository(Erc20Token).save(erc20),
    manager.getRepository(WalletBalance).save(walletBalance),
  ]);
}

export async function addBep20DB(
  symbol: string,
  name: string,
  contractAddress: string,
  decimal: number,
  manager: EntityManager
) {
  const bep20 = new Bep20Token();
  bep20.contractAddress = contractAddress;
  bep20.decimal = decimal;
  bep20.name = name;
  bep20.network = await getNetworkDB(manager);
  bep20.symbol = symbol;
  const walletId = (await manager.getRepository(Wallet).findOne({
    where: {
      currency: BlockchainPlatform.BSC,
    },
  })).id;
  let walletBalance = await manager.getRepository(WalletBalance).findOne({
    where: {
      currency: PREFIX_BEP20 + contractAddress,
      walletId,
    },
  });
  if (!walletBalance) {
    walletBalance = new WalletBalance();
    walletBalance.currency = PREFIX_BEP20 + contractAddress;
    walletBalance.balance = '0';
    walletBalance.walletId = walletId;
    walletBalance.withdrawalPending = '0';
    walletBalance.withdrawalTotal = '0';
  }
  await Utils.PromiseAll([
    manager.getRepository(Bep20Token).save(bep20),
    manager.getRepository(WalletBalance).save(walletBalance),
  ]);
}

export async function deleteErc20DB(contractAddress: string, manager: EntityManager) {
  const [token, walletBalance] = await Promise.all([
    manager.getRepository(Erc20Token).findOne({ contractAddress }),
    manager.getRepository(WalletBalance).findOne({ currency: PREFIX_ERC20 + contractAddress }),
  ]);

  if (!token && !walletBalance) {
    throw new Error(`Could not find ERC20 token in database: ${contractAddress}`);
  }

  if (token) {
    await manager.getRepository(Erc20Token).delete(token);
  }

  if (walletBalance) {
    await manager.getRepository(WalletBalance).delete(walletBalance);
  }
}

export async function deleteBep20DB(contractAddress: string, manager: EntityManager) {
  const [token, walletBalance] = await Promise.all([
    manager.getRepository(Bep20Token).findOne({ contractAddress }),
    manager.getRepository(WalletBalance).findOne({ currency: PREFIX_BEP20 + contractAddress }),
  ]);

  if (!token && !walletBalance) {
    throw new Error(`Could not find ERC20 token in database: ${contractAddress}`);
  }

  if (token) {
    await manager.getRepository(Bep20Token).delete(token);
  }

  if (walletBalance) {
    await manager.getRepository(WalletBalance).delete(walletBalance);
  }
}
export async function amountCollectColdWallet(currency: string, manager: EntityManager) {
  const withdrawal = 'Withdrawal';
  return (await manager
    .getRepository(Withdrawal)
    .createQueryBuilder(withdrawal)
    .select(`SUM(${withdrawal}.amount)`, 'totalCollectColdWallet')
    .where(`${withdrawal}.currency = :currency`, { currency: `${currency}` })
    .andWhere(`${withdrawal}.status = :status`, { status: `${WithdrawalStatus.COMPLETED}` })
    .andWhere(`${withdrawal}.note = :note`, { note: `${WithdrawalNote.COLD_WALLET}` })
    .getRawOne()).totalCollectColdWallet;
}

export async function feeCollectHotWallet(currency: string) {
  if (currency.startsWith(PREFIX_ERC20) || currency.startsWith(PREFIX_OMNI)) {
    return 0;
  }

  const withdrawal = 'InternalTransfer';
  return (await InternalTransfer.createQueryBuilder(withdrawal)
    .select(`SUM(${withdrawal}.fee)`, 'totalFeeCollectHotWallet')
    .where(`${withdrawal}.currency = :currency`, { currency })
    .andWhere(`${withdrawal}.type IN (:...types)`, { types: [InternalTransferType.COLLECT] })
    .getRawOne()).totalFeeCollectHotWallet;
}

export async function feeCollectTokenHotWallet(currency: string) {
  const withdrawal = 'InternalTransfer';
  return await InternalTransfer.createQueryBuilder(withdrawal)
    .select(`SUM(${withdrawal}.fee)`, 'totalFeeSeedCollectHotWallet')
    .addSelect(`SUM(${withdrawal}.amount)`, 'totalAmountSeedCollectHotWallet')
    .where(`${withdrawal}.currency = :currency`, { currency })
    .andWhere(`${withdrawal}.type IN (:...types)`, {
      types: [InternalTransferType.SEED],
    })
    .getRawOne();
}

export async function feeCollectColdWallet(currency: string) {
  if (currency.startsWith(PREFIX_ERC20) || currency.startsWith(PREFIX_OMNI)) {
    return 0;
  }
  const withdrawalTx = 'WithdrawalTx';
  const withdrawal = 'Withdrawal';
  return (await Withdrawal.createQueryBuilder(withdrawal)
    .leftJoin(WithdrawalTx, withdrawalTx, `${withdrawalTx}.id = ${withdrawal}.withdrawal_tx_id`)
    .select(`SUM(${withdrawalTx}.fee_amount)`, 'totalFeeCollectColdWallet')
    .where(`${withdrawal}.currency = :currency`, { currency })
    .andWhere(` ${withdrawal}.note = :note`, { note: WithdrawalNote.COLD_WALLET })
    .getRawOne()).totalFeeCollectColdWallet;
}

export async function feeCollectTokenColdWallet(currency: string) {
  const withdrawalTx = 'WithdrawalTx';
  const withdrawal = 'Withdrawal';
  const iCurrency = CurrencyRegistry.getOneCurrency(currency);
  if (CurrencyRegistry.getCurrenciesOfPlatform(iCurrency.platform).length > 1) {
    let prefix = PREFIX_ERC20;
    if (currency === BlockchainPlatform.Bitcoin) {
      prefix = getUSDTGlobalSymbol();
    } else if (currency === BlockchainPlatform.BSC) {
      prefix = PREFIX_BEP20;
    }
    return (await Withdrawal.createQueryBuilder(withdrawal)
      .leftJoin(WithdrawalTx, withdrawalTx, `${withdrawalTx}.id = ${withdrawal}.withdrawal_tx_id`)
      .select(`SUM(${withdrawalTx}.fee_amount)`, 'totalFeeCollectColdWallet')
      .where(`${withdrawal}.currency like :currency`, { currency: `${prefix}%` })
      .andWhere(` ${withdrawal}.note = :note`, { note: WithdrawalNote.COLD_WALLET })
      .getRawOne()).totalFeeCollectColdWallet;
  }

  return 0;
}

export async function amountTransferColdToHot(currency: string, manager: EntityManager) {
  const total = new BigNumber(0);
  const iCurrency = CurrencyRegistry.getOneCurrency(currency);
  const hotWallet = await findHotWalletWithoutAddress(iCurrency.platform);
  const hotWalletAddress = await findRealReceiptAddress(hotWallet.address, currency, hotWallet.walletId, manager);
  const _coldWallet = await findColdWallet(iCurrency.platform);
  if (!_coldWallet || !hotWalletAddress) {
    return 0;
  }
  const depositRecords = await manager.getRepository(Deposit).find({
    where: {
      toAddress: hotWalletAddress,
      currency: iCurrency.symbol,
    },
  });
  const gateWay = GatewayRegistry.getGatewayInstance(iCurrency.symbol);
  const txs = await gateWay.getTransactionsByIds(depositRecords.map(depositRecord => depositRecord.txid));
  const txsFilter = txs.filter(tx => tx.extractSenderAddresses().indexOf(_coldWallet.address) > 1);
  txsFilter.forEach(tx => {
    tx.extractInputEntries().forEach(output => {
      if (output.address === _coldWallet.address) {
        total.plus(new BigNumber(output.amount).abs());
      }
    });
  });
  return total;
}

export async function feeTransferTokenColdToHot(currency: string, manager: EntityManager) {
  const total = new BigNumber(0);
  const iCurrency = CurrencyRegistry.getOneCurrency(currency);
  const [hotWalletAddress, _coldWallet] = await Promise.all([
    findHotWalletWithoutAddress(iCurrency.platform),
    findColdWallet(iCurrency.platform),
  ]);
  if (!_coldWallet || !hotWalletAddress) {
    return 0;
  }
  let depositRecords: any[] = [];
  if (iCurrency.symbol === BlockchainPlatform.Bitcoin) {
    depositRecords = await manager.getRepository(Deposit).find({
      where: {
        toAddress: hotWalletAddress.address,
        currency: getUSDTGlobalSymbol(),
      },
    });
  } else if (iCurrency.symbol === BlockchainPlatform.Ethereum) {
    const withdrawal = 'Deposit';
    depositRecords = await manager
      .getRepository(Deposit)
      .createQueryBuilder(withdrawal)
      .select()
      .where(`${withdrawal}.currency like :currency`, { currency: PREFIX_ERC20 + '%' })
      .andWhere(`${withdrawal}.toAddress = :types`, { types: hotWalletAddress.address })
      .getRawMany();
  }
  const gateWay = GatewayRegistry.getGatewayInstance(iCurrency.symbol);
  const txs = await gateWay.getTransactionsByIds(depositRecords.map(depositRecord => depositRecord.txid));
  const txsFilter = txs.filter(tx => tx.extractSenderAddresses().indexOf(_coldWallet.address) > 1);
  txsFilter.forEach(tx => {
    tx.extractInputEntries().forEach(output => {
      if (output.address === _coldWallet.address) {
        total.plus(new BigNumber(output.amount).abs());
      }
    });
  });
  return total;
}

export async function getAllCurrenciesWallet() {
  const walletBalances = await WalletBalance.createQueryBuilder('wb').getMany();
  return walletBalances.map(walletBalance => walletBalance.currency);
}

export async function getRandomKms(manager: EntityManager) {
  return manager.getRepository(KmsDataKey).findOne();
}

export async function saveSecret(manager: EntityManager) {
  const wallets = await manager.getRepository(Wallet).find({
    where: {
      isHd: true,
    },
  });
  await Promise.all(
    wallets.map(async wallet => {
      if (!wallet.secret) {
        wallet.secret = JSON.stringify(await hdUtil.generateSeed(manager));
        await manager.getRepository(Wallet).save(wallet);
      }
      return;
    })
  );
}

export async function addAddressOneAddressCurrencyDB(
  currency: string,
  address: string,
  privateKey: string,
  manager: EntityManager
) {
  // tslint:disable-next-line: prefer-const
  let [hotWallet, _address] = await Promise.all([
    manager.getRepository(HotWallet).findOne({
      where: {
        currency,
      },
    }),
    manager.getRepository(Address).findOne({
      currency,
    }),
  ]);
  if (hotWallet || _address) {
    throw new Error(`This currency: ${currency} had an address`);
  }
  const wallet = await manager.getRepository(Wallet).findOne({
    where: {
      currency,
    },
  });
  if (!wallet) {
    throw new Error(`This currency: ${currency} don't have wallet!`);
  }
  const dataKey = await getRandomKms(manager);
  if (!dataKey || !dataKey.id) {
    throw new Error(`KMS data key is mandatory...`);
  }

  const kms_data_key_id = dataKey.id;
  const private_key = await Kms.getInstance().encrypt(privateKey, kms_data_key_id);
  const secret = JSON.stringify({ private_key, kms_data_key_id });
  hotWallet = new HotWallet();
  hotWallet.address = address;
  hotWallet.userId = userId;
  hotWallet.walletId = wallet.id;
  hotWallet.currency = currency;
  hotWallet.secret = secret;
  hotWallet.type = TYPE_NORMAL;
  const newAddress = new Address();
  newAddress.walletId = wallet.id;
  newAddress.currency = currency;
  newAddress.address = address;
  newAddress.secret = secret;
  newAddress.hdPath = NOT_HD;
  newAddress.isExternal = false;
  newAddress.isHd = false;
  await Promise.all([
    manager.getRepository(Address).save(newAddress),
    manager.getRepository(HotWallet).save(hotWallet),
  ]);
}

export async function findRealReceiptAddress(
  address: string,
  currency: string,
  walletId: number,
  connection: EntityManager
) {
  if (currency === BlockchainPlatform.Cardano) {
    return (await findReceiptAddress(currency, walletId, connection)).address;
  }
  return address;
}

export async function findReceiptAddress(currency: string, walletId: number, connection: EntityManager) {
  return await connection.getRepository(Address).findOne({
    where: {
      currency,
      walletId,
      hdPath: ADA_RECEIPT_ADDRESS_INDEX,
    },
  });
}

export async function resetSettingThreshold(currencies: string[], manager: EntityManager) {
  const walletBalances = await manager.getRepository(WalletBalance).find({
    where: {
      currency: In(currencies),
    },
  });
  walletBalances.forEach(walletBalance => {
    walletBalance.lowerThreshold = null;
    walletBalance.upperThreshold = null;
    walletBalance.middleThreshold = null;
  });
  await manager.getRepository(WalletBalance).save(walletBalances);
}

export async function resetColdWallet(currencies: string[], manager: EntityManager) {
  await manager.delete(ColdWallet, { currency: In(currencies) });
}

export async function findAddress(address: string, manager: EntityManager) {
  return await manager.findOne(Address, { address });
}

export async function getEnvConfig(search?: string) {
  const configColdWallet = await EnvConfig.createQueryBuilder('ec');
  if (search) {
    configColdWallet.where('(ec.key LIKE :search)', { search: `%${search}%` });
  }
  return configColdWallet.getMany();
}

export async function updateEnvConfig(key: string, value: string, manager: EntityManager) {
  const check = await EnvConfig.findOne({
    where: {
      key,
    },
  });
  if (!check) {
    throw new Error('Env config not found');
  }
  // tslint:disable-next-line:no-shadowed-variable
  const updateEnvConfig = await manager.update(EnvConfig, check.key, {
    value: value !== undefined || value !== null ? value : check.value,
  });
  return updateEnvConfig;
}
