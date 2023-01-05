// TODO: Revive me...
export async function collectorVerifierDoProcess() {
  // Do nothing
}

// import {
//   TransactionStatus,
//   getLogger,
//   IWithdrawalProcessingResult,
//   BaseDepositCollectorVerifier,
//   Utils,
//   getListTokenSymbols,
// } from 'sota-common';
// import * as rawdb from '../../rawdb';
// import { EntityManager, getConnection } from 'typeorm';
// import { CollectStatus, DepositEvent } from '../../Enums';

// const logger = getLogger('collectorVerifierDoProcess');
// const emptyResult: IWithdrawalProcessingResult = {
//   needNextProcess: false,
//   withdrawalTxId: 0,
// };

// export async function collectorVerifierDoProcess(
//   verfifier: BaseDepositCollectorVerifier
// ): Promise<IWithdrawalProcessingResult> {
//   let result: IWithdrawalProcessingResult = null;
//   await getConnection().transaction(async manager => {
//     result = await _verifierDoProcess(manager, verfifier);
//   });
//   return result;
// }

// async function _verifierDoProcess(
//   manager: EntityManager,
//   verifier: BaseDepositCollectorVerifier
// ): Promise<IWithdrawalProcessingResult> {
//   const collectingRecord = await rawdb.findDepositByCollectStatus(manager, getListTokenSymbols().tokenSymbols, [
//     CollectStatus.COLLECTING,
//   ]);

//   if (!collectingRecord) {
//     logger.info(`Wait until new collecting tx`);
//     return emptyResult;
//   }

//   // verify collect transaction information from blockchain network
//   let verifiedStatus = CollectStatus.COLLECTED;
//   const transactionStatus = await verifier.getGateway().getTransactionStatus(collectingRecord.collectedTxid);
//   if (transactionStatus === TransactionStatus.UNKNOWN || transactionStatus === TransactionStatus.CONFIRMING) {
//     logger.info(`Wait until new tx state ${collectingRecord.collectedTxid}, is ${transactionStatus} now`);
//     return emptyResult;
//   }

//   if (transactionStatus === TransactionStatus.FAILED) {
//     verifiedStatus = CollectStatus.UNCOLLECTED;
//   }

//   logger.info(`Transaction ${collectingRecord.collectedTxid} is ${transactionStatus}`);
//   const resTx = await verifier.getGateway().getOneTransaction(collectingRecord.collectedTxid);
//   const timestamp = resTx.timestamp;

//   const tasks = [rawdb.updateDepositCollectStatus(manager, collectingRecord.id, verifiedStatus, timestamp)];
//   await Utils.PromiseAll(tasks);

//   return emptyResult;
// }
