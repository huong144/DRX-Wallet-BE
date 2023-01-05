import { WithdrawalTx } from '../../entities';

/**
 * This callback is invoked when a withdrawal record is inserted into database
 * @param {Withdrawal} record: the inserted data
 */
export default async function onWithdrawalCreated(record: WithdrawalTx): Promise<void> {
  // const conn = await QueueConnector.connectService();
  // const chan = await conn.createChannel();
  // const connection = getConnection();
  // await connection.transaction(async manager => {
  //   const wallet = await rawdb.findHotWallet(manager, record.txid);
  //   if (!wallet) {
  //     return;
  //   }
  //   chan.sendToQueue(Const.WITHDRAWAL_PROCESS.SIGNER, Buffer.from(JSON.stringify({ rec: record, wal: wallet })));
  //   chan.close();
  // });
  // return;
}

export { onWithdrawalCreated };
