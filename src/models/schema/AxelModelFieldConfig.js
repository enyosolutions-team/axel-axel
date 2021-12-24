module.exports = {
  identity: 'axelModelFieldConfig',
  collectionName: 'axel-model-field-config',
  apiUrl: '/api/axel-admin/axel-model-field-config', // url for front api
  additionalProperties: false,
  automaticApi: true,
  autoValidate: true,
  displayField: 'name',
  schema: {
    $id: 'http://acme.com/schemas/axel-model-field-config.json',
    type: 'object',
    properties: {
      id: {
        $id: 'id',
        type: 'number',
        title: 'Config id', // serves for front form fields
        description: 'The id of this item', // serves for front form hint
        field: {
          required: false
        }
      },
      parentIdentity: {
        type: 'string',
        relation: 'axelModelConfig',
        field: {
          required: true,
          readonly: true,
          disabled: true,
          type: 'input'
        }
      },
      name: {
        type: 'string',
        field: {
          required: true
        }
      },
      title: {
        type: 'string',
        field: {
          required: true
        }
      },
      type: {
        type: ['string', 'array'],
        default: 'string',
        enum: ['string', 'number', 'array', 'object', 'integer', 'boolean'],
        column: {
        },
        field: {
        },
        items: {
          type: 'string'
        }
      },
      description: {
        type: ['null', 'string'],
        default: 'string',
        field: {}
      },
      enum: {
        type: ['string', 'array'],
        title: 'Possible values',
        description: 'The list of values to use for the select.',
        field: {
          type: 'vSelect',
          fieldOptions: {
            multiple: true,
            taggable: true
          }
        }
      },
      relation: {
        title: 'relation',
        type: ['null', 'string'],
        description: 'The object that this property is related to',
        examples: ['user'],
        field: {
          type: 'vSelect',
          fieldOptions: {
            taggable: true,
            url: '/api/axel-admin/models',
            label: 'name',
            trackBy: 'identity',
          }
        }
      },
      relationKey: {
        title: 'relationKey',
        type: ['null', 'string'],
        field: {
          type: 'vSelect',
          fieldOptions: {
            taggable: true,
            url: '/api/axel-admin/axel-model-field-config?filters%5B%5D=&filters%5BparentIdentity%5D={{ currentItem.relation }}',
            label: 'name',
            trackBy: 'name',
          }
        },
        description:
          'The field of the object that this property is related to (eg relation[foreignKey]). Leave empty to use the relation.primaryKeyField',
        examples: ['id']
      },
      relationLabel: {
        title: 'relationLabel',
        type: ['null', 'string'],
        description:
          'The field of the relation used to display. Leave empty to use the relation.displayField',
        field: {
          type: 'vSelect',
          fieldOptions: {
            taggable: true,
            url: '/api/axel-admin/axel-model-field-config?filters%5B%5D=&filters%5BparentIdentity%5D={{ currentItem.relation }}',
            label: 'name',
            trackBy: 'name',
          }
        },
        examples: ['user']
      },
      relationUrl: {
        title: 'relationUrl',
        type: ['null', 'string'],
        description:
          'the url to use to fetch the foreign object',
        examples: ['user']
      },
      field: {
        type: 'object',
        title: 'Configuration of the behavior of the property in forms',
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            description: 'The title of the field',
          },
          type: {
            type: 'string',
            title:
              'Field type',
            description: 'The type of the field Case sensisitive. custom types are also supported.',
            enum: ['string',
              'input',
              'number',
              'list-of-value',
              'list-of-data',
              'EnyoSelect',
              'dateTime',
              'DateRange',
              'textArea',
              'vSelect',
              'date',
              'datetime',
              'time',
              'ImagePicker',
              'FilePicker',
              'FileInput',
              'Base64Upload',
              'JsonTextarea',

            ]
          },
          inputType: {
            type: 'string',
            title:
              'Input type',
            description: 'Text input comming from https://vue-generators.gitbook.io/vue-generators/fields',
            field: {
              visible: "{{ !!currentItem.field &&currentItem.field.type === 'input' }}"
            }
          },
          required: {
            title: 'Required',
            type: ['boolean', 'string'],
            description: 'Form field value is required',
            field: {
              type: 'BooleanExpressionEditor'
            }
          },
          /*
          hidden: {
            title: 'Hidden',
            type: ['boolean', 'string'],
            description: 'Form field is displayed',
            field: {
              type: 'checkbox'
            }
          },
          */
          visible: {
            title: 'Visible',
            type: ['boolean', 'string'],
            description: 'Form field is displayed',
            field: {
              type: 'BooleanExpressionEditor'
            }
          },
          disabled: {
            title: 'Disabled',
            type: ['boolean', 'string'],
            description: 'Field is disabled',
            field: {
              type: 'BooleanExpressionEditor'
            }
          },
          readonly: {
            title: 'Readonly',
            type: ['boolean', 'string'],
            description: 'Field is read only',
            field: {
              type: 'BooleanExpressionEditor'
            }
          },

          styleClasses: {
            type: 'string',
            title: 'Css classes',
            description: 'The class that will be around the field',
            examples: ['col-md-12']
          },
          min: {
            type: 'number',
            title: 'Minimum number of characters',
            description: 'the minimum number of characters',
            field: {
              type: 'number'
            }
          },
          max: {
            type: 'number',
            title: 'Maximum number of characters',
            description: 'the maximum number of characters',
            field: {
              type: 'number'
            }
          },
          fieldOptions: {
            title: 'Field options',
            description: 'Options to be used on custom forms fields like multiselect, toggle etc',
            type: 'object',
            properties: {
              multiple: {
                type: 'boolean',
                title: 'Multiple select',
                description: 'If the select is multiple (for selects)',
                field: {
                  visible: "{{ !!currentItem.field && ['vSelect', 'select', 'EnyoSelect'].includes(currentItem.field.type) }}"
                }
              },
              enum: {
                type: ['string', 'array'],
                title: 'Values',
                description: `The list of values to use for the select. If the value is string
                  and starts with $store then the value is taken from the vuejs $store`,
                examples: ['$store.listOfValues.users'],
                field: {
                  visible: "{{ !!currentItem.field && ['vSelect', 'select', 'EnyoSelect'].includes(currentItem.field.type) }}"
                }
              },
              url: {
                type: 'string',
                title: 'c url',
                description: 'The url to use to load the data for the select (ajax) [vSelect]',
                examples: ['/user'],
                field: {
                  visible: "{{ !!(currentItem.field && currentItem.field.type === 'vSelect') }}"
                }
              },
              taggable: {
                type: 'boolean',
                title: 'Select accept new items',
                description: 'Select accept new items [vSelect]',
                examples: ['/user'],
                field: {
                  visible: "{{ !!(currentItem.field && currentItem.field.type === 'vSelect') }}"
                }
              },
              trackBy: {
                type: 'string',
                title: 'The field to use as the value in the select',
                examples: ['_id'],
                field: {
                  visible: "{{ !!currentItem.field && currentItem.field.type === 'vSelect' }}"
                }
              },
              label: {
                type: 'string',
                title: 'The field to use as the Label in the select',
                examples: ['username'],
                field: {
                  visible: "{{ !!currentItem.field && currentItem.field.type === 'vSelect' }}"
                }
              },
              disableRelationActions: {
                type: 'boolean',
                title: 'disableRelationActions on the select',
                field: {
                  visible: "{{ !!currentItem.field && currentItem.field.type === 'vSelect' && !!currentItem.relation  }}"
                }
              },
              prefix: {
                type: 'string',
                title: 'Text displayed before the value',
                description: 'example : £',
                examples: ['username']
              },

              suffix: {
                type: 'string',
                title: 'Text displayed before the value',
                description: 'example : cm | €',
                examples: ['username']
              },

              validator: {
                type: 'array',
                description:
                  'the validators used to validate fields https://vue-generators.gitbook.io/vue-generators/validation/built-in-validators'
              },

              displayOptions: {
                title: 'Display options',
                type: 'object',
                description: 'Options to be used specifically on view mode',
                properties: {
                  type: {
                    type: 'string',
                    title: 'Type of field for display',
                    enum: [
                      'string',
                      'number',
                      'boolean',
                      'url',
                      'image',
                      'date',
                      'datetime',
                      'checkbox',
                      'relation',
                      'object',
                    ],
                    description:
                      'The type that links to the display',
                  },
                }
              }
            }
          }
        }
      },
      column: {
        type: 'object',
        description: 'Configuration of the behavior of the property in lists',
        properties: {
          title: {
            type: 'string',
            title: 'The title of the field'
          },
          type: {
            description:
              'The type of the column, comming from https://vue-generators.gitbook.io/vue-generators/fields',
            type: 'string',
            enum: ['string', 'number', 'date', 'datetime', 'image', 'html', 'relation', 'object', 'boolean', 'url']
          },
          hidden: {
            type: 'string',
            description: 'If the form field is displayed',
            title: 'Hide this column'
          },
          prefix: {
            type: 'string',
            title: 'Text displayed before the value',
            description: 'example : £',
            examples: ['username']
          },

          suffix: {
            type: 'string',
            title: 'Text displayed before the value',
            description: 'example : cm | €',
            examples: ['username']
          }
        }
      },
      createdOn: {
        type: ['string', 'object'],
        format: 'date-time',
        field: { readonly: true },
        column: {
          type: 'datetime'
        }
      },
      lastModifiedOn: {
        type: ['string', 'object'],
        format: 'date-time',
        field: { readonly: true },
        column: {
          type: 'datetime'
        }
      }
    },
    required: ['parentIdentity', 'name']
  },
  admin: {
    routerPath: 'axel-model-field-config',
    name: 'Field config',
    namePlural: 'Fields configs',
    layout: {
      columns: [

      ]
    },
    actions: {
      create: false,
      edit: true,
      view: true,
      delete: true,
      export: true,
      import: true,
    },
    options: {
      detailPageMode: 'page',
      useCustomLayout: false
    }
  }
};
