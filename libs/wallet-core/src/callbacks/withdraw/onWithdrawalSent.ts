import { WithdrawalTx } from '../../entities/WithdrawalTx';

/**
 * This callback is invoked when a withdrawal transaction is submitted to the blockchain network
 * @param {WithdrawalTx} record: the withdrawal's raw transaction
 */
export default async function onWithdrawalSent(record: WithdrawalTx): Promise<void> {
  // const conn = await QueueConnector.connectService();
  // const chan = await conn.createChannel();
  // chan.sendToQueue(Const.WITHDRAWAL_PROCESS.VERIFIER, Buffer.from(JSON.stringify(record)));
  // chan.close();
}

export { onWithdrawalSent };
