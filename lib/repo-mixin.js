'use strict'

var { Repo, Schema } = require('mzen');
var clone = require('clone');

class ServerErrorRepoNotFound extends Error {}

class ServerRepoMixin
{
  _find(requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery));
    this._applyAclConditions(query.where, aclConditions);
    return this.find(query.where, query.fields, query.options);
  }
  async _findOne(requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery));
    this._applyAclConditions(query.where, aclConditions);
    var object = await this.findOne(query.where, query.options);
    if (!object || Object.keys(object).length == 0) {
      throw new ServerErrorRepoNotFound;
    }
    return object;
  }
  _count(requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery), 'count');
    this._applyAclConditions(query.where, aclConditions);
    return this.count(query.where, query.fields, query.options);
  }
  async _findByPkey(pkey, requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery));
    query.where[this.config.pkey] = pkey;
    this._applyAclConditions(query, aclConditions);
    var object = await this.findOne(query.where, query.options);
    if (!object || Object.keys(object).length == 0) {
      throw new ServerErrorRepoNotFound;
    }
    return object;
  }
  async _existsByPkey(pkey, requestQuery, aclConditions)
  {
    requestQuery = requestQuery ? requestQuery : {};
    var query = this._parseQuery(clone(requestQuery));
    query.where[this.config.pkey] = pkey;
    this._applyAclConditions(query.where, aclConditions);
    var fields = {};
    fields[this.config.pkey] = 1;
    var objects = await this.findOne(query.where, fields, query.options);
    if (!objects || Object.keys(objects).length == 0) {
      throw new ServerErrorRepoNotFound;
    }
  }
  _upsertOne(requestBody, aclConditions)
  {
    const data = requestBody;
    var where = {};
    where[this.config.pkey] = data[this.config.pkey];
    this._applyAclConditions(where, aclConditions);
    return this.updateOne(where, {$set: data}, {upsert: true, filterPrivate: true});
  }
  _updateOneByPkey(pkey, requestBody, aclConditions)
  {
    const data = requestBody;
    var where = {};
    where[this.config.pkey] = pkey;
    this._applyAclConditions(where, aclConditions);
    return this.updateOne(where, {$set: data}, {filterPrivate: true});
  }
  _insert(requestBody)
  {
    const data = requestBody;
    var insertMethod = Array.isArray(data) ? 'insertMany' : 'insertOne';
    return this[insertMethod](data, {filterPrivate: true});
  }
  _updateOne(requestBody, aclConditions)
  {
    const data = requestBody;
    var where = {};
    where[this.config.pkey] = data[this.config.pkey];
    this._applyAclConditions(where, aclConditions);
    return this.updateOne(where, {$set: data}, {filterPrivate: true});
  }
  _deleteOneByPkey(pkey, requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery));
    query.where[this.config.pkey] = pkey;
    this._applyAclConditions(where, aclConditions);
    return this.deleteOne(query.where, query.options);
  }
  _applyAclConditions(where, aclConditions)
  {
    if (aclConditions) {
      const pkey = this.config.pkey;
      Object.keys(aclConditions).forEach(key => {
        key = (this.config.name + 'Id' == key) ? pkey : key;
        where[key] = aclConditions[key];
      });
    }
  }
  _parseQuery(query, mode)
  {
    const apiConfig = this.config.api;
    const maxResults = apiConfig && apiConfig.maxResults ? apiConfig.maxResults : 1000;
    const filter = query && query.filter ? query.filter : undefined;
    const where = filter && filter.where ? filter.where : {};
    const fields = filter && filter.fields ? filter.fields : undefined;
    const limit = filter && filter.limit ? Schema.TypeCaster.cast(Number, filter.limit) : undefined;
    const limitFinal = (!limit || (limit > maxResults && mode != 'count')) ? maxResults : limit;
    const skip = filter && filter.skip ? Schema.TypeCaster.cast(Number, filter.skip) : undefined;
    const sort = filter && filter.sort ? filter.sort : undefined;

    var options = {};
    options.filterPrivate = true; // For the API we always want to filter private fields
    if (limitFinal) options.limit = limitFinal;
    if (skip) options.skip = skip;
    if (sort) options.sort = sort;

    let result = {
      where,
      fields,
      options
    };

    return result;
  }
}

ServerRepoMixin.endpoints =
{
  'get-find': {
    path: '/',
    method: '_find',
    verbs: ['get'],
    groups: ['default', 'read'],
    args: [
      {srcName: 'requestQuery', src: 'query'},
      {src: 'acl-conditions'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    },
    acl: {}
  },
  'get-findOne': {
    path: '/findOne',
    method: '_findOne',
    verbs: ['get'],
    groups: ['default', 'read'],
    args: [
      {srcName: 'requestQuery', src: 'query'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    }
  },
  'get-count': {
    path: '/count',
    method: '_count',
    verbs: ['get'],
    groups: ['default', 'read'],
    args: [
      {srcName: 'requestQuery', src: 'query'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    }
  },
  'get-findByPkey': {
    path: '/:pkey',
    method: '_findByPkey',
    verbs: ['get', 'head'],
    groups: ['default', 'read'],
    args: [
      {srcName: 'pkey', src: 'param', type: 'ObjectID'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}},
        ServerErrorRepoNotFound: {http: {code: 404}}
      }
    }
  },
  'get-existsByPkey': {
    path: '/:pkey/exists',
    method: '_existsByPkey',
    verbs: ['get'],
    groups: ['default', 'read'],
    args: [
      {srcName: 'pkey', src: 'param'},
      {srcName: 'requestQuery', src: 'query-root'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}},
        ServerErrorRepoNotFound: {http: {code: 404}}
      }
    }
  },
  'head-existsByPkey': {
    path: '/:pkey',
    method: '_existsByPkey',
    verbs: ['head'],
    groups: ['default', 'read'],
    args: [
      {srcName: 'pkey', src: 'param'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}},
        ServerErrorRepoNotFound: {http: {code: 404}}
      }
    }
  },
  'put-upsertOne': {
    path: '/',
    method: '_upsertOne',
    verbs: ['put'],
    groups: ['default', 'write'],
    args: [
      {srcName: 'requestBody', src: 'body'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    }
  },
  'put-updateOneByPkey': {
    path: '/:pkey',
    method: '_updateOneByPkey',
    verbs: ['put'],
    groups: ['default', 'write'],
    args: [
      {srcName: 'pkey', src: 'path-param'},
      {srcName: 'requestBody', src: 'body'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    }
  },
  'post-insert': {
    path: '/',
    method: '_insert',
    verbs: ['post'],
    groups: ['default', 'write'],
    args: [
      {srcName: 'requestBody', src: 'body'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    }
  },
  'post-updateOne': {
    path: '/update',
    method: '_updateOne',
    verbs: ['post'],
    groups: ['default', 'write'],
    args: [
      {srcName: 'requestBody', src: 'body'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    }
  },
  'delete-deleteOneByPkey': {
    path: '/:pkey',
    method: '_deleteOneByPkey',
    verbs: ['delete'],
    groups: ['default', 'write'],
    args: [
      {srcName: 'pkey', src: 'param'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}}
      }
    }
  }
};

module.exports = ServerRepoMixin;
