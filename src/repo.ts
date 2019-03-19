import { TypeCaster, Repo, RepoConfig } from 'mzen';
import ServerConfigApi from './config-api';
import clone = require('clone');

export class ServerErrorRepoNotFound extends Error {}

export interface ServerRepoConfig extends RepoConfig
{
  api?: ServerConfigApi;
}

export class ServerRepo extends Repo 
{
  config: ServerRepoConfig;
  
  constructor(options?: ServerRepoConfig)
  {
    super(options);
  }
  
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
    return this.count(query.where, query.options);
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
    this._applyAclConditions(query.where, aclConditions);
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
  _parseQuery(query, mode?)
  {
    const apiConfig = this.config.api;
    const maxResults = apiConfig && apiConfig.maxResults ? apiConfig.maxResults : 1000;
    const filter = query && query.filter ? query.filter : undefined;
    const where = filter && filter.where ? filter.where : {};
    const fields = filter && filter.fields ? filter.fields : undefined;
    const limit = filter && filter.limit ? TypeCaster.cast(Number, filter.limit) : undefined;
    const limitFinal = (!limit || (limit > maxResults && mode != 'count')) ? maxResults : limit;
    const skip = filter && filter.skip ? TypeCaster.cast(Number, filter.skip) : undefined;
    const sort = filter && filter.sort ? filter.sort : undefined;

    var options = {
      filterPrivate: true, // For the API we always want to filter private fields
      limit: undefined,
      skip: undefined,
      sort: undefined
    };
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

export default ServerRepo;
