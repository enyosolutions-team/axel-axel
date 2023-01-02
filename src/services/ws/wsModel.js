/* eslint-disable max-lines-per-function,promise/no-callback-in-promise */
const fs = require('fs');
const serialize = require('serialize-javascript');
const _ = require('lodash');
const debug = require('debug')('@axel:manager:wsModel');
const {
  generateModel,
  cliFieldToSequelizeField,
  sequelizeFieldToSchemaField,
} = require('axel-cli');
const axel = require('../../axel');
const { schemaModelsFolder, sequelizeModelsFolder } = require('../../config');
const AxelModelsService = require('../AxelModelsService');
const {
  catchSignal, serializeSchema, serializeModel, saveModel
} = require('./utils');


const requireWithoutCache = (path) => {
  const modelPath = require.resolve(path);
  const cachedModel = require.cache[modelPath];
  delete require.cache[modelPath];
  // eslint-disable-next-line
  const model = require(path);
  delete require.cache[modelPath];
  require.cache[modelPath] = cachedModel;
  return model;
};


const getMergedModel = modelName => Promise.all([
  axel.models.axelModelConfig.em.findAll({
    where: {
      identity: modelName
    },
    logging: false
  }),
  axel.models.axelModelFieldConfig.em
    .findAll({
      where: {
        parentIdentity: modelName,
      },
      logging: false
    })
])
  .then(AxelModelsService.loadDbModelsInMemory)
  .then(mappedSavedConfig => AxelModelsService.mergeDbModelsWithInMemory(mappedSavedConfig, { prepareNestedModels: false, identity: modelName }))
  .then(models => models.find(m => m.identity === modelName));


module.exports = (socket) => {
  /** Get models definition */
  socket.on('/admin-panel/admin-models', (req = { method: 'GET', query: {}, body: {} }, cb) => {
    if (typeof req === 'function') {
      cb = req;
    }
    switch (req.method) {
      case 'GET':
        AxelModelsService.serveModels(req).then((models) => {
          cb(null, { body: models });
        })
          .catch(err => cb(err.message));
        break;
      default:
        break;
    }
  });

  socket.on('/admin-panel/models', async (req = { method: 'GET', query: {}, body: {} }, cb) => {
    if (typeof req === 'function') {
      cb = req;
    }
    const {
      name, type, force, fields, withSchema
    } = req.body;
    switch (req.method) {
      case 'GET':
      default:
        if (!axel.sqldb) {
          return cb('sqldb_not_ready');
        }
        // eslint-disable -next-line
        let tables = await axel.sqldb.query(axel.sqldb.options.dialect === 'postgres'
          ? `SELECT *
        FROM pg_catalog.pg_tables
        WHERE schemaname != 'pg_catalog' AND
            schemaname != 'information_schema';`
          : 'show tables');
        tables = tables.map(t => Object.values(t)[0]);
        try {
          const models = Object.entries(axel.models).filter(([, modelDef]) => modelDef.entity)
            .map(([modelName, modelDef]) => ({
              name: modelName,
              fields: Object.keys(modelDef.entity.attributes).map(idx => ({
                name: idx,
                ...modelDef.entity.attributes[idx],
                type: modelDef.properties,
              })),
            }));
          cb(null, {
            body: {
              models,
              tables,
            },
          });
        } catch (err) {
          cb(err.message || err);
        }

        break;
      case 'POST':

        if (!name) {
          return cb('missing_param_name');
        }
        if (!type) {
          return cb('missing_param_type');
        }
        if (!fields || !fields.length) {
          return cb('missing_fields');
        }
        if (!fields.some(f => f.primaryKey)) {
          return cb('missing_primary_key');
        }
        try {
          let types = [type];
          if (withSchema) {
            types.push('schema');
            types = _.uniq(types);
          }
          generateModel({
            name,
            types,
            force,
            fields,
          });
          cb(null, { body: 'OK' });
        } catch (err) {
          console.warn('[AXELMANAGER]', err);
          cb(err.message || 'See terminal for more details');
        }
        break;
      case 'DELETE':
        const modelPath = `${sequelizeModelsFolder}/${_.upperFirst(name)}.js`;
        const schemaPath = `${schemaModelsFolder}/${_.upperFirst(name)}.js`;
        try {
          fs.unlinkSync(modelPath);
          fs.unlinkSync(schemaPath);
          cb(null, 'OK');
          process.kill(process.pid, 'SIGUSR2');
        } catch (err) {
          console.warn(err);
          cb(err.message || err);
        }
        break;
    }
  });
  socket.on('/admin-panel/models/add-fields', async (req = { method: 'PUT', query: {}, body: {} }, cb) => {
    if (typeof req === 'function') {
      cb = req;
    }

    switch (req.method) {
      default:
        cb('Incorrect method used');
        break;
      case 'POST':
        const {
          withSchema, fields, sync
        } = req.body;
        if (!req.body || !req.body.model) {
          return cb('Missing model name');
        }
        const modelName = `${req.body.model}`;

        if (!fields || !fields.length) {
          return cb('missing_fields');
        }
        try {
          const modelPath = `${sequelizeModelsFolder}/${_.upperFirst(modelName)}.js`;
          const model = requireWithoutCache(modelPath);
          const schemaPath = `${schemaModelsFolder}/${_.upperFirst(modelName)}.js`;
          const schema = requireWithoutCache(schemaPath);
          fields.forEach((field) => {
            const sequelizeField = cliFieldToSequelizeField(field);
            model.entity.attributes[field.name] = {
              ...sequelizeField,
            };

            if (withSchema) {
              schema.schema.properties[field.name] = sequelizeFieldToSchemaField(field.name, sequelizeField);
            }
          });

          catchSignal('SIGUSR2', 5);

          serializeModel(modelName, model);
          serializeSchema(modelName, schema);

          if (sync) {
            axel.models[model.identity].em.sync({ alter: true }, { logging: true });
          }
          cb(null, { body: 'OK' });
        } catch (err) {
          console.warn('[AXELMANAGER]', err);
          cb(err.message || 'See terminal for more details');
        }
    }
  });

  socket.on('/admin-panel/models/sync', (req = { method: 'GET', query: {}, body: {} }, cb) => {
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
        const em = id === '$ALL' ? axel.sqldb : axel.models[id] && axel.models[id].em;
        if (!em) {
          return cb(`error_while_accessing_model${JSON.stringify(id)}`);
        }
        axel.logger.log('[AXELMANAGER] syncing sql model', id, { force, alter });
        em.sync({ force, alter }, { logging: true })
          .then(() => {
            cb(null, { body: 'OK' });
          })
          .catch((err) => {
            console.warn('[AXELMANAGER]', err);
            cb(err.message || 'See terminal for more details');
          });
        break;
    }
  });

  /** Reset all the details saved in the data base for models. */
  socket.on('/admin-panel/reset-models-config', (req = { method: 'POST', query: {}, body: {} }, cb) => {
    if (typeof req === 'function') {
      cb = req;
    }
    switch (req.method) {
      case 'GET':
      default:
        break;
      case 'POST':
        AxelModelsService.clearModelsInDb()
          .then(() => {
            cb();
            process.kill(process.pid, 'SIGUSR2');
          })
          .catch(cb);
    }
  });
};
