'use strict'

var Repo = require('mzen/lib/repo');
var TypeCaster = require('mzen/lib/type-caster');
var clone = require('clone');

class ServerErrorRepoNotFound extends Error {}

class ServerRepoMixin
{
  _find(requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery));
    this._applyAclConditions(query['where'], aclConditions);
    return this.find(query.where, query.options).then(function(objects){
      this.schema.stripPrivateFields(objects, 'read');
      return objects;
    }.bind(this));
  }
  _findOne(requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery));
    this._applyAclConditions(query['where'], aclConditions);
    return this.findOne(query.where, query.options).then(function(object){
      if (Object.keys(object).length > 0) {
        this.schema.stripPrivateFields(object, 'read');
        return Promise.resolve(object);
      } else {
        return Promise.reject(new ServerErrorRepoNotFound);
      }
    }.bind(this));
  }
  _count(requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery), 'count');
    this._applyAclConditions(query['where'], aclConditions);
    return this.count(query.where, query.options);
  }
  _findByPkey(pkey, requestQuery, aclConditions)
  {
    var query = this._parseQuery(clone(requestQuery));
    query.where[this.config.pkey] = pkey;
    this._applyAclConditions(query, aclConditions);
    return this.findOne(query.where, query.options).then(function(object){
      if (Object.keys(object).length > 0) {
        this.schema.stripPrivateFields(object, 'read');
        return Promise.resolve(object);
      } else {
        return Promise.reject(new ServerErrorRepoNotFound);
      }
    });
  }
  _existsByPkey(pkey, requestQuery, aclConditions)
  {
    requestQuery = requestQuery ? requestQuery : {};
    var query = this._parseQuery(clone(requestQuery));
    query.where[this.config.pkey] = pkey;
    this._applyAclConditions(query['where'], aclConditions);
    var fields = {};
    fields[this.config.pkey] = 1;
    return this.findOne(query.where, fields, query.options).then(function(objects){
      if (Object.keys(objects).length) {
        return Promise.resolve();
      } else {
        return Promise.reject(new ServerErrorRepoNotFound);
      }
    });
  }
  _upsertOne(requestBody, aclConditions)
  {
    const data = requestBody;
    this.schema.stripPrivateFields(data, 'write');
    var where = {};
    where[this.config.pkey] = data[this.config.pkey];
    this._applyAclConditions(where, aclConditions);
    return this.updateOne(where, {$set: data}, {upsert: true});
  }
  _updateOneByPkey(pkey, requestBody, aclConditions)
  {
    const data = requestBody;
    this.schema.stripPrivateFields(data, 'write');
    var where = {};
    where[this.config.pkey] = pkey;
    this._applyAclConditions(where, aclConditions);
    return this.updateOne(where, {$set: data});
  }
  _insert(requestBody)
  {
    const data = requestBody;
    this.schema.stripPrivateFields(data, 'write');
    var insertMethod = Array.isArray(data) ? 'insertMany' : 'insertOne';
    return this[insertMethod](data);
  }
  _updateOne(requestBody, aclConditions)
  {
    const data = requestBody;
    this.schema.stripPrivateFields(data, 'write');
    var where = {};
    where[this.config.pkey] = data[this.config.pkey];
    this._applyAclConditions(where, aclConditions);
    return this.updateOne(where, {$set: data});
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
    if (aclConditions && aclConditions['userId']) {
      if (this.config['name'] == 'user') {
        const pkey = this.config['pkey'];
        where[pkey] = aclConditions['userId'];
      } else {
        where['userId'] = aclConditions['userId'];
      }
    }
  }
  _parseQuery(query, mode)
  {
    const apiConfig = this.config['api'];
    const maxResults = apiConfig && apiConfig['maxResults'] ? apiConfig['maxResults'] : 1000;
    const filter = query && query['filter'] ? query['filter'] : undefined;
    const where = filter && filter['where'] ? filter['where'] : {};
    const limit = filter && filter['limit'] ? TypeCaster.cast(Number, filter['limit']) : undefined;
    const limitFinal = (!limit || (limit > maxResults && mode != 'count')) ? maxResults : limit;
    const skip = filter && filter['skip'] ? TypeCaster.cast(Number, filter['skip']) : undefined;
    const sort = filter && filter['sort'] ? filter['sort'] : undefined;
    
    var queryOptions = {};
    if (limitFinal) queryOptions['limit'] = limitFinal;
    if (skip) queryOptions['skip'] = skip;
    if (sort) queryOptions['sort'] = sort;
    
    // Convert sort query params to the format expected by the model
    var sortNew = [];
    for (let fieldName in sort) {
      sortNew.push([fieldName, sort[fieldName]]);
    }
    queryOptions['sort'] = sortNew;
  
    const result = {
      where: where,
      options: queryOptions
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
    groups: ['read'],
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
    groups: ['read'],
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
    groups: ['read'],
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
    groups: ['read'],
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
  'get-existsByPkey': {
    path: '/:pkey/exists',
    method: '_existsByPkey',
    verbs: ['get'],
    groups: ['read'],
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
    groups: ['read'],
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
    groups: ['write'],
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
    groups: ['write'],
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
    groups: ['write'],
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
    groups: ['write'],
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
    groups: ['write'],
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
