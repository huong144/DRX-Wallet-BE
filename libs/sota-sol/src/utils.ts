import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import * as BufferLayout from '@solana/buffer-layout';
import util from 'util';

if (!global.TextEncoder) {
  global.TextEncoder = util.TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = util.TextDecoder;
}

export const NUM_TICKS_PER_SECOND = 160;

export const DEFAULT_TICKS_PER_SLOT = 64;

export const NUM_SLOTS_PER_SECOND = NUM_TICKS_PER_SECOND / DEFAULT_TICKS_PER_SLOT;
export const MS_PER_SLOT = 1000 / NUM_SLOTS_PER_SECOND;

export interface InstructionType {
  /** The Instruction index (from solana upstream program) */
  index: number;
  /** The BufferLayout to use to build data */
  layout: typeof BufferLayout;
}
export type TokenInstructionType = 'Transfer' | 'TransferChecked';

// export const TOKEN_INSTRUCTION_LAYOUTS: {
//   [type in TokenInstructionType]: InstructionType;
// } = Object.freeze({
//   Transfer: {
//     index: 3,
//     layout: BufferLayout.struct([
//       BufferLayout.u8("instruction"),
//       BufferLayout.blob(8, "amount"),
//     ]),
//   },
//   TransferChecked: {
//     index: 12,
//     layout: BufferLayout.struct([
//       BufferLayout.u8("instruction"),
//       BufferLayout.blob(8, "amount"),
//       BufferLayout.blob(32, "mint"),
//     ]),
//   },
// });

export function isSystemProgram(programId: PublicKey) {
  if (!!programId) {
    return programId.equals(SystemProgram.programId);
  }
  return false;
}

export function isTokenProgram(programId: PublicKey) {
  if (!!programId) {
    return programId.equals(TOKEN_PROGRAM_ID);
  }
  return false;
}

export function isAssociatedTokenProgram(programId: PublicKey) {
  if (!!programId) {
    return programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID);
  }
  return false;
}

export function addressToPublicKey(address: string): PublicKey {
  return new PublicKey(address);
}
