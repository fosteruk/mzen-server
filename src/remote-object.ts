import ServerAcl from './acl';
import { Schema, SchemaValidationResult } from 'mzen';
import { ServerError, ServerErrorUnauthorized, serverErrorApiEndpointResponseConfig} from './error';
import { ServerConfigApiAcl, ServerConfigApiEndpoint, ServerConfigApiEndpointResponse } from './config-api';
import clone = require('clone');

export interface ServerRemoteObjectConfig
{
  path?: string;
  acl?: ServerConfigApiAcl;
  endpoints?: {[key: string]: ServerConfigApiEndpoint};
}

export class ServerRemoteObject
{
  static error: {[key: string]: ServerError};
  
  config: ServerRemoteObjectConfig;
  object: any;
  acl: ServerAcl;
  logger: any;
   
  constructor(object, config?)
  {
    this.config = config ? config : {};
    this.config.path = this.config.path ? this.config.path : '';
    this.config.endpoints = this.config.endpoints ? this.config.endpoints : {};
    this.config.acl = this.config.acl ? this.config.acl : {};
    this.config.acl.rules = this.config.acl.rules ? this.config.acl.rules : [];

    this.object = object;
    this.acl = new ServerAcl;
    this.setLogger(console);
  }
  
  setLogger(logger)
  {
    this.logger = logger;
    return this;
  }
  
  initRouter(router)
  {
    const middlewareConfigs = this.getMiddlewareConfig();
    middlewareConfigs.forEach(middlewareConfig => {
      router[middlewareConfig.verb](middlewareConfig.path, middlewareConfig.callback);
    });
  }
  
  setAcl(acl)
  {
    this.acl = acl;
  }
  
  getMiddlewareConfig()
  {
    let middleware = [];

    for (let endpointName in this.config.endpoints)
    {
      const endpointConfig = this.config.endpoints[endpointName];
      const verbs = endpointConfig.verbs ? endpointConfig.verbs : ['get'];
      const method = endpointConfig.method ? endpointConfig.method : '';
      const path = endpointConfig.path ? endpointConfig.path : method;
      const methodArgsConfig = endpointConfig.args ? endpointConfig.args : [];
      const priority = endpointConfig.priority != undefined ? endpointConfig.priority : 0;

      const response = endpointConfig.response ? endpointConfig.response : {};
      const responseSuccess = response.success ? response.success: {};
      const responseErrorConfig = response.error ? response.error: {};
      // Append configured error handlers to default error handlers
      var errorEndpointResponses = {...serverErrorApiEndpointResponseConfig} as ServerConfigApiEndpointResponse;
      for (var errorName in responseErrorConfig) {
        errorEndpointResponses[errorName] = responseErrorConfig[errorName];
      }

      verbs.forEach((verb) => {
        let middlewareCallback = (req, res) => {
          let promise = Promise.resolve();

          const requestArgs = this.parseRequestArgs(methodArgsConfig, req, res);
          const validationSpec = this.parseValidationSpec(methodArgsConfig);
          const aclContext = clone(requestArgs);
          const argValidateSchema = new Schema(validationSpec);
          return argValidateSchema.validate(requestArgs).then((validateResult) => {
            if (validateResult.isValid)
            {
              if (this.object[method] === undefined) throw new Error('Method "' + method + '" is not defined in endpoint "' + endpointName + '"');
              promise = this.acl.populateContext(req, aclContext).then(() => {
                return this.acl.isPermitted(endpointName, aclContext);
              }).then((isPermitted) => {
                if (isPermitted === false) {
                  throw new ServerErrorUnauthorized();
                }

                // Append the aclContext and aclConditions to the requestArgs
                // - these are always appended in this order and are not configurable
                requestArgs.aclContext = aclContext;
                requestArgs.aclConditions = typeof isPermitted === 'object' ? isPermitted : {};

                // If method args were specified as an array they are passed in to the remote method in order
                // If method args were specified as an object the remote method gets that object as a single argument
                const methodArgs = Array.isArray(methodArgsConfig) ? this.buildMethodArgArray(methodArgsConfig, requestArgs) : [requestArgs];

                return this.object[method].apply(this.object, methodArgs).then(function(response){
                  const httpConfig = responseSuccess.http ? responseSuccess.http: {};
                  const code = httpConfig.code ? httpConfig.code : 200;
                  let contentType = httpConfig.contentType ? httpConfig.contentType : 'json';
                  if (contentType == 'json') {
                    res.status(code).json(response);
                  } else {
                    if (contentType) res.type(contentType);
                    res.status(code).send(response);
                  }
                })
              }).catch((error) => {
                var errorHandled = false;
                if (Object.keys(errorEndpointResponses).length) {
                  for (var errorName in errorEndpointResponses) {
                    if (errorName !== error.constructor.name) continue;

                    const errorConfig = errorEndpointResponses[errorName] as ServerConfigApiEndpointResponse;
                    const schemaConfig = errorConfig.schema ? errorConfig.schema : null;
                    const httpConfig = errorConfig.http ? errorConfig.http: {};
                    const code = httpConfig.code ? httpConfig.code : 400;
                    const contentType = httpConfig.contentType ? httpConfig.contentType : 'json';

                    let errorValidatePromise = Promise.resolve({isValid: true} as SchemaValidationResult);
                    if (schemaConfig) {
                      let schema = new Schema(schemaConfig);
                      errorValidatePromise = schema.validate(error);
                    }
                    errorValidatePromise.then((validateResult) => {
                      if (validateResult.isValid) {
                        if (contentType == 'json') {
                          res.status(code).json(error);
                        } else {
                          if (contentType) res.type(contentType);
                          res.status(code).send(error);
                        }
                      }
                    });
                    errorHandled = true;

                    break; // We use the first handle that matches and ignore any others
                  }
                }
                var isInTest = typeof global.it === 'function'; // dont log anything when in automated test enviroment
                if (!isInTest && (error.ref == undefined || error.logged || !errorHandled)) {
                  // Errors which have a defined are expected to be handled by the client so we dont need to log them
                  // Errors which do not have a ref are not expected by the client and must be logged
                  // Errors which have a ref may be forced to log if the logged value is set
                  // Unhandled errors are not expected by either the server or the client and must be logged
                  this.logger.error({error, req: this.requestMin(req)});
                }
                if (!errorHandled) {
                  // Default error response
                  res.status(500);
                  res.send('Error!');
                }
              });
            } else {
              res.status(403).json({validationErrors: validateResult.errors});
            }
            return promise;
          });
        };


        middleware.push({
          endpointName: endpointName,
          method: method,
          verb: verb,
          path: this.config.path + path,
          callback: middlewareCallback,
          priority: priority
        });
      });
    }
    return middleware.sort((a, b) => b.priority - a.priority);
  }
  
  buildMethodArgArray(methodArgsConfigArray, requestArgs)
  {
    var args = [];
    methodArgsConfigArray.forEach((argConfig) => {
      const src = argConfig.src ? argConfig.src : null;
      const srcKey = argConfig.srcKey ? argConfig.srcKey : src;
      const name = argConfig.name ? argConfig.name : srcKey;
      args.push(requestArgs[name]);
    });
    if (requestArgs.aclContext) args.push(requestArgs.aclContext);
    if (requestArgs.aclConditions) args.push(requestArgs.aclConditions);
    return args;
  }
  
  parseValidationSpec(methodArgsConfig)
  {
    var spec = {};

    var parseOne = function(argConfig){
      const srcKey = argConfig.srcKey ? argConfig.srcKey : null;
      const name = argConfig.name ? argConfig.name : srcKey;
      const type = argConfig.type ? argConfig.type : null;

      spec[name] = {};
      spec[name].$type = type;
      spec[name].$validate = {};
      spec[name].$filter = {};
      if (argConfig.required !== undefined) spec[name].$validate.required = argConfig.required;
      if (argConfig.notNull !== undefined) spec[name].$validate.notNull = argConfig.notNull;
      if (argConfig.notEmpty !== undefined) spec[name].$validate.notEmpty = argConfig.notEmpty;
      if (argConfig.defaultValue !== undefined) spec[name].$filter.defaultValue = argConfig.defaultValue;
    };

    if (Array.isArray(methodArgsConfig)) {
      methodArgsConfig.forEach((argConfig) => {
        parseOne(argConfig);
      });
    } else {
      for (var name in methodArgsConfig) {
        parseOne(methodArgsConfig[name]);
      }
    }

    return spec;
  }
  
  parseRequestArgs(methodArgsConfig, req, res): {[key: string]: any}
  {
    var values = {};
    if (Array.isArray(methodArgsConfig)) {
      methodArgsConfig.forEach(argConfig => {
        // First attempt to retrieve the value for the argument
        const src = argConfig.src ? argConfig.src : null;
        const srcKey = argConfig.srcKey ? argConfig.srcKey : src;
        const name = argConfig.name ? argConfig.name : srcKey;
        values[name] = this.parseOneRequestArg(argConfig, req, res);
      });
    } else {
      for (var name in methodArgsConfig) {
        values[name] = this.parseOneRequestArg(methodArgsConfig[name], req, res);
      }
    }
    return values;
  }
  
  parseOneRequestArg(methodArgConfig, req, res)
  {
    var value = undefined;
    const src = methodArgConfig.src ? methodArgConfig.src : 'query';
    const srcKey = methodArgConfig.srcKey ? methodArgConfig.srcKey : null;

    req = req ? req : {};
    res = res ? res : {};

    const query = req.query ? req.query : {};
    const body = req.body ? req.body : {};
    const params = req.params ? req.params : {};
    const aclContext = req.aclContext ? req.aclContext : {};
    const aclConditions = req.aclConditions ? req.aclConditions: {};

    switch (src) {
      case 'param':
        value = srcKey ? params[srcKey] : params;
      break;
      case 'query':
        value = srcKey ? query[srcKey] : query;
      break;
      case 'header':
        value = srcKey && req.get ? req.get(srcKey) : null;
      break;
      case 'body':
        value = srcKey ? body[srcKey] : body;
      break;
      case 'request':
        value = srcKey ? req[srcKey] : req;
      break;
      case 'response':
        value = srcKey ? res[srcKey] : res;
      break;
      case 'aclContext':
        value = srcKey ? aclContext[srcKey] : aclContext;
      break;
      case 'aclConditions':
        value = srcKey ? aclConditions[srcKey] : aclConditions;
      break;
    }

    return value;
  }
  
  requestMin(req)
  {
    var result = {
      url: req.url,
      originalUrl: req.originalUrl,
      method: req.method,
      query: req.query,
      params: req.params,
      ip: req.ip,
      headers: req.headers,
      cookies: req.cookies,
      body: req.body
    };
    return result;
  }
}

export default ServerRemoteObject;
