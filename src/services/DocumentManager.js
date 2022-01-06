/**
 * [exports description]
 * @type {Object}
 *
 * document  {_id:string, externalId:string, name:string, url:string, data:string,
 *            type:string, mimetype: string, size: float, entity:string, entityId: FK}
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mkdirp = require('mkdirp');
const _ = require('lodash');
const Utils = require('../services/Utils.js');

let s3;

const getStorage = (pathSuffix, filePrefix) => {
  const destPath = path.join(process.cwd(), pathSuffix || 'assets/data');
  fs.mkdirSync(destPath, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destPath);
    },
    filename: (req, file, cb) => {
      const fileName = file.originalname;
      const fileNameParts = fileName.split('.');

      cb(null, `${filePrefix ? `${filePrefix}-` : ''}${Utils.slugify(fileNameParts[0])}.${fileNameParts.pop()}`);
    }
  });
};

const DocumentManager = {
  storage: 'local',
  s3,

  httpUpload(
    req,
    res,
    options = { path: '', filePrefix: '' }
  ) {
    const promise = new Promise((resolve, reject) => {
      // don't allow the total upload size to exceed ~10MB
      // @ts-ignore
      const storage = getStorage(options.path || '', options.filePrefix || 'file');

      multer({
        storage,
        limits: {
          fieldSize: 250 * 1024 * 1024
        }
      }).single('file')(req, res, (err) => {
        if (err) {
          return reject(err);
        }
        const filePath = req.file.path.replace(process.cwd(), '').replace('/public', '');
        req.file.publicUrl = `${axel.config.cdnUrl || axel.config.appUrl}${filePath}`;
        resolve(
          `${axel.config.cdnUrl || axel.config.appUrl}${filePath}`
        );
      });

      /*
      req.file('file').upload(
        {
          dirname: path.resolve('assets/data', options.path),
        },
        (err, uploadedFiles: []) => {
          if (err) {
            return reject(err);
          }

          if (uploadedFiles.length === 0) {
            return reject(new Error('no_file_uploaded'));
          }

          resolve(uploadedFiles);
        },
      );
      */

      //  adapter: require('skipper-s3'),
      // req.file('file').upload({
      //   maxBytes: req.body.maxSize || 2000000000,
      //   dirname: `../../assets/data/${options.path}`,
      // }, (err, uploadedFiles) => {
      //   if (err) {
      //     return reject(err);
      //   }

      //   // If no files were uploaded, respond with an error.
      //   if (uploadedFiles.length === 0) {
      //     return reject(new Error('No file was uploaded'));
      //   }

      //   const ext = uploadedFiles[0].filename.split('.').pop() || '';
      //   const hash = uploadedFiles[0].fd.split('/').pop();
      //   const path = `${options.path}/${hash}`;
      //   const cdnUrl = `${axel.config.appUrl}/data/${path}`;
      //   const awsUrl = `https://s3.${
      //     axel.config.aws.region
      //   }.amazonaws.com/${
      //     axel.config.aws.bucket
      //   }/${
      //     options.path
      //   }/${
      //     hash}`;

      //   const params = {
      //     Bucket: axel.config.aws.bucket,
      //     Key: `${options.path}/${hash}`,
      //     ACL: 'public-read',
      //     ContentType: uploadedFiles[0].type,
      //     Body: fs.readFileSync(uploadedFiles[0].fd)
      //   };
      //   this.s3.putObject(params, (errAws, awsData) => {
      //     let isAws;
      //     if (errAws) {
      //       isAws = false;
      //       axel.logger.warn('Error  while uploading data to myBucket/', errAws);
      //     } else {
      //       isAws = true;
      //       axel.logger.warn('Successfully uploaded data to myBucket/', awsData);
      //       fs.unlink(uploadedFiles[0].fd);
      //     }

      //     const out = {
      //       id: hash,
      //       size: uploadedFiles[0].size,
      //       mimetype: uploadedFiles[0].type,
      //       type: uploadedFiles[0].type,
      //       extension: ext,
      //       name: uploadedFiles[0].filename,
      //       path,
      //       url: isAws ? awsUrl : cdnUrl,
      //       awsId: awsData
      //     };
      //     resolve(out);
      //   });
      // });
    });
    return promise;
  },

  base64Upload(image,
    options = {}) {
    options = _.merge({
      targetFolder: '/data/workshop/', filename: '', includeHost: true, publicPath: '/public/'
    }, options);
    const filename = options.filename || `${Date.now()}-${_.random(100000)}-${Utils.md5(image.name)}.${image.name.split('.').pop()}`;
    const host = axel.config.cdnUrl || axel.config.appUrl;
    let filepath = `${options.targetFolder || '/data/'}${filename}`;
    filepath = filepath.replace(/\/\//g, '/');
    const base64 = image && image.base64;
    let fullPath = `${process.cwd()}/${options.publicPath}/${filepath}`;
    mkdirp.sync(`${process.cwd()}/${options.publicPath}/${options.targetFolder || '/data/'}`);
    fullPath = fullPath.replace(/\/\//g, '/');
    fs.writeFileSync(fullPath,
      Buffer.from(base64, 'base64'));

    return { url: `${options.includeHost ? host : ''}${filepath}`, path: fullPath };
  },

  deleteFile(imageUrl, resp,
    options = {}) {
    options = _.merge({
      targetFolder: '/data/', publicPath: '/public/'
    }, options);
    return new Promise((resolve, reject) => {
      if (!imageUrl) {
        return reject(new Error('missing_file_to_delete'));
      }
      const host = axel.config.cdnUrl || axel.config.appUrl;
      let oldImage = imageUrl.replace(host, '');
      if (oldImage[0] && oldImage[0] === '/') {
        oldImage = oldImage.substr(1);
      }
      try {
        let fullPath = `${process.cwd()}/${options.publicPath}/${oldImage}`;
        fullPath = fullPath.replace(/\/\//g, '/');
        fs.unlinkSync(`${fullPath}`);
        resolve(true);
      } catch (err) {
        console.warn(err.message, imageUrl);
        reject(err);
      }
    });
  },

  post(
    document,
    options = {
      storage: null,
      entity: null,
      entityId: null
    }
  ) {
    axel.logger.info(options);
  },

  // duplicate(doc, options, entityId, entity) {
  //   if (_.isArray(doc)) {
  //     const promises = doc.map(data => this.duplicate(data, options, entityId, entity));
  //     return Promise.all(promises);
  //   }
  //   return new Promise((resolve, reject) => {
  //     const newKey = `${ Date.now() } -${ doc.id } `;

  //     const docCopy = _.clone(doc);
  //     delete docCopy.createdOn;
  //     delete docCopy.createdBy;
  //     delete docCopy.lastModifiedOn;
  //     delete docCopy.lastModifiedBy;
  //     delete docCopy._id;
  //     docCopy.entity = entity;
  //     docCopy.entityId = entityId;
  //     docCopy.createdOn = new Date();

  //     if (doc.awsId) {
  //       const params = {
  //         Bucket: axel.config.aws.bucket,
  //         CopySource: `${ axel.config.aws.bucket } /${doc.path}`,
  //         Key: `${options.path}/${newKey}`,
  //         ACL: 'public-read'
  //       };

  //       this.s3.copyObject(params, (err, awsData) => {
  //         if (err) {
  //           reject(err);
  //         }
  //         docCopy.awsId = awsData;

  //         docCopy.url = `https://s3.${
  //           axel.config.aws.region
  //         }.amazonaws.com/${
  //           axel.config.aws.bucket
  //         }/${
  //           options.path
  //         }/${
  //           newKey}`;
  //         docCopy.id = newKey;
  //         docCopy.path = `${options.path}/${newKey}`;
  //         resolve(docCopy);
  //       });
  //       return;
  //     }
  //     // fixme duplicate of files that are in local system is not working
  //     try {
  //       if (doc.path) {
  //         fs.createReadStream(doc.path)
  //           .pipe(fs.createWriteStream(doc.path.replace(doc.key, docCopy.key)));
  //         docCopy.url = `${axel.config.appUrl}/data/${newKey}`;
  //       }
  //       resolve(docCopy);
  //     } catch (err) {
  //       if (err) {
  //         reject(err);
  //       }
  //     }
  //   });
  // },

  delete(doc) {
    return new Promise((resolve, reject) => {
      // if (doc.indexOf('assets') !== -1) {
      //   doc = doc.substr(doc.indexOf('/assets') + 7);
      // }
      // if (doc.indexOf('/public') !== -1) {
      //   doc = doc.substr(doc.indexOf('/public') + 7);
      // }
      if (doc.indexOf(axel.config.appUrl) !== -1) {
        doc = doc.replace(axel.config.appUrl, '');
      }
      fs.unlink(`${process.cwd()}/${doc}`, (err) => {
        if (err) {
          if (err.code && err.code === 'ENOENT') {
            resolve(true);
          }
          reject(err);
          return;
        }
        resolve(true);
      });
    });
  }
};

module.exports = DocumentManager;
module.exports.DocumentManager = DocumentManager;
