import { WithdrawalTx } from '../../entities/WithdrawalTx';
/**
 * This callback is invoked when a withdrawal withdrawalRaw is signed once
 * @param {WithdrawalTx} withdrawalRaw: the raw of withdrawal transaction
 * @param {string} signature: the signature in hex-string format
 * @param {number} signatureIndex: the order of signature
 */
export default async function onWithdrawalSigned(withdrawalRaw: WithdrawalTx, signatures: string): Promise<void> {
  // const conn = await QueueConnector.connectService();
  // const chan = await conn.createChannel();
  // const obj = {
  //   signatures,
  //   withdrawalRaw,
  // };
  // chan.sendToQueue(Const.WITHDRAWAL_PROCESS.SENDER, Buffer.from(JSON.stringify(obj)));
  // chan.close();
}

export { onWithdrawalSigned };
