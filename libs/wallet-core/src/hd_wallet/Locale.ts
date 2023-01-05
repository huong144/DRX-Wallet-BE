export const subjectMailLowerBalance = '【DR】Exchange Balance Too Small';
export const subjectMailInsufficientBalance = '【DR】Exchange Balance Is Insufficient';
export const subjectPendingTooLong = '【DR】Some withdrawals, deposits, internal transfers are pending too long';
export function contentEmailLowerBalanceEngLish(
  email: string,
  currency: string,
  min: string,
  balance: string,
  address: string,
  max: string
) {
  const unit = currency.toUpperCase();
  return `Hi ${email},

Below DR exchange hot wallet is lower than threshold.
Please deposit into this address to make transaction for users.

Currency:  ${unit}
Hot wallet address: ${address}
Min threshold: ${min} ${unit}
Max threshold: ${max} ${unit}
Current balance: ${balance} ${unit}`;
}

export function contentEmailInsufficientBalanceEngLish(
  email: string,
  currency: string,
  amount: string,
  balance: string,
  address: string,
  amountOfMoneyMissing: string
) {
  const unit = currency.toUpperCase();
  return `Hi ${email},

Below DR exchange hot wallet is lower than amount withdrawal.
Please deposit into this address to make transaction for users.

Currency:  ${unit}
Hot wallet address: ${address}
Hot wallet balance: ${balance} ${unit}
Users amount withdrawal: ${amount} ${unit}
Exchange balance missing: ${amountOfMoneyMissing} ${unit}`;
}

export function contentEmailAlertPendingTooLong(
  email: string,
  pendingWithdrawal: string,
  pendingInternalTransfer: string,
  pendingCollect: string
) {
  return `Hi ${email},

  Below there are some pending records need be handled:
  Withdrawal ids: ${pendingWithdrawal ? pendingWithdrawal : 'Nothing'},
  InternalTransfer ids: ${pendingInternalTransfer ? pendingInternalTransfer : 'Nothing'},
  Deposit ids: ${pendingCollect ? pendingCollect : 'Nothing'}`;
}
