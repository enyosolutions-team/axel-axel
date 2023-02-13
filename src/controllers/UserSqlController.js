/**
 * UserSqlController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://links.axel.s.org/docs/controllers
 */

const _ = require('lodash');
const Utils = require('../services/Utils');
const ErrorUtils = require('../services/ErrorUtils.js'); // adjust path as needed
const { ExtendedError, axel } = require('../index');
const AuthService = require('../services/AuthService');
// const MailService = require('../services/MailService');

const adminConfig = _.get(axel, 'config.plugins.admin.config', {});
const userModelName = _.get(adminConfig, 'userModelName', 'user');
const rolesWithAccessToBackoffice = _.get(
  adminConfig,
  'rolesWithAccessToBackoffice',
  _.get(axel, 'config.framework.rolesWithAccessToBackoffice', ['ADMIN'])
);

let primaryKey = axel.config.framework.primaryKey;

class UserSqlController {
  constructor() {
    this.userModel = axel.models[userModelName];
    if (
      this.userModel
      && this.userModel
      && this.userModel.em
      && this.userModel.em.primaryKeyField
    ) {
      primaryKey = this.userModel.em.primaryKeyField;
    }
  }

  /**
   * @swagger
   *
   * /user:
   *   post:
   *     description: Create a user (registration)
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: user
   *         description: User object
   *         in:  body
   *         required: true
   *         type: string
   *         schema:
   *           $ref: '#/definitions/User'
   *     responses:
   *       200:
   *         description: users
   *         schema:
   *           $ref: '#/definitions/User_ItemResponse'
   */
  async create(req, res) {
    // eslint-disable-line max-lines-per-function
    let token;
    if (!req.body.email) {
      return res.status(400).json({
        errors: ['error_missing_email'],
        message: 'error_missing_email',
      });
    }

    if (!req.body.password) {
      return res.status(400).json({
        errors: ['error_missing_password'],
        message: 'error_missing_password',
      });
    }

    if (!req.body.username) {
      if (axel.config.framework.user.username) {
        return res.status(400).json({
          errors: ['error_missing_username'],
          message: 'error_missing_username',
        });
      }
      req.body.username = req.body.email;
    }

    let newUser = req.body;
    newUser.email = newUser.email.toLowerCase();
    newUser.username = newUser.username.toLowerCase();
    newUser.isActive = true;
    const userModel = this.userModel;
    const existingUsersCount = await userModel.em.count();
    userModel.em
      .findOne({
        where: {
          email: newUser.email,
        },
        raw: true,
      })
      .then((user) => {
        if (user) {
          throw new ExtendedError({
            code: 400,
            stack: 'error_conflict_email',
            message: 'error_conflict_email',
            errors: ['error_conflict_email'],
          });
        }
        if (!newUser.roles) {
          newUser.roles = JSON.stringify(['USER']);
        }
        if (existingUsersCount === 0) {
          newUser.isActive = true;
          newUser.roles = ['USER', ...rolesWithAccessToBackoffice];
        }

        return AuthService.beforeCreate(newUser);
      })
      .then((data) => {
        if (data) {
          return userModel.em.create(newUser, {
            raw: true,
          });
        }
        throw new Error('password_encoding_error');
      })
      .then((result) => {
        if (result && result.dataValues) {
          newUser = result.dataValues;

          if (newUser.roles && typeof newUser.roles === 'string') {
            try {
              newUser.roles = JSON.parse(newUser.roles);
            } catch (e) {
              axel.logger.warn(e);
            }
          }

          // If user created successfuly we return user and token as response
          token = AuthService.generateToken(newUser);

          if (axel.config.framework.user.emailConfirmationRequired) {
            newUser.activationToken = Utils.md5(
              `${Date.now() + Math.random() * 1000}`
            );
            newUser.isActive = false;
          } else {
            newUser.isActive = true;
            delete newUser.activationToken;
          }

          return userModel.em.update(newUser, {
            where: {
              [primaryKey]: newUser[primaryKey],
            },
          });
        }
        throw new Error('user_not_created');
      })
      .then(async () => {
        if (
          newUser
          && newUser[primaryKey]
          && axel.config.framework.user.emailConfirmationRequired
        ) {
          if (!axel.services.mailService) {
            console.warn(
              '[warn] no mailService registered, please inject the mail service ',
              'into axel.services.mailService = <your mail service> '
            );
            return false;
          }
          const activationToken = newUser.activationToken;

          const activationUrl = `${axel.config.apiUrl
            || axel.config.frontendUrl
            || axel.config.websiteUrl
            }/api/axel-admin/auth/confirm/${newUser.id}?token=${activationToken}`;
          console.warn('activationUrl', activationUrl);
          return axel.services.mailService.sendEmailConfirmation({
            user: Object.assign(
              {
                activationToken,
                activationUrl,
              },
              newUser
            ),
            activationToken,
            activationUrl,
          });
        }
        return true;
      })
      // eslint-disable-next-line no-undef
      .then(() => {
        if (newUser[primaryKey]) {
          res.status(200).json({
            user: Utils.sanitizeUser(newUser),
            token,
          });
        } else {
          res.status(503).json({
            errors: ['user_not_saved'],
            message: 'user_not_saved',
          });
        }
        return null;
      })
      .catch((err) => {
        axel.logger.warn(err && err.message ? err.message : err);
        ErrorUtils.errorCallback(err, res);
      });
  }

  findAll(req, resp) {
    const { listOfValues, startPage, limit } = Utils.injectPaginationQuery(req);

    const options = {
      limit,
      skip: startPage * limit,
    };

    let query = Utils.injectQueryParams(req);

    if (req.query.search) {
      query = Utils.injectSqlSearchParams(req.query.search, query, {
        modelName: 'user',
      });
    }
    if (req.query.roles) {
      query.roles = {
        [axel.sqldb.Op.like]: axel.sqldb.literal(`'%"${req.query.roles}"%'`),
      };
    }
    query = Utils.cleanSqlQuery(query);
    const userModel = this.userModel;

    userModel.em
      .findAndCountAll({ where: query, raw: false, nested: true }, options)
      .then((result) => {
        let data;
        if (result && Array.isArray(result.rows)) {
          data = result.rows.map((user) => {
            delete user.encryptedPassword;
            if (user.roles && typeof user.roles === 'string') {
              try {
                user.roles = JSON.parse(user.roles);
              } catch (e) {
                axel.logger.warn(e);
              }
            }
            return Utils.sanitizeUser(user);
          });

          if (listOfValues) {
            data = data.map(item => ({
              [primaryKey]: item[primaryKey].toString(),
              label: Utils.formatName(
                item.firstname,
                item.lastname,
                item.username,
                true
              ),
            }));
          }
          return resp.status(200).json({
            body: data,
            page: startPage,
            count: limit,
            totalCount: result.count,
          });
        }
        return resp.status(200).json({
          body: [],
        });
      })
      .catch((err) => {
        resp.status(500).json({
          errors: [err.message],
          message: err.message,
        });
      });
  }

  findOne(req, resp) {
    const id = req.params.userId;
    const listOfValues = req.query.listOfValues
      ? req.query.listOfValues
      : false;
    const userModel = this.userModel;
    userModel.em
      .findByPk({
        [primaryKey]: id,
      })
      .then((doc) => {
        if (!doc) {
          return resp.status(404).json({
            message: 'not_found',
            errors: ['not_found'],
          });
        }
        doc = doc.get();
        if (doc.roles && typeof doc.roles === 'string') {
          try {
            doc.roles = JSON.parse(doc.roles);
          } catch (e) {
            axel.logger.warn(e);
          }
        }

        if (listOfValues) {
          return resp.status(200).json({
            body: {
              [primaryKey]: doc[primaryKey].toString(),
              label: Utils.formatName(
                doc.firstName,
                doc.lastName,
                doc.username,
                true
              ),
            },
          });
        }

        delete doc.password;
        delete doc.encryptedPassword;
        return resp.status(200).json({
          body: Utils.sanitizeUser(doc),
        });
      })
      .catch((err) => {
        resp.status(500).json({
          errors: [err],
          message: err.message,
        });
      });
  }

  exists(req, resp) {
    const username = req.query.username;
    const email = req.query.email;
    if (!username && !email) {
      return resp.status(400).json({
        errors: ['missing_argument'],
        message: 'missing_argument',
      });
    }

    const userModel = this.userModel;

    userModel.em
      .findOne(
        username
          ? { where: { username: `${username}` } }
          : { where: { email: `${email}` } }
      )
      .then((doc) => {
        if (doc) {
          return resp.status(200).json({
            body: true,
          });
        }
        return resp.status(200).json({
          body: false,
        });
      })
      .catch((err) => {
        ErrorUtils.errorCallback(err, resp);
      });
  }

  update(req, res) {
    let user;
    const newUser = req.body;
    let data;
    const id = req.params.userId;

    if (req.body.email === null) {
      if (axel.config.framework.user.email) {
        return res.status(404).json({
          errors: ['error_missing_email'],
          message: 'error_missing_email',
        });
      }
    }

    if (req.body.username === null) {
      if (axel.config.framework.user.username) {
        return res.status(404).json({
          errors: ['error_missing_username'],
          message: 'error_missing_username',
        });
      }
      req.body.username = req.body.email;
    }

    const userModel = this.userModel;

    userModel.em
      .findByPk(id)
      .then((u) => {
        user = u;
        if (!user) {
          throw new ExtendedError({
            code: 404,
            stack: 'not_found',
            message: 'not_found',
            errors: ['not_found'],
          });
        }

        if (typeof user.roles === 'string') {
          try {
            user.roles = JSON.parse(user.roles);
          } catch (e) {
            user.roles = ['USER'];
          }
        }

        // prevent frontend from hijacking encrypted password
        delete req.body.encryptedPassword;

        // PREVENT USERS FROM MODIFYING USERS ROLES·
        if (!(req.user && AuthService.hasRole(req.user, 'ADMIN'))) {
          delete newUser.roles;
        }
        if (
          user.roles.indexOf('DEVELOPER') > -1
          && newUser.roles
          && newUser.roles.indexOf('DEVELOPER') === -1
        ) {
          newUser.roles.push('DEVELOPER');
        }

        data = _.merge({}, user, newUser);
        data.roles = newUser.roles;

        if (data.password) {
          return AuthService.beforeUpdate(data);
        }
        return data;
      })
      .then(() => {
        if (data) {
          return userModel.em.update(data, {
            where: {
              [primaryKey]: id,
            },
          });
        }
        return null;
      })
      .then((doc) => {
        if (doc) {
          if (data.roles && typeof data.roles === 'string') {
            try {
              data.roles = JSON.parse(data.roles);
            } catch (e) {
              axel.logger.warn(e);
            }
          }
        }
        return null;
      })
      .then(() => userModel.em.findByPk(parseInt(id)))
      .then((userData) => {
        delete userModel.encryptedPassword;
        userData = userData.toJSON ? userData.toJSON() : userData;
        res.json({
          user: Utils.sanitizeUser(userData),
        });
        return null;
      })
      .catch((err) => {
        ErrorUtils.errorCallback(err, res);
      });
  }

  updateOne(req, res, next) {
    return this.update(req, res, next);
  }

  delete(req, resp) {
    const id = req.params.userId;
    if (!Utils.checkIsMongoId(id, resp)) {
      return false;
    }

    const userModel = this.userModel;
    const collection = userModel.em;
    collection
      .findByPk(id)
      .then((user) => {
        if (!user) {
          throw new ExtendedError({
            code: 404,
            message: `User with id ${id} wasn't found`,
            errors: [`User with id ${id} wasn't found`],
          });
        }

        const deletedSuffix = `deleted-${Date.now()}-${Math.floor(
          Math.random() * 100000 + 1
        )}`;
        return collection.destroy({
          where: {
            [primaryKey]: user[primaryKey],
          },
        });
        /*
        // this section is in case of soft deletion
        return collection
          .update(
            {
              email: `${user.email}-${deletedSuffix}`,
              phonenumber: `${user.phonenumber}-${deletedSuffix}`,
              facebookId: null,
              googleId: null,
              deactivated: true,
              deactivatedOn: new Date(),
            },
            {
              where: {
                [primaryKey]: user[primaryKey],
              },
            },
          );
          */
      })
      .then(() => resp.status(200).json({
        body: true,
      }))
      .catch((err) => {
        ErrorUtils.errorCallback(err, resp);
      });
  }


  deleteOne(req, res, next) {
    return this.delete(req, res, next);
  }
}

module.exports = new UserSqlController();
