import { ResourceLoader, ModelManager } from 'mzen';
import ServerRemoteObject from './remote-object';
import ServerAcl from './acl';
import Http = require('http');
import express = require('express');
import bodyParser = require('body-parser');
import fs = require('fs');

export interface ServerConfig
{
  path?: string;
  port?: number;
  appDir?: string;
  initDirName?: string;
  aclDirName?: string;
  model?: ModelManager 
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
  
  constructor(options?: ServerConfig, modelManager?: ModelManager)
  {
    this.config = options ? options : {};
    this.config.path = this.config.path ? this.config.path : '/api';
    this.config.port = this.config.port ? this.config.port : 3838;
    // Default appDir directory is the same directory as the executed script
    this.config.appDir = this.config.appDir ? this.config.appDir : '';
    this.config.initDirName = this.config.initDirName ? this.config.initDirName : '/init';
    this.config.aclDirName = this.config.aclDirName ? this.config.aclDirName : '/acl';
    
    this.modelManager = modelManager ? modelManager : new ModelManager(this.config.model ? this.config.model : undefined);

    this.app = express();
    this.server = null;
    this.router = express.Router();
    this.aclRoleAssessor = {};
    this.setLogger(console);
  }
  setLogger(logger)
  {
    this.logger = logger;
    return this;
  }
  async init()
  {
    // Add app model directory based on value of appDir if no model directories have been configured
    if (this.modelManager.config.modelDirs.length == 0) {
      this.modelManager.config.modelDirs.push(this.config.appDir + '/model');
    }
    // Add default model directory - this is model functionality provided by the mzen-server package
    this.modelManager.config.modelDirs.unshift(__dirname + '/model');

    await this.modelManager.init();
    await this.loadResources();
    await this.registerServiceEndpoints();
    await this.registerRepoApiEndpoints();
  }
  bootInitScripts()
  {
    const initDirectoryPath = this.config.appDir + '/' + this.config.initDirName;
    var initScripts = {};
    if (fs.existsSync(initDirectoryPath)) {
      var filenames = fs.readdirSync(initDirectoryPath);
      filenames.forEach(function(filename){
        if (fs.lstatSync(initDirectoryPath + '/' + filename).isDirectory() || filename[0] == '.') return;
        initScripts[filename] = initDirectoryPath + '/' + filename;
      });
    }
    var filenames = Object.keys(initScripts);

    // Sort by filename
    // - the order of execution is important so files should be named to give the correct order
    filenames.sort(function(a, b) {
      return (a > b) ? 1 : 0;
    });

    var filePaths = [];
    filenames.forEach(function(filename){
      filePaths.push(initScripts[filename]);
    });

    var promise = Promise.resolve();
    filePaths.forEach((filePath) => {
      promise.then(() => {
        let initFunction = require(filePath);
        promise = Promise.resolve();
        if (typeof initFunction == 'function') {
          let result = initFunction.call(this);
          if (result && result.constructor && result.constructor instanceof Promise) {
            promise = result;
          }
        }
        return promise;
      });
    });

    return promise;
  }
  async loadResources()
  {
    const loader = new ResourceLoader();

    const assessors = loader.getResources([this.config.appDir], this.config.aclDirName + '/role-assessor');
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
      const apiConfig = services[serviceName].config.api ? services[serviceName].config.api : {};
      const repoAclConfig = apiConfig.acl ? apiConfig.acl : {};
      const endpointsEnable = apiConfig.endpointsEnable ? apiConfig.endpointsEnable : {};
      var endpoints = apiConfig.endpoints ? apiConfig.endpoints : {};

      // Remove any endpoints that have been disabled
      for (var endpointName in endpoints) {
        if (endpointsEnable[endpointName] === false) {
          delete endpoints[endpointName];
        }
      }

      if (Object.keys(endpoints).length == 0) continue; // This service has no end points - nothing more to do

      const aclConfig = {
        rules: repoAclConfig.rules,
        endpoints: endpoints
      };
      var acl = new ServerAcl(aclConfig);
      acl.loadDefaultRoleAssessors();
      acl.setRepos(this.modelManager.repos);
      for (var role in this.aclRoleAssessor) {
        acl.addRoleAssessor(this.aclRoleAssessor[role]);
      }

      const remoteConfig = {
        path: '/service/' + camelToKebab(serviceName),
        endpoints: endpoints
      };

      var remoteObject = new ServerRemoteObject(services[serviceName], remoteConfig);
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
      const apiConfig = repos[repoName].config.api ? repos[repoName].config.api: {};
      const enable = (apiConfig.enable !== undefined) ? apiConfig.enable : true;
      const repoAclConfig = apiConfig.acl ? apiConfig.acl : {};
      const endpointsDisable = apiConfig.endpointsDisable ? apiConfig.endpointsDisable : {};
      const endpointGroupsDisable = apiConfig.endpointGroupsDisable ? apiConfig.endpointGroupsDisable : {};
      var endpoints = apiConfig.endpoints ? {...apiConfig.endpoints, ...repoEndpointsConfigDefault} : repoEndpointsConfigDefault;

      if (!enable) continue;

      // Remove any enpoints that have been disabled
      for (var endpointName in endpoints) {
        var groups = endpoints[endpointName].groups;
        if (Array.isArray(groups)) {
          groups.forEach(function(group){
            if (endpoints[endpointName] && endpointGroupsDisable[group] == true) delete endpoints[endpointName]
          });
        }
        if (endpoints[endpointName] && endpointsDisable[endpointName] == true) delete endpoints[endpointName];
      }

      if (Object.keys(endpoints).length == 0) continue; // This repo has no end points - nothing more to do

      const aclConfig = {
        rules: repoAclConfig.rules,
        endpoints: endpoints
      };
      var acl = new ServerAcl(aclConfig);
      acl.loadDefaultRoleAssessors();
      acl.setRepos(this.modelManager.repos);
      for (var role in this.aclRoleAssessor) {
        acl.addRoleAssessor(this.aclRoleAssessor[role]);
      }

      const remoteConfig = {
        path: '/repo/' + camelToKebab(repoName),
        endpoints: endpoints
      };
      var remoteObject = new ServerRemoteObject(repos[repoName], remoteConfig);
      remoteObject.setLogger(this.logger);
      remoteObject.setAcl(acl);
      remoteObject.initRouter(this.router);
    }
  }
  async start()
  {
    this.app.use(bodyParser.json()); // for parsing application/json
    this.app.use(bodyParser.text());
    this.app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

    await this.bootInitScripts()

    this.app.use(this.config.path, this.router);
    this.app.use((err, req, res, next) => {
      this.logger.error({err, req, res});
      res.status(500).send('Something broke!');
      next();
    });
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

const repoEndpointsConfigDefault =
{
  getFind: {
    path: '/',
    method: '_find',
    verbs: ['get'],
    groups: ['default', 'read'],
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
  getFindOne: {
    path: '/find-one',
    method: '_findOne',
    verbs: ['get'],
    groups: ['default', 'read'],
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
  getCount: {
    path: '/count',
    method: '_count',
    verbs: ['get'],
    groups: ['default', 'read'],
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
  getFindByPkey: {
    path: '/:pkey',
    method: '_findByPkey',
    verbs: ['get', 'head'],
    groups: ['default', 'read'],
    args: [
      {srcName: 'pkey', src: 'param', type: 'ObjectID'}
    ],
    response: {
      success: {http: {code: 200, contentType: 'json'}},
      error: {
        RepoErrorValidation: {http: {code: 403}},
        ServerErrorRepoNotFound: {http: {code: 404}}
      }
    }
  },
  getExistsByPkey: {
    path: '/:pkey/exists',
    method: '_existsByPkey',
    verbs: ['get'],
    groups: ['default', 'read'],
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
  headExistsByPkey: {
    path: '/:pkey',
    method: '_existsByPkey',
    verbs: ['head'],
    groups: ['default', 'read'],
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
  putUpsertOne: {
    path: '/',
    method: '_upsertOne',
    verbs: ['put'],
    groups: ['default', 'write'],
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
  putUpdateOneByPkey: {
    path: '/:pkey',
    method: '_updateOneByPkey',
    verbs: ['put'],
    groups: ['default', 'write'],
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
  postInsert: {
    path: '/',
    method: '_insert',
    verbs: ['post'],
    groups: ['default', 'write'],
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
  postUpdateOne: {
    path: '/update',
    method: '_updateOne',
    verbs: ['post'],
    groups: ['default', 'write'],
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
  deleteOneByPkey: {
    path: '/:pkey',
    method: '_deleteOneByPkey',
    verbs: ['delete'],
    groups: ['default', 'write'],
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

export default Server;
