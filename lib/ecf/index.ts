// SERVER/WORKER ONLY: This module uses Node.js APIs (crypto, fs, streams) and handles
// sensitive cryptographic keys. NEVER import anything from lib/ecf into client components.

import dotenv from 'dotenv';
import P12Reader from './P12Reader';
import Signature from './Signature/Signature';
import ECF from './ecf';
export * from './networking';
export * from './transformers';
export * from './utils';
export * from './senderReceiver';
export * from './customAuthentication';

dotenv.config({ quiet: true });

if (process.env.CURRENT_ENV !== 'test') {
}

export { ECF, P12Reader, Signature };
export type { DGIIDocumentType } from './Signature/Signature';
export default ECF;
