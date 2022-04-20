const debug = require('debug')('axel:errors');
const ErrorUtils = require('../services/ErrorUtils');

function developmentErrorHandler(err, req, res, next) {
  const { code, message, errors } = ErrorUtils.errorCallback(err);
  console.warn('[axel][errorMiddleware]', req.path, code, message, err.stack, JSON.stringify(errors));
  if (res.headersSent) {
    return next(err);
  }

  return res.status(code || 422).json({
    message: `[errorMiddleware] ${message}`,
    code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : '',
    errors,
  });
}

function productionErrorHandler(err, req, res, next) {
  const { message, errors, code } = ErrorUtils.errorCallback(err);
  debug('[axel][errorMiddleware]', req.path, code, message, err.stack, JSON.stringify(errors));
  if (res.headersSent) {
    return next(err);
  }

  return res.status(code || 422).json({ message, errors, code });
}

module.exports = process.env.NODE_ENV === 'development' ? developmentErrorHandler : productionErrorHandler;
module.exports.productionErrorHandler = productionErrorHandler;
module.exports.developmentErrorHandler = developmentErrorHandler;
