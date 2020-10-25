import { axel } from '../axel.js';
import _ from 'lodash';
import socketIO from 'socket.io';
import axelCli from 'axel-cli';
const { generateController, generateModel, generateApi, generateRoute } = axelCli;



/**
 * Contains all the code necessary for bootstrapping the code manager page.
 *
 * @class AxelAdmin
 */
class AxelManager {
  /**
   *
   *
   * @param {Application} app
   * @returns {Promise<any>}
   * @memberof AxelAdmin
   */
  init(app) {
    console.log('\n\n\n\n\n\n', 'WS for axelManager opening');
    const io = socketIO(app.locals.server);
    app.locals.io = io;
    io.on('connect', function (socket) {
      console.log('WS client connected', socket.id);
      let counter = 0;

      socket.on(
        '/axel-manager/api',
        async (req = { method: 'GET', query: {}, body: {} }, cb) => {
          if (typeof req === 'function') {
            cb = req;
          }
          switch (req.method) {
            case 'GET':
              break;
            case 'POST':
              const { name, type, force, fields, withSchema } = req.body;
              if (!name) {
                return cb('missing_param_name');
              }
              try {
                generateApi({
                  name,
                  type,
                  force,
                  fields: fields && fields.map((f) => f.name),
                  withSchema,
                });
                let count = withSchema ? 4 : 3;
                // catching api signals in order for the file to generate properly
                process.on('SIGUSR2', function () {
                  console.log('Captured interruption signal....', count--);

                  if (count <= 0) {
                    setTimeout(() => {
                      process.kill(process.pid, 'SIGUSR2');
                    }, 1000);

                  }
                });
                cb(null, { body: 'OK' });
              } catch (err) {
                cb(err);
              }
          }
        },
      );

      socket.on(
        '/axel-manager/models',
        async (req = { method: 'GET', query: {}, body: {} }, cb) => {
          if (typeof req === 'function') {
            cb = req;
          }
          switch (req.method) {
            case 'GET':
            default:
              if (!axel.sqldb) {
                return (cb('sqldb_not_ready'))
              }
              let tables = await axel.sqldb.query('show tables');
              tables = tables.map((t) => Object.values(t)[0]);
              cb(null, {
                body: {
                  models: Object.keys(axel.models),
                  tables,
                },
              });
              break;
            case 'POST':
              const { name, type, force, fields } = req.body;
              if (!name) {
                return cb('missing_param_name');
              }
              generateModel({ name, types: [type], force, fields });
              cb(null, { body: 'OK' });
          }
        },
      );

      socket.on(
        '/axel-manager/models/sync',
        (req = { method: 'GET', query: {}, body: {} }, cb) => {
          if (typeof req === 'function') {
            cb = req;
          }
          switch (req.method) {
            case 'POST':
            default:
              if (!req.body) {
                return cb('missing_param_body');
              }
              // @ts-ignore
              const { id, force, alter } = req.body;
              if (!id) {
                return cb('missing_param_body');
              }
              const em = id === '$ALL' ? axel.sqldb : axel.models[id].em;

              em.sync({ force, alter })
                .then((result) => {
                  cb(null, { body: 'OK' });
                })
                .catch((err) => {
                  console.warn(err)
                  cb(err.message || 'See terminal for more details');
                });
              break;
            //  cb(null, { body: axel.models });
          }
        },
      );

      socket.on(
        '/axel-manager/controllers',
        (req = { method: 'GET', query: {}, body: {} }, cb) => {
          if (typeof req === 'function') {
            cb = req;
          }

          switch (req.method) {
            case 'GET':
            default:
              cb(null, { body: axel.controllers });
              break;
            case 'POST':
              const { name, type, force } = req.body;
              if (!name) {
                return cb('missing_param_name');
              }
              try {
                generateController({ name, type: type || 'bare', force });
                cb(null, {
                  body: 'ok',
                });
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  axel.logger.warn(err);
                }
                if (err && err.name === 'SequelizeValidationError') {
                  cb({
                    //@ts-ignore
                    errors: err.errors && err.errors.map((e) => e.message),
                    message: 'sql_validation_error',
                  });
                  return false;
                }
                cb(err);
              }
          }
        },
      );

      socket.on(
        '/axel-manager/routes',
        (req = { method: 'GET', query: {}, body: {} }, cb) => {
          if (typeof req === 'function') {
            cb = req;
          }
          switch (req.method) {
            case 'GET':
              cb(null, { body: axel.config.routes });
              break;
            case 'POST':
              //cb(null, { body: axel.models });
              const { name } = req.body;

              if (!name) {
                return cb(new Error('missing_param_name'));
              }

              try {
                generateRoute(name);
                cb(null, {
                  body: 'ok',
                });
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  axel.logger.warn(err);
                }
                if (err && err.name === 'SequelizeValidationError') {
                  cb({
                    //@ts-ignore
                    errors: err.errors && err.errors.map((e) => e.message),
                    message: 'sql_validation_error',
                  });
                  return false;
                }
                cb(err);
              }
          }
        },
      );

      socket.on(
        '/axel-manager/restart-app',
        (req = { method: 'GET', query: {}, body: {} }, cb) => {
          if (typeof req === 'function') {
            cb = req;
          }
          switch (req.method) {
            case 'GET':
              break;
            case 'POST':
              //cb(null, { body: axel.models });
              const { name } = req.body;

              if (!name) {
                return cb(new Error('missing_param_name'));
              }

              try {
                process.kill(process.pid, 'SIGTERM');
                cb(null, {
                  body: 'ok',
                });
              } catch (err) {
                cb(err)
              }
          }
        },
      );
    });
  }
}

export default new AxelManager();
