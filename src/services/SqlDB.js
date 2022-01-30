const Sequelize = require('sequelize');
const axel = require('../axel.js');

async function loadSequelize() {
  if (axel.config.sqldb) {
    const datastore = axel.config.sqldb;
    axel.logger.debug('[ORM] Connecting to database ', datastore.database);
    const sequelize = new Sequelize(datastore.database, datastore.user, datastore.password, {
      ...datastore,
      host: datastore.host,
      port: datastore.port,
      dialect: datastore.options.dialect,
      logging: datastore.options.logging,
      options: datastore.options,
      retry: datastore.retry,
      query: datastore.query ? datastore.query : {
        raw: false
      },
      pool: {
        max: 10,
        min: 1,
        acquire: 30000,
        idle: 20000,
        handleDisconnects: true
      },
      define: {
        charset: 'utf8',
        collate: 'utf8_general_ci'
      }
    });

    try {
      await sequelize.authenticate();
      axel.logger.warn(
        '[ORM] ✅ SQL DB Connection has been established successfully. %o',
        datastore.options
      );
      return sequelize;
    } catch (err) {
      axel.logger.error('[ORM] Unable to connect to the database:', err);
      process.exit(-1);
    }
  }
}
const sqlDB = loadSequelize();
module.exports = sqlDB;
