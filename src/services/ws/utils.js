const debug = require('debug')('axel:manager');
const fs = require('fs');
const serialize = require('serialize-javascript');
const _ = require('lodash');

module.exports.catchSignal = (signal, times = 1) => new Promise((resolve, reject) => {
  process.once(signal, () => {
    try {
      times -= 1;
      debug('[AXELMANAGER] Captured interruption signal....', times);
      if (times <= 0) {
        setTimeout(() => {
          process.kill(process.pid, signal);
          if (times < -10) {
            process.exit();
          }
        }, 1000);
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  });
});


const serializeSchema = (name, schema) => {
  const schemaPath = `${process.cwd()}/src/api/models/schema/${_.upperFirst(name)}.js`;

  fs.writeFileSync(
    schemaPath,
    `
    /* eslint max-len: "warn" */
    module.exports = ${serialize({ ...schema, em: undefined, entity: undefined }, { space: 2, unsafe: true })}`,
    { encoding: 'utf8' }
  );
};


module.exports.serializeModel = (name, schema) => {
  const modelPath = `${process.cwd()}/src/api/models/sequelize/${_.upperFirst(name)}.js`;

  fs.writeFileSync(
    modelPath,
    `module.exports = ${serialize({ ...schema, em: undefined, entity: undefined }, { space: 2, unsafe: true })}`,
    { encoding: 'utf8' }
  );
};

module.exports.saveModel = (frontModel) => {
  if (!frontModel) {
    throw new Error('model_not_found');
  }
  if (!frontModel.identity) {
    console.log('frontModel', frontModel);

    throw new Error('model_identity_not_found');
  }
  if (!axel.models[frontModel.identity]) {
    throw new Error(`model_identity_not_found_${frontModel.identity}`);
  }
  const modelName = frontModel.identity;
  console.log('saving', modelName);
  debug('Saving', modelName);
  const inMemoryModel = _.cloneDeep({
    ...axel.models[modelName], em: undefined, repository: undefined, entity: undefined, hooks: undefined
  });
  // front model data
  const {
    primaryKeyField,
    primaryKey,
    displayField,
    schema,
  } = frontModel;
  const modelToSave = _.merge(inMemoryModel, {
    primaryKeyField,
    primaryKey,
    displayField,
    schema: { ...inMemoryModel.schema, ...schema },
    admin: {
      ...inMemoryModel.admin,
      ...frontModel
    }
  });

  [
    'id',
    'identity',
    'schema',
    'primaryKeyField',
    'primaryKey',
    'displayField',
    'admin',
    'entity',
    'entity',
    'url',
    'em',
    'entity',
    'tableName',
    'repository',
    'hooks',
  ].forEach(f => delete modelToSave.admin[f]);
  [
    'em',
    'entity',
    'repository',
    'tableName',
    'hooks',
    'id',
  ].forEach(f => delete modelToSave[f]);
  serializeSchema(modelName, modelToSave);

  return frontModel;
};


module.exports.serializeSchema = serializeSchema;
