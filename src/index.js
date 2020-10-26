
/**
 * Axel Framework module.
 * The axel framework is a library for implementing some sensible default on expressjs
 * @module axel-core
 */

import  axel  from './axel.js';
export { Server } from './Server.js';
export { router } from './router.js';
export { models } from './models.js';

export {default as SchemaValidator} from './services/SchemaValidator.js';
export {default as AxelAdmin} from './services/AxelAdmin.js';
export {default as AxelManager} from './services/AxelManager.js';
export {default as DocumentManager} from './services/DocumentManager.js';

export {default as AuthService, tokenDecryptMiddleware} from './services/AuthService.js';



export { ExtendedError } from './services/ExtendedError.js';
export * from './services/AxelAdmin.js';

if (!axel.init) {
  axel.init();
}


export default axel;