/* eslint-disable global-require, import/no-dynamic-require */
const fs = require('fs');
const _ = require('lodash');
const d = require('debug');
const path = require('path');

const debug = d('axel:models');
const { DataTypes } = require('sequelize');
const axel = require('./axel.js');
const logger = require('./services/logger');
const { models } = require('./axel.js');

const hooksCache = {};
axel.hooks = hooksCache;
const pluginsHooksLocations = [];
const loadHook = (model) => {
  if (model.hooks) {
    return;
  }
  debug('Loading hooks for', model.identity);
  const filePath = path.resolve(
    _.get(axel, 'config.framework.hooksLocation')
    || `${process.cwd()}/src/api/models/hooks`,
    `${_.upperFirst(model.identity)}.js`
  );
  const filePathLc = path.resolve(
    _.get(axel, 'config.framework.hooksLocation')
    || `${process.cwd()}/src/api/models/hooks`,
    `${model.identity}.js`
  );

  if (fs.existsSync(filePath)) {
    model.hooks = require(filePath);
    debug('Loaded hooks from', filePath);
  } else if (fs.existsSync(filePathLc)) {
    model.hooks = require(filePathLc);
    debug('Loaded hooks from', filePathLc);
  } else {
    // @fixme reduce the amount of fs calls. by searching all locations at once
    // @fixme use a for loop for the locations.
    for (const pluginData of Object.values(axel.plugins)) {
      if (fs.existsSync(`${pluginData.resolvedPath}/models/hooks/${model.identity}.js`)) {
        model.hooks = require(`${pluginData.resolvedPath}/models/hooks/${model.identity}.js`);
        debug('Loaded hooks from', `${pluginData.resolvedPath}/models/hooks/${model.identity}.js`);
        break;
      } else if (fs.existsSync(`${pluginData.resolvedPath}/dist/models/hooks/${model.identity}.js`)) { // if plugin is typescript compiled
        model.hooks = require(`${pluginData.resolvedPath}/dist/models/hooks/${model.identity}.js`);
        debug('Loaded hooks from', `${pluginData.resolvedPath}/dist/models/hooks/${model.identity}.js`);
        break;
      } else if (fs.existsSync(`${pluginData.resolvedPath}/src/models/hooks/${model.identity}.js`)) { // if plugin is in a source folder
        model.hooks = require(`${pluginData.resolvedPath}/src/models/hooks/${model.identity}.js`);
        debug('Loaded hooks from', `${pluginData.resolvedPath}/src/models/hooks/${model.identity}.js`);
        break;
      }
    }
  }
  if (!model.hooks) {
    model.hooks = {};
    debug('⚠️ no hooks found in ', filePath, filePathLc);
  }
  hooksCache[model.identity] = model.hooks;
  return hooksCache[model.identity];
};

const loadSchemaModel = (filePath) => {
  debug('Loading schema model', filePath);
  /* eslint-disable */
  let model = require(`${path.resolve(filePath)}`);
  /* eslint-enable */

  if (!model.identity) {
    console.warn('[ORM] model identity not found in', filePath, model);

    throw new Error(`[ORM] missing identity for ${filePath}`);
  }

  if (model.collectionName && axel.mongodb) {
    model.collection = axel.mongodb.db().collection(model.collectionName);
  }
  loadHook(model);
  debug('Loaded schema model => ', model.identity);
  const existingModel = axel.models[model.identity] || {};
  axel.models[model.identity] = _.merge(existingModel, model);
  return axel.models[model.identity];
};

const loadSqlAttributes = (model) => {
  Object.entries(model.entity.attributes).forEach(([, attr]) => {
    if (typeof attr.type === 'string') {
      const type = attr.type
        .replace('DataTypes.', '')
        .replace('sequelize.', '')
        .replace(/\(.+\)/, '');
      const args = attr.type.match(/\(.+\)/);
      const resolvedType = _.get(DataTypes, type);
      if (resolvedType) {
        attr.type = resolvedType;
        if (args && args[0]) {
          attr.type = attr.type(
            ...args[0]
              .replace(/\(|\)/g, '')
              .split(',')
              .map(s => s.replace(/["']/g, '').trim())
          );
        }
      }
    }
  });
};


const loadSqlModel = (filePath, sequelize, options) => {
  if (sequelize) {
    logger.verbose('[ORM] loading sequelize model  %s', filePath);

    let model;
    let hooks;
    try {
      /* eslint-disable */
      model = require(`${path.resolve(filePath)}`);
      if (!options || options.loadHooks) {
        hooks = loadHook(model);
      }
    } catch (err) {
      console.warn('[ORM][WARN] ', filePath, err);
    }

    if (!model) {
      throw new Error('missing_model_' + filePath);
    }

    /* eslint-enable */
    const tableName = model.entity && model.entity.options && model.entity.options && model.entity.options.tableName;
    logger.verbose('Loading identity', model);

    const existingModel = axel.models[model.identity] || {};
    model = _.merge(existingModel, model);

    // loading hooks
    if (hooks && Object.keys(hooks).length) {
      debug('Loading hooks for', model.identity);
      model.hooks = hooks;
      if (!_.has(model, 'entity.options.hooks')) {
        model.entity.options.hooks = {};
      }
      Object.keys(hooks).forEach((hookName) => {
        if (!hookName.includes('Api') && !model.entity.options.hooks[hookName]) {
          // do not send api hooks to sequelize
          model.entity.options.hooks[hookName] = model.hooks[hookName];
        }
      });
      model.hooks = hooks;
    }

    debug('Loading entity', model.identity);
    if (!model.identity) {
      throw new Error(`[ORM]  missing sql identity for ${filePath}`);
    }
    if (!model.entity) {
      throw new Error(`[ORM]  missing sql entity for ${filePath}`);
    }
    if (!tableName) {
      throw new Error(`[ORM]  missing sql tableName for ${filePath}`);
    }

    if (!model.entity.options) {
      model.entity.options = {};
    }

    model.entity.options = _.merge(
      {
        freezeTableName: true,
        query: {
          raw: true
        }
      },
      model.entity.options
    );

    if (model.entity.attributes) {
      loadSqlAttributes(model);
    }

    const SqlModel = sequelize.define(
      _.upperFirst(_.camelCase(model.identity)),
      model.entity.attributes,
      model.entity.options
    );
    // SqlModel.sequelize = Sequelize;

    axel.models[model.identity] = model;
    axel.models[model.identity].em = SqlModel;
    // @deprecated
    axel.models[model.identity].repository = SqlModel;
    axel.models[model.identity].tableName = tableName;

    return axel.models[model.identity];
  }
  logger.verbose('[ORM] skipping file %s', filePath);
};

const getSchemaFileListForSingleLocation = (modelsLocation) => {
  debug('getSchemaFileListForSingleLocation');

  return new Promise((resolve, reject) => {
    if (!modelsLocation) {
      resolve([]);
    }

    debug(`[ORM] loading schema models from ${modelsLocation}`);

    fs.readdir(modelsLocation, (err, files) => {
      if (err) {
        logger.warn(err);
        return reject(err);
      }

      files = files.filter(file => _.endsWith(file, '.js') || _.endsWith(file, '.mjs') || _.endsWith(file, '.ts'));
      debug('[ORM] found %s schemas files', files.length, modelsLocation);
      debug('Loading schema models: ', files.length, 'files');

      const filePathList = files.map(file => `${modelsLocation}/${file}`);

      resolve(filePathList);
    });
  });
};

const loadSchemaModels = () => {
  debug('loadSchemaModels');
  return new Promise((resolve, reject) => {
    debug('[ORM] loading schema models');
    const commonModelsLocation = _.get(axel, 'config.framework.schemasLocation') || `${process.cwd()}/src/api/models/schema`;

    if (!axel.models) {
      axel.models = {};
    }

    const modelLocations = [commonModelsLocation];
    for (const pluginData of Object.values(axel.plugins)) {
      if (pluginData && pluginData.resolvedPath) {
        // if plugin is in the root folder
        if (fs.existsSync(`${pluginData.resolvedPath}/models/schema`)) {
          modelLocations.push(`${pluginData.resolvedPath}/models/schema`);
        } else if (fs.existsSync(`${pluginData.resolvedPath}/dist/models/schema`)) { // if plugin is typescript compiled
          modelLocations.push(`${pluginData.resolvedPath}/dist/models/schema`);
        } else if (fs.existsSync(`${pluginData.resolvedPath}/src/models/schema`)) { // if plugin is in a source folder
          modelLocations.push(`${pluginData.resolvedPath}/src/models/schema`);
        }
      }
    }

    Promise.all(modelLocations.map(location => getSchemaFileListForSingleLocation(location)))
      .then(fileLists => _.flatten(fileLists))
      .then(filesToLoad => Promise.all(filesToLoad.map((filePath) => {
        logger.verbose('[ORM] loading schema model', filePath);
        return loadSchemaModel(filePath);
      })))
      .then(() => {
        logger.debug('[ORM] schema final callback');
        debug('[ORM] schema final callback');
        return resolve();
      })
      .catch((errAsync) => {
        logger.warn(errAsync);
        debug(errAsync);
        return reject(errAsync);
      });
  });
};

/**
 * @description load all the sql defined models
 */
const loadSqlModels = (options = { loadHooks: true }) => {
  debug('loadSqlModels');
  return new Promise(async (resolve, reject) => {
    const sqlModels = {};
    debug('ORM : loading sql models');
    logger.debug('ORM : loading sql models');
    if (!(axel.config && axel.config.sqldb && axel.config.sqldb.host)) {
      debug('ORM : ⚠️ no sql configured');
      return resolve();
    }
    let sequelize;
    try {
      // eslint-disable-next-line
      sequelize = require('./services/SqlDB.js');

      axel.sqldb = sequelize;
      if (axel.sqldb.then) {
        axel.sqldb = await axel.sqldb;
        sequelize = axel.sqldb;
      }
    } catch (err) {
      console.error(err);
    }

    const commonModelsLocation = _.get(axel, 'config.framework.modelsLocation', `${process.cwd()}/src/api/models/sequelize`);
    const modelLocations = [commonModelsLocation];

    for (const pluginData of Object.values(axel.plugins)) {
      if (pluginData && pluginData.resolvedPath) {
        // if plugin is in the root folder
        if (fs.existsSync(`${pluginData.resolvedPath}/models/sequelize`)) {
          modelLocations.push(`${pluginData.resolvedPath}/models/sequelize`);
        } else if (fs.existsSync(`${pluginData.resolvedPath}/dist/models/sequelize`)) { // if plugin is typescript compiled
          modelLocations.push(`${pluginData.resolvedPath}/dist/models/sequelize`);
        } else if (fs.existsSync(`${pluginData.resolvedPath}/src/models/sequelize`)) { // if plugin is in a source folder
          modelLocations.push(`${pluginData.resolvedPath}/src/models/sequelize`);
        }
      }
    }

    debug('[ORM] sql models locations', modelLocations.join('\n'));

    if (!axel.models) {
      axel.models = {};
    }

    const modelFilePaths = [];

    modelLocations.forEach((location) => {
      try {
        const singleLocationFilePaths = fs.readdirSync(location).filter(
          filePath => _.endsWith(filePath, '.js') || _.endsWith(filePath, '.mjs') || _.endsWith(filePath, '.ts')
        ).map((filePath => `${location}/${filePath}`));
        modelFilePaths.push(...singleLocationFilePaths);
      } catch (err) {
        console.error('[ORM] sequelize models location not found\n', err.message);
        process.exit(-1);
      }
    });

    logger.info('[ORM] found %s sequelize models files', modelFilePaths.length);
    debug('MODELS :: found %s sequelize models files', modelFilePaths.length);
    if (!modelFilePaths.length) {
      logger.warn('[ORM] no sequelize models found in the provided location');
    }

    const loadedModels = modelFilePaths.map((filePath) => {
      const model = loadSqlModel(filePath, sequelize, options);
      sqlModels[model.identity] = model.em;
      return model;
    });

    try {
      logger.verbose('[ORM] loading associations');
      debug('[ORM] loading associations', loadedModels.map(m => m.identity));

      Object.keys(loadedModels).forEach((key) => {
        const model = loadedModels[key];
        if (model.entity && model.entity.attributes) {
          Object.keys(model.entity.attributes).forEach((field) => {
            const fieldDefinition = model.entity.attributes[field];
            /*
            if (fieldDefinition.references) {
              // console.log('Auto linking ', model.identity, field, fieldDefinition);
              // sqlModels[model.identity].belongsTo(sqlModels[fieldDefinition.references.model], {
              //   foreignKey: field,
              //   sourceKey: fieldDefinition.references.key,
              // });
              // only do the inverse link if there is no existing

                if (
                  !sqlModels[fieldDefinition.references.model].associations[
                    fieldDefinition.references.model.name
                  ]
                )
                  sqlModels[fieldDefinition.references.model].hasMany(
                    sqlModels[model.identity],
                    {
                      foreignKey: field,
                      targetKey: fieldDefinition.references.key,
                    }
                  );

            }
            */
          });
        }
        if (model.entity && model.entity.associations) {
          model.entity.associations(sqlModels);
        }
        if (model.entity && model.entity.defaultScope && model.entity.defaultScope instanceof Function) {
          model.repository.addScope('defaultScope', model.entity.defaultScope(sqlModels), {
            override: true
          });
        }
      });

      debug('[ORM] sequelize final callback');
      resolve(axel);
    } catch (errAsync) {
      logger.warn(errAsync);
      return reject(errAsync);
    }
  });
};

const findModelsDifferences = () => new Promise((resolve, reject) => {
  try {
    /* eslint-disable */
    logger.verbose('[ORM] compare definitions');
    logger.info('\n\n\n');
    logger.info('___________________________');
    const diffTable1 = [];
    const diffTable2 = [];
    Object.keys(axel.models).forEach(key => {
      const model = axel.models[key];
      if (model.entity && model.schema) {
        const sqlProperties = Object.keys(model.entity.attributes);
        const jsonProperties = Object.keys(model.schema.properties);
        // skipping timestamp props
        if (model.entity.options && model.entity.options.timestamps) {
          const options = model.entity.options;
          sqlProperties.push(options.createdAt || 'createdAt');
          sqlProperties.push(options.updatedAt || 'updatedAt');
        }

        let diff1 = _.difference(sqlProperties, jsonProperties);
        let diff2 = _.difference(jsonProperties, sqlProperties);
        if (diff1.length) {
          diffTable1.push({ model: key, fields: diff1.join(' | ') })
        }
        if (diff2.length) {
          diffTable2.push({ model: key, fields: diff2.join(' | ') })
        }
      }
    });
    if (diffTable1.length) {
      logger.warn('[ORM] Fields present in sql but not in json');
      console.table(diffTable1);
    }
    if (diffTable2.length) {
      logger.warn('[ORM] Fields present in json but not in sql');
      console.table(diffTable2);
    }
    /* eslint-enable */
    logger.info('___________________________');
    logger.info('\n\n\n');
    resolve();
  } catch (err) {
    reject(err);
  }
});

function unifyEntityManagers() {
  /* eslint-disable */
  Object.keys(axel.models).forEach(key => {
    const model = axel.models[key];
    if (model.repository) {
      model.em = model.repository;
      model.em.unifiedFind = function (query, options = {}) {
        if (!query) {
          return this.find(query, options);
        }
        query = {
          where: query,
          limit: options && options[1] ? options[1].limit : undefined,
          offset: options && options[1] ? options[1].skip : 0,
        };

        return this.findAll(query, options);
      };
      // FIND ONE
      model.em.unifiedFindOne = function (query, options) {
        if (!query) {
          return this.find(query, options);
        }
        query = {
          where: query,
          returning: true,
          limit: options && options[1] ? options[1].limit : undefined,
          offset: options && options[1] ? options[1].skip : 0,
        };

        return this.findOne(query, options);
      };
      // UPDATE
      model.em.unifiedUpdate = function (query, options) {
        try {
          if (!query || !options) {
            return this.update(query, options);
          }
          const newQuery = {
            where: query,
            returning: true,
          };
          const itemToUpdate = options.$set ? options.$set : options;

          return this.update(itemToUpdate, newQuery);
        } catch (err) {
          console.error(err);
          return err;
        }
      };

      // UPDATE
      model.em.unifiedFindOneAndUpdate = function (query, options) {
        return model.em.unifiedUpdate(query, options);
      };

      // COUNT
      model.em.unifiedCount = function (query, options) {
        return model.em.count(
          {
            where: query,
          },
          options
        );
      };

      // INSERT
      model.em.unifiedInsert = function (query, options, moreOptions) {
        return this.create(query, options, moreOptions);
      };

      // DELETE
      model.em.unifiedRemove = function (query) {
        if (!query) {
          return this.destroy(query);
        }
        const newQuery = {
          where: query,
        };
        return this.destroy(newQuery);
      };
    }
    if (model.collection) {
      injectUnifiedFunctions(model);
    }
  });
  return;
}

function injectUnifiedFunctions(model) {
  model.em = model.collection;
  model.em.unifiedFind = model.em.find;
  model.em.unifiedFindOne = model.em.findOne;
  model.em.unifiedUpdate = model.em.update;
  model.em.unifiedInsert = model.em.insert;
  model.em.unifiedRemove = model.em.remove;
  model.em.unifiedFindOneAndUpdate = model.em.findOneAndUpdate;
  model.em.unifiedCount = model.em.count;
}

async function modelsLoader(app) {
  await loadSchemaModels();
  await loadSqlModels();
  await loadHook({ identity: '_global' });
  if (process.env.NODE_ENV === 'development') {
    await findModelsDifferences();
  }
  await unifyEntityManagers();
  return Promise.resolve();
}

module.exports.loadSchemaModels = loadSchemaModels;
module.exports.loadSchemaModel = loadSchemaModel;
module.exports.loadSqlModels = loadSqlModels;
module.exports.loadSqlModel = loadSqlModel;
module.exports.findModelsDifferences = findModelsDifferences;
module.exports.modelsLoader = modelsLoader;
