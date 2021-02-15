const Ajv = require('ajv');
const _ = require('lodash');
const debug = require('debug')('axel:schemavalidator');


function getGrammaticalSingular(type) {
  switch (type) {
    case 'string':
      return 'a string';
    case 'number':
      return 'a number';
    case 'integer':
      return 'an integer';
    case 'object':
      return 'an object';
    case 'array':
      return 'an array';
    case 'boolean':
      return 'a boolean';
    case 'null':
      return 'null';
    default:
      return `a ${type}`;
  }
}

function getFieldName(error) {
  return (
    error.params.missingProperty
    || error.params.additionalProperty
    || (error.dataPath && error.dataPath.replace('.', ''))
  );
}

function getFormatErrorMessage(error) {
  switch (error.params.format) {
    case 'date-time':
    case 'date':
      return 'should be a date';
    case 'email':
      return 'should be a valid email address';
    case 'ipv4':
      return 'should be a dotted-quad IPv4 address';
    case 'ipv6':
      return 'should be a valid IPv6 address';
    case 'uri':
      return 'should be a valid uri';
    default:
      return JSON.stringify(error);
  }
}

function getValidMessage(error) {
  switch (error.keyword) {
    case 'required':
      return 'is required';
    case 'minimum':
      return `must be greater than ${error.params.limit}`;
    case 'maximum':
      return `must be less than ${error.params.limit}`;
    case 'type':
      return `should be ${getGrammaticalSingular(error.params.type)}`;
    case 'minLength':
      return `must be longer than ${error.params.limit} characters`;
    case 'maxLength':
      return `must be shorter than ${error.params.limit} characters`;
    case 'maxItems':
      return `must have no more than ${error.params.limit} items`;
    case 'minItems':
      return `must have at least ${error.params.limit} items`;
    case 'format':
      return getFormatErrorMessage(error);
    case 'pattern':
      return 'has invalid format';
    case 'additionalProperties':
      return 'additional property not allowed';
    default:
      return error.message;
  }
}

function addMessage(fields, error, fieldName) {
  const field = fieldName || getFieldName(error);
  const message = getValidMessage(error);

  if (!fields[field]) {
    fields[field] = [];
  }

  fields[field].push(`${field} ${message}`);
}

function normaliseErrorMessages(errors) {
  axel.logger.log(errors);
  const fields = {};
  errors.forEach((error) => {
    addMessage(fields, error);
  });

  return {
    fields,
  };
}

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      removeAdditional: false,
      extendRefs: true,
    });
    this.ajvStrict = new Ajv({
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      removeAdditional: true,
      extendRefs: true,
    });

    this.validators = {};
    this.strictValidators = {};
    this.missingSchemas = {};
    this.initialized = false;
  }

  init() {
    axel.logger.info('VALIDATOR: INIT');
    this.loadSchemas();
    this.initialized = true;
  }

  loadSchemas() {
    /* eslint-disable */

    let existingSchemas = Object.keys(axel.models).filter(i => axel.models[i].schema)
      .length;
    axel.logger.info('VALIDATOR :: loading schemas', existingSchemas);
    if (!this.ajv) {
      throw new Error('error_missing_ajv_validator');
    }
    while (existingSchemas > Object.keys(this.validators).length) {
      Object.keys(axel.models).forEach((key) => this.loadSchema(axel.models[key]));
    }
  }

  loadSchema(definition) {
    const identity = definition.identity;
    debug('VALIDATOR :: loading %s ', identity);
    if (!definition.schema) {
      //  throw new Error('VALIDATOR :: no schema for ' + identity);
      console.warn('VALIDATOR :: no schema for ' + identity);
      return;
    }
    if (!this.validators[identity] && axel.models[identity].schema) {
      debug('loading schema for %s', identity);
      try {
        // @ts-ignore
        this.validators[identity] = this.ajv.compile(axel.models[identity].schema);
        if (this.ajvStrict) {
          this.strictValidators[identity] = this.ajvStrict.compile(axel.models[identity].schema);
        }
      } catch (e) {
        axel.logger.warn('Error on schema %s', identity);
        axel.logger.warn(e);
        if (!e.missingRef || this.missingSchemas[e.missingRef] > 3) {
          axel.logger.warn(e);
          throw e;
        }
        this.missingSchemas[e.missingRef] = this.missingSchemas[e.missingRef]
          ? (this.missingSchemas[e.missingRef] += 1)
          : 1;
        axel.logger.warn('retrying', e.missingRef);
      }
    }
    debug('VALIDATOR :: loading %s complete', identity);
  }

  validate(data, model, options = { strict: false }) {
    let result = { isValid: true, context: model };
    try {
      const validator =
        options && options.strict ? this.strictValidators[model] : this.validators[model];
      if (typeof validator === 'function') {
        result.isValid = this.validators[model](data);
      } else {
        axel.logger.warn(
          'VALIDATOR :: ' + model + ' validator is not a function',
          typeof validator,
        );
        result.isValid = false;
        return result;
      }
    } catch (e) {
      axel.logger.warn('model issues', e, model);
    }
    if (!result.isValid) {
      // result = normalize(this.validators[model.toLowerCase()].errors);
      result.errors = normaliseErrorMessages(this.validators[model].errors);
      result.formatedErrors = _.flattenDeep([
        Object.keys(result.errors.fields).map(index => result.errors.fields[index]),
      ]);
      result.rawErrors = this.validators[model].errors;
    }
    return result;
  }
}

module.exports = new SchemaValidator();
