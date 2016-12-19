'use strict'

var ServerAcl = require('./acl');
var Schema = require('mzen/lib/schema');

class ErrorBadRequest extends Error {} // 400
class ErrorUnauthorized extends Error {} // 401
class ErrorForbidden extends Error {} // 403
class ErrorNotFound extends Error {} // 404
class ErrorMethodNotAllowed extends Error {} // 405
class ErrorTooManyRequests extends Error {} // 429

class ServerRemoteObject
{
  constructor(object, config = {}) {
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
      let methodArgs = endpointConfig['args'] ? endpointConfig['args'] : [];
      let aclConfig = endpointConfig['acl'] ? endpointConfig['acl'] : {};
      
      // Prepend global ACL rules
      aclConfig['rules'] = this.config['acl']['rules'].concat(aclConfig['rules'] ? aclConfig['rules'] : []);
      
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
          let query = req ? req['query'] : {};
          let body = req ? req['body'] : {};
          let params = req ? req['params']: {};
          let argumentValues = [];
          let aclContext = {};
          let validateResult = Schema.mergeValidationResults();
          methodArgs.forEach(function(methodArgConfig, methodArgIndex){
            // First attempt to retrieve the value for the argument
            let srcName = methodArgConfig['srcName'] ? methodArgConfig['srcName'] : null;
            let name = methodArgConfig['name'] ? methodArgConfig['name'] : srcName;
            let type = methodArgConfig['type'] ? methodArgConfig['type'] : null;
            
            let argValidateObject = {};
            let validationSpec = {};
            
            let src = methodArgConfig['src'] ? methodArgConfig['src'] : 'query-field';
            switch (src) {
              case 'params':
                argValidateObject[srcName] = params;
              break;
              case 'param':
                argValidateObject[srcName] = params[srcName];
              break;
              case 'query-field':
                argValidateObject[srcName] = query[srcName];
              break;
              case 'query':
                argValidateObject[srcName] = query;
              break;
              case 'header-field':
                argValidateObject[srcName] = req.get(srcName);
              break;
              case 'body-field':
                argValidateObject[srcName] = body[srcName];
              break;
              case 'body':
                argValidateObject[srcName] = body;
              break;
              case 'request':
                argValidateObject[srcName] = req;
              break;
              case 'response':
                argValidateObject[srcName] = res;
              break;
            }
            
            validationSpec[srcName] = {};
            validationSpec[srcName]['$type'] = type;
            validationSpec[srcName]['$validate'] = {};
            validationSpec[srcName]['$filter'] = {};
            if (methodArgConfig['required'] !== undefined) validationSpec[srcName]['$validate']['required'] = methodArgConfig['required'];
            if (methodArgConfig['notNull'] !== undefined) validationSpec[srcName]['$validate']['notNull'] = methodArgConfig['notNull'];
            if (methodArgConfig['notEmpty'] !== undefined) validationSpec[srcName]['$validate']['notEmpty'] = methodArgConfig['notEmpty'];
            if (methodArgConfig['defaultValue'] !== undefined) validationSpec[srcName]['$filter']['defaultValue'] = methodArgConfig['defaultValue'];
            
            let argValidateSchema = new Schema(validationSpec);
            let argValidateResult = argValidateSchema.validate(argValidateObject);
            validateResult = Schema.mergeValidationResults([validateResult, argValidateResult]);
            
            argumentValues.push(argValidateObject[srcName]);
            aclContext[name] = argValidateObject[srcName];
          });
          
          if (validateResult.isValid) 
          {
            if (this.object[method] === undefined) throw new Error('Method "' + method + '" is not defined'); 
            // Check acl
            promise = this.acl.isPermitted({}, endpointName, aclContext).then(function(isPermitted){
              if (!isPermitted) {
                throw new ErrorUnauthorized;
              } 
            }).then(function(){
              return this.object[method].apply(this.object, argumentValues).then(function(response){
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
                console.log(err);
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
