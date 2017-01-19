'use strict'

var ResourceLoader = require('mzen/lib/resource-loader');
var Repo = require('mzen/lib/repo');
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
        if (fs.lstatSync(initDirectoryPath + '/' + filename).isDirectory()) return;
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
    filePaths.forEach(function(filePath){
      if (filePath && filePath[0] == '.') return;
      promise.then(function(){
        let initFunction = require(filePath);
        promise = Promise.resolve();
        if (typeof initFunction == 'function') {
          let result = initFunction.call(this);
          if (result && result.constructor && result.constructor instanceof Promise) {
            promise = result;
          } 
        }
        return promise;
      }.bind(this));
    }.bind(this));
    
    return promise;
  }
  loadResources()
  {
    const loader = new ResourceLoader();
    return Promise.resolve().then(function(){
      const accessors = loader.getResources([this.config['appDir']], this.config['aclDirName'] + '/assessor');
      for (let accessorName in accessors) {
        if (!accessors.hasOwnProperty(accessorName)) continue;
        const roleAssessor = new accessors[accessorName](null, this.modelManager.repos);
        this.aclRoleAssessor[roleAssessor.role] = roleAssessor;
      }
      return this;
    }.bind(this));
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
      
      // Remove any enpoints which have been disabled
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
      remoteObject.setAcl(acl);
      remoteObject.initRouter(this.router);
    }
  }
  registerRepoApiEndpoints()
  {
    // Mixin ServerRepoMixin methods into Repo - handlers for the api endpoints
    const mixinFields = Object.getOwnPropertyNames(ServerRepoMixin.prototype);
    mixinFields.forEach(function(mixinField){
      Repo.prototype[mixinField] = ServerRepoMixin.prototype[mixinField];
    });

    const repos = this.modelManager.repos;
    
    for (var repoName in repos)
    {
      const apiConfig = repos[repoName].config['api'] ? repos[repoName].config['api']: {};
      const enable = (apiConfig['enable'] !== undefined) ? apiConfig['enable'] : true;
      const repoAclConfig = apiConfig['acl'] ? apiConfig['acl'] : {};
      const disableEndpoints = apiConfig['disableEndpoints'] ? apiConfig['disableEndpoints'] : {};
      const disableEndpointGroups = apiConfig['disableEndpointGroups'] ? apiConfig['disableEndpointGroups'] : {};
      var endpoints = apiConfig['endpoints'] ? apiConfig['endpoints'] : {};

      if (!enable) continue;
      
      // Append default end points to endpoint config
      for (var defaultEndpointName in ServerRepoMixin.endpoints) {
        if (disableEndpoints[endpointName] != true) {
          if (endpoints[defaultEndpointName]) {
            // The repo already has this endpoint config - merge the two configs
            endpoints[defaultEndpointName] = merge(ServerRepoMixin.endpoints[defaultEndpointName], endpoints[defaultEndpointName]);
          } else {
            endpoints[defaultEndpointName] = ServerRepoMixin.endpoints[defaultEndpointName];
          }
        }
      }
      
      // Remove any enpoints which have been disabled
      for (var endpointName in endpoints) {
        var groups = endpoints[endpointName]['groups'];
        if (Array.isArray(groups)) {
          groups.forEach(function(group){
            if (endpoints[endpointName] && disableEndpointGroups[group] == true) delete endpoints[endpointName]
          });
        }
        if (endpoints[endpointName] && disableEndpoints[endpointName] == true) delete endpoints[endpointName];
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
      remoteObject.setAcl(acl);
      remoteObject.initRouter(this.router);
    }
  }
  start()
  {
    this.app.use(bodyParser.json()); // for parsing application/json
    this.app.use(bodyParser.text());
    this.app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    return this.bootInitScripts().then(function(){
      this.app.use(this.config['path'], this.router);
      this.app.use(function (err, req, res, next) {
        console.error(err.stack)
        res.status(500).send('Something broke!')
      });
      this.server = this.app.listen(this.config['port'], function(){
        console.log('App listening on port ' + this.config['port']);
      }.bind(this));
      debugger;
    }.bind(this));
  }
  shutdown()
  {
    console.log('Shutting down server');
    return this.modelManager.shutdown().then(function(){
      return this.server ? this.server.close() : undefined;
    }.bind(this));
  }
}
module.exports = Server;
