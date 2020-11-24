import { 
  ModelManager
} from 'mzen';
import { 
  ServerRemoteObject
} from './remote-object';
import { 
  ServerConfig
} from './server-config';
import { 
  ServerApiConfig
} from './api-config';
import ServerAcl from './acl';
import ServerAclRoleAssessor from './acl/role-assessor';
import Http = require('http');
import express = require('express');
import path = require('path');

export class Server
{
  modelManager: ModelManager;
  config: ServerConfig;
  apiConfigs: Array<ServerApiConfig>;
  app: express.Application;
  server: Http.Server;
  router: express.Router;
  aclRoleAssessor: {[key: string]: any};
  logger: any;
  initialisers: {
    [key: string]: any[]
  };
  shutdownHandlers: {
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

    this.apiConfigs = [];
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

      this.registerEndpoints();
      await this.runInitialisers('03-endpoints-registered');

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
      for (var initFunction of this.initialisers[stage]) {
        var shutdownHandler = await Promise.resolve(initFunction(this));
        if (typeof shutdownHandler == 'function') {
          this.addShutdownHandler(shutdownHandler, stage);
        }
      }
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

  addShutdownHandler(handler, stage?:string)
  {
    stage = stage ? stage : 'default';
    if (this.shutdownHandlers[stage] === undefined) {
      this.shutdownHandlers[stage] = [];
    }
    this.shutdownHandlers[stage].unshift(handler);
  }

  addShutdownHandlers(handlers, stage?:string)
  {
    handlers.forEach(handler => {
      this.addShutdownHandler(handler, stage);
    });
  }

  async runShutdownHandlers(stage?:string)
  {
    stage = stage ? stage : 'default';
    if (
      this.shutdownHandlers[stage]
      && this.shutdownHandlers[stage].length
    ) {
      for (var handler of this.shutdownHandlers[stage]) {
        await Promise.resolve(handler());
      }
    }
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

  addApiConfig(config:ServerApiConfig)
  {
    this.apiConfigs.push(config);
  }

  addApiConfigs(configs:Array<ServerApiConfig>)
  {
    this.apiConfigs = this.apiConfigs.concat(configs);
  }

  registerEndpoints() 
  {
    if (this.apiConfigs) {
      for (var apiConfig of this.apiConfigs) {
        this.registerEndpointsConfig(apiConfig);
      }
    }
  }

  registerEndpointsConfig(config:ServerApiConfig)
  {
    var remoteObjectName = null;
    var remoteObject = null;
    if (config.object) {
      remoteObject = config.object;
    } else if (config.service) {
      remoteObjectName = config.service;
      remoteObject = this.modelManager.services[remoteObjectName];
    } else if (config.repo) {
      remoteObjectName = config.repo;
      remoteObject = this.modelManager.repos[remoteObjectName];
    }

    var path = config.path != null 
      ? config.path 
      : '/' + camelToKebab(remoteObjectName);

    var enable = config.enable ? config.enable : {};
    var aclConfig = config.acl ? config.acl : {};
    var endpointsDisable = config.disable ? config.disable : {};
    var endpointDisableGroup = config.disableGroup ? config.disableGroup : {};
    var endpoints = config.endpoints ? config.endpoints : {};

    if (!enable) return;
    
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
    if (Object.keys(endpoints).length == 0) return;

    var acl = new ServerAcl({
      rules: aclConfig.rules,
      endpoints
    });
    acl.loadDefaultRoleAssessors();
    acl.setRepos(this.modelManager.repos);
    for (var role in this.aclRoleAssessor) {
      acl.addRoleAssessor(this.aclRoleAssessor[role]);
    }

    var remote = new ServerRemoteObject(
      remoteObject, 
      {
        path, 
        endpoints,
        server: this.config
      }
    );
    remote.setLogger(this.logger);
    remote.setAcl(acl);
    remote.initRouter(this.router);
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

    await this.runShutdownHandlers('99-final');
    await this.runShutdownHandlers('04-router-mounted');
    await this.runShutdownHandlers('03-endpoints-registered');
    await this.runShutdownHandlers('02-resources-loaded');
    await this.runShutdownHandlers('01-model-initialised');

    await this.modelManager.shutdown();

    await this.runShutdownHandlers('00-init');
    await this.runShutdownHandlers();

    return this.server ? this.server.close() : undefined;
  }
}

function camelToKebab(input)
{
  return input ? input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() : '';
}

export default Server;
