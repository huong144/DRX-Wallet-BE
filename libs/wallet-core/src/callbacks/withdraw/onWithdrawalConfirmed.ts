import { WithdrawalTx } from '../../entities/WithdrawalTx';

/**
 * This callback is invoked when a withdrawal transaction's status is confirmed on the blockchain network
 * @param {WithdrawalTx} record: the withdrawal's raw transaction
 */
export default async function onWithdrawalConfirmed(record: WithdrawalTx, isSuccessful: boolean): Promise<void> {
  // TODO: Implement me
}

export { onWithdrawalConfirmed };
