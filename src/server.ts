import { 
  ResourceLoader, 
  ModelManager, 
  ModelManagerConfig 
} from 'mzen';
import ServerRemoteObject from './remote-object';
import ServerRepo from './repo';
import ServerService from './service';
import ServerAcl from './acl';
import Http = require('http');
import express = require('express');
import bodyParser = require('body-parser');
import path = require('path');

export interface ServerConfig
{
  path?: string;
  port?: number;
  appDir?: string;
  initDirName?: string;
  aclDirName?: string;
  model?: ModelManagerConfig; 
  [key: string]: any; // Any custom config options
}

export class Server
{
  modelManager: ModelManager;
  config: ServerConfig;
  app: express.Application;
  server: Http.Server;
  router: express.Router;
  aclRoleAssessor: {[key: string]: any};
  logger: any;
  initialised: boolean;
  
  constructor(options?: ServerConfig, modelManager?: ModelManager)
  {
    this.config = options ? options : {};
    this.config.path = this.config.path ? this.config.path : '/api';
    this.config.port = this.config.port ? this.config.port : 3838;
    // Default appDir directory is the same directory as the executed script
    this.config.appDir = this.config.appDir ? path.resolve(this.config.appDir) : '';
    this.config.initDirName = this.config.initDirName ? this.config.initDirName : '/init';
    this.config.aclDirName = this.config.aclDirName ? this.config.aclDirName : '/acl';
    
    this.modelManager = modelManager 
      ? modelManager 
      : new ModelManager(this.config.model ? this.config.model : undefined);

    this.app = express();
    this.server = null;
    this.router = express.Router();
    this.aclRoleAssessor = {};
    this.logger = console;
    this.initialised = false;
  }
  
  setLogger(logger)
  {
    this.logger = logger;
    this.modelManager.setLogger(logger);
    return this;
  }
  
  async init()
  {
    if (!this.initialised) {
      // Add app model directory based on value of appDir 
      // if no model directories have been configured
      if (this.modelManager.config.modelDirs.length == 0) {
        this.modelManager.config.modelDirs.push(this.config.appDir + '/model');
      }
      // Add default model directory 
      // - this is model functionality provided by the mzen-server package
      this.modelManager.config.modelDirs.unshift(__dirname + '/model');

      await this.bootInitScripts('00-init');

      await this.modelManager.init();
      await this.bootInitScripts('01-model-initialised');

      await this.loadResources();
      await this.bootInitScripts('02-resources-loaded');

      await this.registerServiceEndpoints();
      await this.registerRepoApiEndpoints();
      await this.bootInitScripts('03-endpoints-registered');

      this.app.use(bodyParser.json());
      this.app.use(bodyParser.text());
      this.app.use(bodyParser.urlencoded({extended: true}));
      this.app.use(this.config.path, this.router);
      await this.bootInitScripts('04-router-mounted');

      this.app.use((err, req, res, next) => {
        this.logger.error({err, req, res});
        res.status(500).send('Something broke!');
        next();
      });

      await this.bootInitScripts('99-final');

      this.initialised = true;
    }
  }
  
  async bootInitScripts(stage?: string)
  {
    const loader = new ResourceLoader({
      dirPaths: [this.config.appDir],
      subdir: 
        stage ? this.config.initDirName + '/' + stage 
              : this.config.initDirName
    });

    var filePaths = loader.getResourcePaths();
    
    // Sort by filename
    // - Order of execution is important
    // - Files should be named to give the correct order
    filePaths.sort((a, b) => (path.basename(a) > path.basename(b) ? 1 : 0));

    filePaths.forEach(async filePath => {
      let initFunction = ResourceLoader.loadModule(filePath);
      if (typeof initFunction == 'function') {
        let promise = initFunction(this);
        if (promise && promise.constructor && promise.constructor instanceof Promise) {
          await promise;
        }
      }
    });
  }
  
  async loadResources()
  {
    const loader = new ResourceLoader({
      dirPaths: [__dirname, this.config.appDir],
      subdir: this.config.aclDirName + '/role-assessor'
    });

    const assessors = loader.getResources();
    for (let assessorName in assessors) {
      let roleAssessor = new assessors[assessorName]();
      this.aclRoleAssessor[roleAssessor.role] = roleAssessor;
    }

    return this;
  }
  
  registerServiceEndpoints()
  {
    const services = this.modelManager.services;
    for (let serviceName in services)
    {
      var service = services[serviceName] as ServerService;
      var apiConfig = service.config.api ? service.config.api : {};
      var path = apiConfig.path != null 
        ? apiConfig.path 
        : '/service/' + camelToKebab(serviceName);
      var enable = (apiConfig.enable !== undefined) ? apiConfig.enable : true;
      var aclConfig = apiConfig.acl ? apiConfig.acl : {};
      var endpoint = apiConfig.endpoint ? apiConfig.endpoint : {};
      var endpointsDisable = endpoint.disable ? endpoint.disable : {};
      var endpointDisableGroup = endpoint.disableGroup ? endpoint.disableGroup : {};
      var endpoints = apiConfig.endpoints ? apiConfig.endpoints : {};

      if (!enable) continue;
      
      // Remove any endpoints that have been disabled
      for (var endpointName in endpoints) {
        var groups = endpoints[endpointName].groups;
        if (Array.isArray(groups)) {
          groups.forEach(function(group){
            if (endpoints[endpointName] && endpointDisableGroup[group] == true) {
              delete endpoints[endpointName]
            }
          });
        }
        if (endpoints[endpointName] && endpointsDisable[endpointName] == true) {
          delete endpoints[endpointName];
        }
      }

       // This service has no end points - nothing more to do
      if (Object.keys(endpoints).length == 0) continue;

      var acl = new ServerAcl({
        rules: aclConfig.rules,
        endpoints
      });
      acl.loadDefaultRoleAssessors();
      acl.setRepos(this.modelManager.repos);
      for (var role in this.aclRoleAssessor) {
        acl.addRoleAssessor(this.aclRoleAssessor[role]);
      }

      var remoteObject = new ServerRemoteObject(
        services[serviceName], 
        {
          path, 
          endpoints,
          server: this.config
        }
      );
      remoteObject.setLogger(this.logger);
      remoteObject.setAcl(acl);
      remoteObject.initRouter(this.router);
    }
  }
  
  registerRepoApiEndpoints()
  {
    const repos = this.modelManager.repos;
    for (var repoName in repos)
    {
      var repo = repos[repoName] as ServerRepo;
      var apiConfig = repo.config.api ? repo.config.api: {};
      var path = apiConfig.path != null 
        ? apiConfig.path 
        : '/repo/' + camelToKebab(repoName);
      var enable = (apiConfig.enable !== undefined) ? apiConfig.enable : true;
      var aclConfig = apiConfig.acl ? apiConfig.acl : {};
      var endpoint = apiConfig.endpoint ? apiConfig.endpoint : {};
      var endpointsDisable = endpoint.disable ? endpoint.disable : {};
      var endpointDisableGroup = endpoint.disableGroup ? endpoint.disableGroup : {};
      var endpoints = apiConfig.endpoints ? apiConfig.endpoints : {};

      if (!enable) continue;

      // Remove any endpoints that have been disabled
      for (var endpointName in endpoints) {
        var groups = endpoints[endpointName].groups;
        if (Array.isArray(groups)) {
          groups.forEach(function(group){
            if (endpoints[endpointName] && endpointDisableGroup[group] == true) {
              delete endpoints[endpointName]
            }
          });
        }
        if (endpoints[endpointName] && endpointsDisable[endpointName] == true) {
          delete endpoints[endpointName];
        }
      }

      // This repo has no end points - nothing more to do
      if (Object.keys(endpoints).length == 0) continue; 
      
      var acl = new ServerAcl({
        rules: aclConfig.rules,
        endpoints
      });
      acl.loadDefaultRoleAssessors();
      acl.setRepos(this.modelManager.repos);
      for (var role in this.aclRoleAssessor) {
        acl.addRoleAssessor(this.aclRoleAssessor[role]);
      }

      var remoteObject = new ServerRemoteObject(
        repos[repoName], {
          path, 
          endpoints,
          server: this.config
        }
      );
      remoteObject.setLogger(this.logger);
      remoteObject.setAcl(acl);
      remoteObject.initRouter(this.router);
    }
  }
  
  async start()
  {
    this.server = this.app.listen(this.config.port, () => {
      this.logger.info('Listening on port ' + this.config.port);
    });

    process.on('SIGINT', () => {
      this.shutdown().then(() => {
        setTimeout(function() {
          process.exit(0);
        }, 5000);
      });
    });
  }
  
  async shutdown()
  {
    this.logger.info('Shutting down');
    await this.modelManager.shutdown();
    return this.server ? this.server.close() : undefined;
  }
}

function camelToKebab(input)
{
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export default Server;
