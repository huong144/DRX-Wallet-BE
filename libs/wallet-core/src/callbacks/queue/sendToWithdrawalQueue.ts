async function pickerSendQueue(currency: string, data: string) {
  // const conn = await QueueConnector.connectService();
  // const chan = await conn.createChannel();
  // if (data) {
  //   chan.sendToQueue(currency + Const.WITHDRAWAL_PROCESS.PICKER, Buffer.from(data));
  // }
  // await chan.close();
}

async function signerSendQueue(currency: string, data: string) {
  // const conn = await QueueConnector.connectService();
  // const chan = await conn.createChannel();
  // chan.sendToQueue(currency + Const.WITHDRAWAL_PROCESS.SIGNER, Buffer.from(data));
  // await chan.close();
}

export { pickerSendQueue, signerSendQueue };
