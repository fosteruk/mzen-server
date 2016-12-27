'use strict'

var ServerAcl = require('./acl');
var Schema = require('mzen/lib/schema');
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
    var middlewareConfig = this.getMiddlewareConfig();
    for (let endpointName in middlewareConfig) {
      for (let verb in middlewareConfig[endpointName]) {
        var endpointConfig = middlewareConfig[endpointName][verb];
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
      let endpointConfig = this.config['endpoints'][endpointName];
      let verbs = endpointConfig['verbs'] ? endpointConfig['verbs'] : ['get'];
      let method = endpointConfig['method'] ? endpointConfig['method'] : '';
      let path = endpointConfig['path'] ? endpointConfig['path'] : method;
      let methodArgsConfig = endpointConfig['args'] ? endpointConfig['args'] : [];
      
      let response = endpointConfig['response'] ? endpointConfig['response'] : {};
      let responseSuccess = response['success'] ? response['success']: {};
    
      let responseErrorConfig = response['error'] ? response['error']: {};
      let responseError = ServerRemoteObject.endpointError;
      // Apend configured error handlers to default error handlers
      for (var errorName in responseErrorConfig) {
        responseError[errorName] = responseErrorConfig[errorName];
      }
      
      verbs.forEach(function(verb){
        let middlewareCallback = function(req, res) {
          let promise = Promise.resolve();
      
          let requestArgs = this.parseRequestArgs(methodArgsConfig, req, res);
          let validationSpec = this.parseValidationSpec(methodArgsConfig);
          let aclContext = clone(requestArgs);

          let argValidateSchema = new Schema(validationSpec);
          let validateResult = argValidateSchema.validate(requestArgs);

          if (validateResult.isValid) 
          {
            if (this.object[method] === undefined) throw new Error('Method "' + method + '" is not defined'); 
            promise = this.acl.populateContext(req, aclContext).then(function(){
              return this.acl.isPermitted(endpointName, aclContext);
            }.bind(this)).then(function(isPermitted){
              if (isPermitted === false) {
                throw new ErrorUnauthorized;
              }
              requestArgs['acl-conditions'] = isPermitted;

              // If method args where specified as an array they are passed in to the remote method in order
              // If method args where specified as an object the remote method gets that object as a single argument
              var methodArgs = Array.isArray(methodArgsConfig) ? this.buildMethodArgArray(methodArgsConfig, requestArgs) : [requestArgs];
              
              return this.object[method].apply(this.object, methodArgs).then(function(response){
                let httpConfig = responseSuccess['http'] ? responseSuccess['http']: {};
                let code = httpConfig['code'] ? httpConfig['code'] : 200;
                let contentType = httpConfig['contentType'] ? httpConfig['contentType'] : 'json';
                if (contentType == 'json') {
                  res.status(code).json(response);
                } else {
                  if (contentType) res.type(contentType); 
                  res.status(code).send(response);
                }
              })
            }.bind(this)).catch(function(err){
              var errorHandled = false;
              if (Object.keys(responseError).length) {
                for (var errorName in responseError) {
                  let errorConfig = responseError[errorName];
                  let schemaConfig = errorConfig['schema'] ? errorConfig['schema'] : {};
                  let httpConfig = errorConfig['http'] ? errorConfig['http']: {};
                  let code = httpConfig['code'] ? httpConfig['code'] : 400;
                  let contentType = httpConfig['contentType'] ? httpConfig['contentType'] : 'json';
                  
                  let schema = new Schema(schemaConfig);
                  let validateResult = schema.validate(err);
                  
                  if (validateResult.isValid) {
                    if (err.constructor.name == errorName) {
                      if (contentType == 'json') {
                        res.status(code).json(err);
                      } else {
                        if (contentType) res.type(contentType); 
                        res.status(code).send(err);
                      }
                      errorHandled = true;
                      break;
                    }
                  } else {
                    res.status(500).send('Error!');
                    errorHandled = true;
                  }
                }
              }
              if (!errorHandled) {
                // console.log(JSON.stringify(err.stack, null, 2));
                // Default error response
                res.status(500).send('Error!');
              }
            });
          } else {
            res.status(403).json({validationErrors: validateResult.errors});
          }
          return promise;
        }.bind(this);
        if (middleware[endpointName] == undefined) middleware[endpointName] = {};
        middleware[endpointName][verb] = {
          endpointName: endpointName,
          verb: verb,
          path: this.config['path'] + path,
          callback: middlewareCallback
        };
      }.bind(this));
    }
    
    return middleware;
  }
  buildMethodArgArray(methodArgsConfigArray, requestArgs)
  {
    var args = [];
    methodArgsConfigArray.forEach(function(argConfig){
      var srcName = argConfig['srcName'] ? argConfig['srcName'] : null;
      var name = argConfig['name'] ? argConfig['name'] : srcName;
      args.push(requestArgs[name]);
    });
    return args;
  }
  parseValidationSpec(methodArgsConfig, req)
  {
    var spec = {};

    var parseOne = function(argConfig){
      var srcName = argConfig['srcName'] ? argConfig['srcName'] : null;
      var name = argConfig['name'] ? argConfig['name'] : srcName;
      let type = argConfig['type'] ? argConfig['type'] : null;

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
        var srcName = argConfig['srcName'] ? argConfig['srcName'] : null;
        var name = argConfig['name'] ? argConfig['name'] : srcName;
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
    let srcName = methodArgConfig['srcName'] ? methodArgConfig['srcName'] : null;
    let name = methodArgConfig['name'] ? methodArgConfig['name'] : srcName;
    let type = methodArgConfig['type'] ? methodArgConfig['type'] : null;

    let query = req ? req['query'] : {};
    let body = req ? req['body'] : {};
    let params = req ? req['params']: {};
    
    let src = methodArgConfig['src'] ? methodArgConfig['src'] : 'query-field';
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
