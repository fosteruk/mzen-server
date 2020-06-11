import ServerAcl from './acl';
import { ServerConfig } from './server';
import { 
  Schema, 
  SchemaValidationResult, 
  ObjectPathAccessor 
} from 'mzen';
import { 
  ServerError, 
  ServerErrorUnauthorized, 
  serverErrorApiEndpointResponseConfig 
} from './error';
import { 
  ServerApiConfigAcl, 
  ServerApiConfigEndpoint, 
  ServerApiConfigEndpointResponse 
} from './api-config';
const bodyParser = require('body-parser');

export interface ServerRemoteObjectConfig
{
  path?: string;
  acl?: ServerApiConfigAcl;
  endpoints?: {[key: string]: ServerApiConfigEndpoint};
  server?: ServerConfig;
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
    this.config.path = this.config.path 
      ? this.config.path : '';
    this.config.endpoints = this.config.endpoints 
      ? this.config.endpoints : {};
    this.config.acl = this.config.acl 
      ? this.config.acl : {};
    this.config.acl.rules = this.config.acl.rules 
      ? this.config.acl.rules : [];
    this.config.server = this.config.server 
      ? this.config.server : {};

    this.object = object;
    this.acl = new ServerAcl;
    this.setLogger(console);
  }
  
  setLogger(logger)
  {
    this.logger = logger;
    return this;
  }

  getBodyParserMiddleware(bodyParserConfig)
  {
    const {
      json, 
      urlencoded,
      text,
      raw
    } = bodyParserConfig;
    let middlware = [];
    if (json && json.enable) {
      middlware.push(bodyParser.json(json));
    }
    if (urlencoded && urlencoded.enable) {
      middlware.push(bodyParser.urlencoded(urlencoded));
    }
    if (text && text.enable) {
      middlware.push(bodyParser.text(text));
    }
    if (raw && raw.enable) {
      middlware.push(bodyParser.text(raw));
    }
    return middlware;
  }
  
  initRouter(router)
  {
    const middlewareConfigs = this.getMiddlewareConfig();
    middlewareConfigs.forEach(middlewareConfig => {
      const bodyParserMiddleware = this.getBodyParserMiddleware(
        middlewareConfig.bodyParserConfig
      );
      router[middlewareConfig.verb].apply(router,[
        middlewareConfig.path,
        ...bodyParserMiddleware,
        middlewareConfig.callback
      ]);;
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
      const bodyParserConfig = this.bodyParserConfigNormalise(endpointConfig.bodyParser);
      const requestDataConfig = endpointConfig.data ? endpointConfig.data : {};
      const priority = endpointConfig.priority != undefined ? endpointConfig.priority : 0;

      const response = endpointConfig.response ? endpointConfig.response : {};
      const responseSuccess = response.success ? response.success: {};
      const responseErrorConfig = response.error ? response.error: {};
      // Append configured error handlers to default error handlers
      var errorEndpointResponses = {
        ...serverErrorApiEndpointResponseConfig
      } as ServerApiConfigEndpointResponse;
      for (var errorName in responseErrorConfig) {
        errorEndpointResponses[errorName] = responseErrorConfig[errorName];
      }

      verbs.forEach(verb => {
        let middlewareCallback = async (req, res) => {
          const requestData = this.parseRequestData(requestDataConfig, req, res);
          const validationSpec = this.parseValidationSpec(requestDataConfig);
          const aclContext = {...requestData};
          const argValidateSchema = new Schema(validationSpec);
          const validateResult = await argValidateSchema.validate(requestData);

          if (!validateResult.isValid) {
            res.status(403).json({validationErrors: validateResult.errors});
            return;
          }

          if (this.object[method] === undefined) {
            throw new Error(
              'Method "' + method 
              + '" is not defined in endpoint "' + endpointName + '"'
            );
          }

          try {
            await this.acl.populateContext(req, aclContext);
            const isPermitted = await this.acl.isPermitted(endpointName, aclContext);
            if (isPermitted === false) {
              throw new ServerErrorUnauthorized;
            }

            // Append the aclContext and aclConditions to the requestData
            // - these are always appended in this order and are not configurable
            requestData.aclContext = aclContext;
            requestData.aclConditions = typeof isPermitted === 'object' ? isPermitted : {};

            const response = await this.object[method].apply(this.object, [requestData]);

            const httpConfig = responseSuccess.http ? responseSuccess.http: {};
            const code = httpConfig.code ? httpConfig.code : 200;
            let contentType = httpConfig.contentType ? httpConfig.contentType : 'json';
            if (contentType == 'json') {
              res.status(code).json(response);
            } else {
              if (contentType) res.type(contentType);
              res.status(code).send(response);
            }
          } catch (err) {
            var errorHandled = false;
            if (Object.keys(errorEndpointResponses).length) {
              for (var errorName in errorEndpointResponses) {
                if (errorName !== err.constructor.name) continue;

                const errorConfig = errorEndpointResponses[errorName] as ServerApiConfigEndpointResponse;
                const schemaConfig = errorConfig.schema ? errorConfig.schema : null;
                const httpConfig = errorConfig.http ? errorConfig.http: {};
                const code = httpConfig.code ? httpConfig.code : 400;
                const contentType = httpConfig.contentType ? httpConfig.contentType : 'json';

                const validateResultError: SchemaValidationResult = (
                  schemaConfig ? await (new Schema(schemaConfig)).validate(err) : {isValid: true} 
                );
                if (validateResultError.isValid) {
                  if (contentType == 'json') {
                    res.status(code).json(err);
                  } else {
                    if (contentType) res.type(contentType);
                    res.status(code).send(err);
                  }
                }
                errorHandled = true;

                break; // We use the first handle that matches and ignore any others
              }
            }
            const isInTest = typeof global.it === 'function'; // dont log anything when in automated test enviroment
            if (!isInTest && (err.ref == undefined || err.logged || !errorHandled)) {
              // Errors which have a ref defined are expected to be handled by the client so we dont need to log them
              // Errors which do not have a ref are not expected by the client and must be logged
              // Errors which have a ref may be forced to log if the logged flag value is set to true
              // Unhandled errors are not expected by either the server or the client and must be logged
              this.logger.error({err, req: this.requestMin(req)});
            }
            if (!errorHandled) {
              // Default error response
              res.status(500);
              res.send('Error!');
            }
          }
        };

        middleware.push({
          endpointName: endpointName,
          method: method,
          verb: verb,
          path: this.config.path + path,
          callback: middlewareCallback,
          priority: priority,
          bodyParserConfig
        });
      });
    }

    return middleware.sort((a, b) => b.priority - a.priority);
  }
  
  parseValidationSpec(requestDataConfig)
  {
    var spec = {};

    var parseOne = (argConfig, key?) => {
      const type = argConfig.type ? argConfig.type : null;

      spec[key] = {};
      spec[key].$type = type;
      spec[key].$validate = {};
      spec[key].$filter = {};
      if (argConfig.required !== undefined) spec[key].$validate.required = argConfig.required;
      if (argConfig.notNull !== undefined) spec[key].$validate.notNull = argConfig.notNull;
      if (argConfig.notEmpty !== undefined) spec[key].$validate.notEmpty = argConfig.notEmpty;
      if (argConfig.defaultValue !== undefined) spec[key].$filter.defaultValue = argConfig.defaultValue;
    };

    for (var key in requestDataConfig) {
      parseOne(requestDataConfig[key], key);
    }

    return spec;
  }
  
  parseRequestData(requestDataConfig, req, res): {[key: string]: any}
  {
    var values = {};
    for (var name in requestDataConfig) {
      values[name] = this.parseOneRequestData(name, requestDataConfig[name], req, res);
    }
    return values;
  }
  
  parseOneRequestData(name, methodArgConfig, req, res)
  {
    var value = undefined;
    const src = methodArgConfig.src ? methodArgConfig.src : 'query';
    const srcPath = methodArgConfig.srcPath ? methodArgConfig.srcPath : name;

    const container = {
      param: req.params ? req.params : {},
      query: req.query ? req.query : {},
      body: req.body ? req.body : {},
      request: req,
      response: res,
      config: this.config.server ? this.config.server : {},
      aclContext: req.aclContext ? req.aclContext : {},
      aclConditions: req.aclConditions ? req.aclConditions: {}
    };

    switch (src) {
      case 'header':
        value = container.request.get(srcPath)
      break;
      case 'container':
        value = ObjectPathAccessor.getPath(srcPath, container);
      break;
      default:
        value = ObjectPathAccessor.getPath(srcPath, container[src]);
      break;
    }

    return value;
  }

  bodyParserConfigNormalise(config:any)
  {
    config = config ? config : {};
    const {
      json, urlencoded, text, raw
    } = config;
    const jsonDefault = {enable:true, limit: '100kb'};
    const urlencodedDefault = {enable:true, limit: '100kb', extended: true};
    const textDefault = {enable:true, limit: '100kb'};
    const rawDefault = {enable:true, limit: '100kb'};
    return {
      json: (
        json 
        ? {
          enable: json.enable != undefined ? !!json.enable : jsonDefault.enable, 
          limit: json.limit != undefined ? json.limit : jsonDefault.limit, 
          type: json.type != undefined ? json.type : undefined 
        }
        : jsonDefault
      ),
      urlencoded: (
        urlencoded 
        ? {
          enable: urlencoded.enable != undefined ? !!urlencoded.enable : urlencodedDefault.enable, 
          limit: urlencoded.limit != undefined ? urlencoded.limit : urlencodedDefault.limit, 
          extended: urlencoded.extended != undefined ? urlencoded.extended : urlencodedDefault.extended, 
          type: urlencoded.type != undefined ? urlencoded.type : undefined 
        }
        : urlencodedDefault
      ),
      text: (
        text
        ? {
          enable: text.enable != undefined ? !!text.enable : textDefault.enable, 
          limit: text.limit != undefined ? text.limit : textDefault.limit, 
          type: text.type != undefined ? text.type : undefined 
        }
        : textDefault
      ),
      raw: (
        raw 
        ? {
          enable: raw.enable != undefined ? !!raw.enable : rawDefault.enable, 
          limit: raw.limit != undefined ? raw.limit : rawDefault.limit, 
          type: raw.type != undefined ? raw.type : undefined 
        }
        : textDefault
      ),
    };
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
