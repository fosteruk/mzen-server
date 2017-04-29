'use strict'

var ServerAcl = require('./acl');
var Schema = require('mzen-schema');
var clone = require('clone');

class ErrorBadRequest extends Error {} // 400
class ErrorUnauthorized extends Error {} // 401
class ErrorForbidden extends Error {} // 403
class ErrorNotFound extends Error {} // 404
class ErrorMethodNotAllowed extends Error {} // 405
class ErrorTooManyRequests extends Error {} // 429

class ServerRemoteObject
{
  constructor(object, config = {}) 
  {
    this.config = config ? config : {};
    this.config['path'] = this.config['path'] ? this.config['path'] : '';
    this.config['endpoints'] = this.config['endpoints'] ? this.config['endpoints'] : {};
    this.config['acl'] = this.config['acl'] ? this.config['acl'] : {};
    this.config['acl']['rules'] = this.config['acl']['rules'] ? this.config['acl']['rules'] : [];
    
    this.object = object;
    this.acl = new ServerAcl;
  }
  initRouter(router)
  {
    const middlewareConfig = this.getMiddlewareConfig();
    for (let endpointName in middlewareConfig) {
      for (let verb in middlewareConfig[endpointName]) {
        const endpointConfig = middlewareConfig[endpointName][verb];
        router[endpointConfig.verb](endpointConfig.path, endpointConfig.callback);
      }
    }
  }
  setAcl(acl)
  {
    this.acl = acl;
  }
  getMiddlewareConfig()
  {
    let middleware = {};
    
    for (let endpointName in this.config['endpoints'])
    {
      const endpointConfig = this.config['endpoints'][endpointName];
      const verbs = endpointConfig['verbs'] ? endpointConfig['verbs'] : ['get'];
      const method = endpointConfig['method'] ? endpointConfig['method'] : '';
      const path = endpointConfig['path'] ? endpointConfig['path'] : method;
      const methodArgsConfig = endpointConfig['args'] ? endpointConfig['args'] : [];
      
      const response = endpointConfig['response'] ? endpointConfig['response'] : {};
      const responseSuccess = response['success'] ? response['success']: {};
    
      const responseErrorConfig = response['error'] ? response['error']: {};
      let responseError = ServerRemoteObject.endpointError;
      // Append configured error handlers to default error handlers
      for (var errorName in responseErrorConfig) {
        responseError[errorName] = responseErrorConfig[errorName];
      }
      
      verbs.forEach((verb) => {
        let middlewareCallback = function(req, res) {
          let promise = Promise.resolve();
      
          const requestArgs = this.parseRequestArgs(methodArgsConfig, req, res);
          const validationSpec = this.parseValidationSpec(methodArgsConfig);
          const aclContext = clone(requestArgs);
          const argValidateSchema = new Schema(validationSpec);
          return argValidateSchema.validate(requestArgs).then((validateResult) => {
            if (validateResult.isValid) 
            {
              if (this.object[method] === undefined) throw new Error('Method "' + method + '" is not defined'); 
              promise = this.acl.populateContext(req, aclContext).then(() => {
                return this.acl.isPermitted(endpointName, aclContext);
              }).then((isPermitted) => {
                if (isPermitted === false) {
                  throw new ErrorUnauthorized;
                }
                requestArgs['acl-conditions'] = isPermitted;

                // If method args were specified as an array they are passed in to the remote method in order
                // If method args were specified as an object the remote method gets that object as a single argument
                const methodArgs = Array.isArray(methodArgsConfig) ? this.buildMethodArgArray(methodArgsConfig, requestArgs) : [requestArgs];
                
                return this.object[method].apply(this.object, methodArgs).then(function(response){
                  const httpConfig = responseSuccess['http'] ? responseSuccess['http']: {};
                  const code = httpConfig['code'] ? httpConfig['code'] : 200;
                  let contentType = httpConfig['contentType'] ? httpConfig['contentType'] : 'json';
                  if (contentType == 'json') {
                    res.status(code).json(response);
                  } else {
                    if (contentType) res.type(contentType); 
                    res.status(code).send(response);
                  }
                })
              }).catch(function(err){
                var errorHandled = false;
                if (Object.keys(responseError).length) {
                  for (var errorName in responseError) {
                    if (errorName !== err.constructor.name) continue;

                    var errorValidatePromise = Promise.reoslve({isValid: true});

                    const errorConfig = responseError[errorName];
                    const schemaConfig = errorConfig['schema'] ? errorConfig['schema'] : null;
                    const httpConfig = errorConfig['http'] ? errorConfig['http']: {};
                    const code = httpConfig['code'] ? httpConfig['code'] : 400;
                    const contentType = httpConfig['contentType'] ? httpConfig['contentType'] : 'json';
                  
                    if (schemaConfig) {
                      let schema = new Schema(schemaConfig);
                      errorValidatePromise = schema.validate(err);
                    }
                    errorValidatePromise.then((validateResult) => {
                      if (validateResult.isValid) {
                        if (contentType == 'json') {
                          res.status(code).json(err);
                        } else {
                          if (contentType) res.type(contentType); 
                          res.status(code).send(err);
                        }
                      }
                    });
                    errorHandled = true;

                    break; // We use the first handle that matches and ignore any others
                  }
                }
                if (!errorHandled) {
                  console.log(JSON.stringify(err.stack, null, 2));
                  // Default error response
                  res.status(500).send('Error!');
                }
              });
            } else {
              res.status(403).json({validationErrors: validateResult.errors});
            }
            return promise;
          });
        }.bind(this);

        if (middleware[endpointName] == undefined) middleware[endpointName] = {};
        middleware[endpointName][verb] = {
          endpointName: endpointName,
          verb: verb,
          path: this.config['path'] + path,
          callback: middlewareCallback
        };
      });
    }
    return middleware;
  }
  buildMethodArgArray(methodArgsConfigArray, requestArgs)
  {
    var args = [];
    methodArgsConfigArray.forEach(function(argConfig){
      const srcName = argConfig['srcName'] ? argConfig['srcName'] : null;
      const name = argConfig['name'] ? argConfig['name'] : srcName;
      args.push(requestArgs[name]);
    });
    return args;
  }
  parseValidationSpec(methodArgsConfig, req)
  {
    var spec = {};

    var parseOne = function(argConfig){
      const srcName = argConfig['srcName'] ? argConfig['srcName'] : null;
      const name = argConfig['name'] ? argConfig['name'] : srcName;
      const type = argConfig['type'] ? argConfig['type'] : null;

      spec[name] = {};
      spec[name]['$type'] = type;
      spec[name]['$validate'] = {};
      spec[name]['$filter'] = {};
      if (argConfig['required'] !== undefined) spec[name]['$validate']['required'] = argConfig['required'];
      if (argConfig['notNull'] !== undefined) spec[name]['$validate']['notNull'] = argConfig['notNull'];
      if (argConfig['notEmpty'] !== undefined) spec[name]['$validate']['notEmpty'] = argConfig['notEmpty'];
      if (argConfig['defaultValue'] !== undefined) spec[name]['$filter']['defaultValue'] = argConfig['defaultValue'];
    };

    if (Array.isArray(methodArgsConfig)) {
      methodArgsConfig.forEach(function(argConfig){
        parseOne(argConfig);
      });
    } else {
      for (var name in methodArgsConfig) {
        parseOne(methodArgsConfig[name]);
      }
    }

    return spec;
  }
  parseRequestArgs(methodArgsConfig, req, res)
  {
    var values = {};
    if (Array.isArray(methodArgsConfig)) {
      methodArgsConfig.forEach(function(argConfig, methodArgIndex){
        // First attempt to retrieve the value for the argument
        const srcName = argConfig['srcName'] ? argConfig['srcName'] : null;
        const name = argConfig['name'] ? argConfig['name'] : srcName;
        values[name] = this.parseOneRequestArg(argConfig, req, res);
      }.bind(this));
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
    const srcName = methodArgConfig['srcName'] ? methodArgConfig['srcName'] : null;
    const name = methodArgConfig['name'] ? methodArgConfig['name'] : srcName;
    const type = methodArgConfig['type'] ? methodArgConfig['type'] : null;

    const query = req ? req['query'] : {};
    const body = req ? req['body'] : {};
    const params = req ? req['params']: {};
    
    const src = methodArgConfig['src'] ? methodArgConfig['src'] : 'query-field';
    switch (src) {
      case 'params':
        value = params;
      break;
      case 'param':
        value = params[srcName];
      break;
      case 'query-field':
        value = query[srcName];
      break;
      case 'query':
        value = query;
      break;
      case 'header-field':
        value = req.get(srcName);
      break;
      case 'body-field':
        value = body[srcName];
      break;
      case 'body':
        value = body;
      break;
      case 'request':
        value = req;
      break;
      case 'response':
        value = res;
      break;
      case 'acl-conditions':
        value = 'acl-conditions'; // This is just a placeholder which is populated after ACLs have been checked
      break;
    }

    return value;
  }
}

ServerRemoteObject.error = {
  ErrorBadRequest: ErrorBadRequest,
  ErrorUnauthorized: ErrorUnauthorized,
  ErrorForbidden: ErrorForbidden,
  ErrorNotFound: ErrorNotFound,
  ErrorMethodNotAllowed: ErrorMethodNotAllowed,
  ErrorTooManyRequests: ErrorTooManyRequests
};

ServerRemoteObject.endpointError = {
  ErrorBadRequest: {http: {code: 400}},
  ErrorUnauthorized: {http: {code: 401}},
  ErrorForbidden: {http: {code: 403}},
  ErrorNotFound: {http: {code: 404}},
  ErrorMethodNotAllowed: {http: {code: 405}},
  ErrorTooManyRequests: {http: {code: 429}}
};

module.exports = ServerRemoteObject;
