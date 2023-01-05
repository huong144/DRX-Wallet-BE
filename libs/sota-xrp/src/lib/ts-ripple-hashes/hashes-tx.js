"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ripple_hashes_1 = __importStar(require("ripple-hashes"));
function hashesTx(rawTx) {
    return ripple_hashes_1.computeBinaryTransactionHash(rawTx);
}
exports.hashesTx = hashesTx;
