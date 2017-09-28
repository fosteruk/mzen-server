'use strict'

var { ResourceLoader, Repo } = require('mzen');
var ServerRemoteObject = require('./remote-object');
var ServerAcl = require('./acl');
var ServerRepoMixin = require('./repo-mixin');
var express = require('express');
var bodyParser = require('body-parser');
var clone = require('clone');
var fs = require('fs');
var merge = require('merge');

class Server
{
  constructor(modelManager, options = {}) 
  {
    this.modelManager = modelManager;
    this.config = options ? options : {};
    this.config['path'] = this.config['path'] ? this.config['path'] : '/api';
    this.config['port'] = this.config['port'] ? this.config['port'] : 3000;
    this.config['appDir'] = this.config['appDir'] ? this.config['appDir'] : '';
    this.config['initDirName'] = this.config['initDirName'] ? this.config['initDirName'] : '/init';
    this.config['aclDirName'] = this.config['aclDirName'] ? this.config['aclDirName'] : '/acl';
    
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
  init()
  {
    if (this.modelManager.config['modelDirs'].length == 0) {
      this.modelManager.config['modelDirs'].push(this.config['appDir'] + '/model');
    }
    // Add default model directory
    this.modelManager.config['modelDirs'].unshift(__dirname + '/model');
    
    return this
    .modelManager
    .init()
    .then(function(){
      return this.loadResources();
    }.bind(this)).then(function(){
      this.registerServiceEndpoints();
      this.registerRepoApiEndpoints();
    }.bind(this));
  }
  bootInitScripts() 
  {
    const initDirectoryPath = this.config['appDir'] + '/' + this.config['initDirName'];
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
  loadResources()
  {
    const loader = new ResourceLoader();
    return Promise.resolve().then(() => {
      const accessors = loader.getResources([this.config['appDir']], this.config['aclDirName'] + '/assessor');
      for (let accessorName in accessors) {
        if (!accessors.hasOwnProperty(accessorName)) continue;
        const roleAssessor = new accessors[accessorName](null, this.modelManager.repos);
        this.aclRoleAssessor[roleAssessor.role] = roleAssessor;
      }
      return this;
    });
  }
  registerServiceEndpoints()
  {
    const services = this.modelManager.services;  
    for (let serviceName in services)
    {
      const apiConfig = services[serviceName].config['api'] ? services[serviceName].config['api'] : {};
      const repoAclConfig = apiConfig['acl'] ? apiConfig['acl'] : {};
      const endpointsEnable = apiConfig['endpointsEnable'] ? apiConfig['endpointsEnable'] : {};
      var endpoints = apiConfig['endpoints'] ? apiConfig['endpoints'] : {};
      
      // Remove any endpoints that have been disabled
      for (var endpointName in endpoints) {
        if (endpointsEnable[endpointName] === false) {
          delete endpoints[endpointName];
        }
      }
      
      const aclConfig = {
        rules: repoAclConfig['rules'],
        endpoints: endpoints
      };
      var acl = new ServerAcl(aclConfig);
      acl.loadDefaultRoleAssessors();
      acl.setRepos(this.modelManager.repos);
      for (var role in this.roleAssessor) {
        acl.addRoleAssessor(this.roleAssessor[role]);
      }
            
      const remoteConfig = {
        path: '/service/' + serviceName,
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
    // Mixin ServerRepoMixin methods into Repo - handlers for the api endpoints
    const mixinFields = Object.getOwnPropertyNames(ServerRepoMixin.prototype);
    mixinFields.forEach(function(mixinField){
      if (mixinField == 'constructor') return;
      Repo.prototype[mixinField] = ServerRepoMixin.prototype[mixinField];
    });

    const repos = this.modelManager.repos;
    
    for (var repoName in repos)
    {
      const apiConfig = repos[repoName].config['api'] ? repos[repoName].config['api']: {};
      const enable = (apiConfig['enable'] !== undefined) ? apiConfig['enable'] : true;
      const repoAclConfig = apiConfig['acl'] ? apiConfig['acl'] : {};
      const endpointsDisable = apiConfig['endpointsDisable'] ? apiConfig['endpointsDisable'] : {};
      const endpointGroupsDisable = apiConfig['endpointGroupsDisable'] ? apiConfig['endpointGroupsDisable'] : {};
      var endpoints = apiConfig['endpoints'] ? apiConfig['endpoints'] : {};

      if (!enable) continue;
      
      // Append default endpoints to endpoint config
      for (var defaultEndpointName in ServerRepoMixin.endpoints) {
        if (endpointsDisable[endpointName] != true) {
          if (endpoints[defaultEndpointName]) {
            // The repo already has this endpoint config - merge the two configs
            endpoints[defaultEndpointName] = merge(ServerRepoMixin.endpoints[defaultEndpointName], endpoints[defaultEndpointName]);
          } else {
            endpoints[defaultEndpointName] = ServerRepoMixin.endpoints[defaultEndpointName];
          }
        }
      }
      
      // Remove any enpoints that have been disabled
      for (var endpointName in endpoints) {
        var groups = endpoints[endpointName]['groups'];
        if (Array.isArray(groups)) {
          groups.forEach(function(group){
            if (endpoints[endpointName] && endpointGroupsDisable[group] == true) delete endpoints[endpointName]
          });
        }
        if (endpoints[endpointName] && endpointsDisable[endpointName] == true) delete endpoints[endpointName];
      }

      const aclConfig = {
        rules: repoAclConfig['rules'],
        endpoints: endpoints
      };
      var acl = new ServerAcl(aclConfig);
      acl.loadDefaultRoleAssessors();
      acl.setRepos(this.modelManager.repos);
      for (var role in this.roleAssessor) {
        acl.addRoleAssessor(this.roleAssessor[role]);
      }
      
      const remoteConfig = {
        path: '/repo/' + repoName,
        endpoints: endpoints
      };
      var remoteObject = new ServerRemoteObject(repos[repoName], remoteConfig);
      remoteObject.setLogger(this.logger);
      remoteObject.setAcl(acl);
      remoteObject.initRouter(this.router);
    }
  }
  start()
  {
    this.app.use(bodyParser.json()); // for parsing application/json
    this.app.use(bodyParser.text());
    this.app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    return this.bootInitScripts().then(() => {
      this.app.use(this.config['path'], this.router);
      this.app.use((err, req, res, next) => {
        this.logger.error({err, req, res});
        res.status(500).send('Something broke!')
      });
      this.server = this.app.listen(this.config['port'], () => {
        this.logger.info('Listening on port ' + this.config['port']);
      });
      
      process.on('SIGINT', () => {
        this.shutdown().then(() => {
          setTimeout(function() {
            process.exit(0);
          }, 500);
        });
      });
    });
  }
  shutdown()
  {
    this.logger.info('Shutting down');
    return this.modelManager.shutdown().then(() => {
      return this.server ? this.server.close() : undefined;
    });
  }
}
module.exports = Server;
