import { 
  ModelManager, 
  ModelManagerConfig 
} from 'mzen';
import ServerRemoteObject from './remote-object';
import ServerRepo from './repo';
import ServerService from './service';
import ServerAcl from './acl';
import ServerAclRoleAssessor from './acl/role-assessor';
import Http = require('http');
import express = require('express');
import bodyParser = require('body-parser');
import path = require('path');

export interface ServerConfig
{
  path?: string;
  port?: number;
  appDir?: string;
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
  initialisers: {
    [key: string]: any[]
  };
  initialised: boolean;
  
  constructor(options?: ServerConfig, modelManager?: ModelManager)
  {
    this.config = options ? options : {};
    this.config.path = this.config.path ? this.config.path : '/api';
    this.config.port = this.config.port ? this.config.port : 3838;
    // Default appDir directory is the same directory as the executed script
    this.config.appDir = this.config.appDir ? path.resolve(this.config.appDir) : '';
    
    this.modelManager = modelManager 
      ? modelManager 
      : new ModelManager(this.config.model ? this.config.model : undefined);

    this.app = express();
    this.server = null;
    this.router = express.Router();
    this.aclRoleAssessor = {};
    this.logger = console;
    this.initialisers = {};
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
      await this.runInitialisers();
      await this.runInitialisers('00-init');

      await this.modelManager.init();
      await this.runInitialisers('01-model-initialised');

      await this.runInitialisers('02-resources-loaded');

      await this.registerServiceEndpoints();
      await this.registerRepoApiEndpoints();
      await this.runInitialisers('03-endpoints-registered');

      this.app.use(bodyParser.json());
      this.app.use(bodyParser.text());
      this.app.use(bodyParser.urlencoded({extended: true}));
      this.app.use(this.config.path, this.router);
      await this.runInitialisers('04-router-mounted');

      this.app.use((err, req, res, next) => {
        this.logger.error({err, req, res});
        res.status(500).send('Something broke!');
        next();
      });

      await this.runInitialisers('99-final');

      this.initialised = true;
    }
  }

  async runInitialisers(stage?:string)
  {
    stage = stage ? stage : 'default';
    if (this.initialisers[stage]) {
      this.initialisers[stage].forEach(async initFunction => {
        await Promise.resolve(initFunction(this));
      });
    }
  }

  addInitialiser(initialiser, stage?:string)
  {
    stage = stage ? stage : 'default';
    if (this.initialisers[stage] === undefined) {
      this.initialisers[stage] = [];
    }
    this.initialisers[stage].push(initialiser);
  }

  addInitialisers(initialisers, stage?:string)
  {
    initialisers.forEach(initialiser => {
      this.addInitialiser(initialiser, stage);
    });
  }

  addRoleAssessor(roleAssessor:ServerAclRoleAssessor)
  {
    this.aclRoleAssessor[roleAssessor.role] = roleAssessor;
  }

  addRoleAssessors(roleAssessors:ServerAclRoleAssessor[])
  {
    roleAssessors.forEach(roleAssessor => {
      this.addRoleAssessor(roleAssessor);
    });
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
