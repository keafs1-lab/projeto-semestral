"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = __importDefault(require("node:crypto"));
function hashPassword(password) { const salt = node_crypto_1.default.randomBytes(16).toString('hex'); const hash = node_crypto_1.default.scryptSync(password, salt, 64).toString('hex'); return `${salt}:${hash}`; }
function verifyPassword(password, encoded) { const [salt, hash] = encoded.split(':'); if (!salt || !hash)
    return false; const derived = node_crypto_1.default.scryptSync(password, salt, 64).toString('hex'); return node_crypto_1.default.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex')); }
