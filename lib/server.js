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
    var initDirectoryPath = this.config['appDir'] + '/' + this.config['initDirName'];
    var initScripts = {};
    if (fs.existsSync(initDirectoryPath)) {
      var filenames = fs.readdirSync(initDirectoryPath);
      filenames.forEach(function(filename){
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
      promise.then(function(){
        var initFunction = require(filePath);
        if (typeof initFunction == 'function') {
          var result = initFunction.call(this);
          if (result && result.constructor && result.constructor instanceof Promise) promise = result;
        }
      }.bind(this));
    }.bind(this));
    
    return promise;
  }
  loadResources()
  {
    var loader = new ResourceLoader();
    return Promise.resolve().then(function(){
      var accessors = loader.getResources([this.config['appDir']], this.config['aclDirName'] + '/assessor');
      for (let accessorName in accessors) {
        if (!accessors.hasOwnProperty(accessorName)) continue;
        var roleAssessor = new accessors[accessorName];
        this.addAclRoleAccessor(roleAssessor);
      }
      return this;
    }.bind(this));
  }
  registerServiceEndpoints()
  {
    var services = this.modelManager.services;  
    for (let serviceName in services)
    {
      var apiConfig = services[serviceName].config['api'] ? services[serviceName].config['api'] : {};
      var repoAclConfig = apiConfig['acl'] ? apiConfig['acl'] : {};
      var endpoints = apiConfig['endpoints'] ? apiConfig['endpoints'] : [];
      var endpointsEnable = apiConfig['endpointsEnable'] ? apiConfig['endpointsEnable'] : {};
      
      // Remove any enpoints which have been disabled
      for (var endpointName in endpoints) {
        if (endpointsEnable[endpointName] === false) {
          delete endpoints[endpointName];
        }
      }
      
      var aclConfig = {
        rules: repoAclConfig['rules'],
        endpoints: endpoints
      };
      var remoteConfig = {
        path: '/service/' + serviceName,
        endpoints: endpoints
      };
      
      var remoteObject = new ServerRemoteObject(services[serviceName], remoteConfig);
      remoteObject.setAcl(new ServerAcl(aclConfig));
      remoteObject.initRouter(this.router);
    }
  }
  registerRepoApiEndpoints()
  {
    // Mixin ServerRepoMixin methods into Repo - handlers for the api endpoints
    var mixinFields = Object.getOwnPropertyNames(ServerRepoMixin.prototype);
    mixinFields.forEach(function(mixinField){
      Repo.prototype[mixinField] = ServerRepoMixin.prototype[mixinField];
    });

    var repos = this.modelManager.repos;
    
    for (var repoName in repos)
    {
      var apiConfig = repos[repoName].config['api'] ? repos[repoName].config['api'] : {};
      var repoAclConfig = apiConfig['acl'] ? apiConfig['acl'] : {};
      var endpointsEnable = apiConfig['endpointsEnable'] ? apiConfig['endpointsEnable'] : {};
      var endpoints = apiConfig['endpoints'] ? apiConfig['endpoints'] : {};
      
      // Append default end points to endpoint config
      for (var defaultEndpointName in ServerRepoMixin.endpoints) {
        if (endpoints[defaultEndpointName] === undefined && endpointsEnable[endpointName] !== false) {
          endpoints[defaultEndpointName] = ServerRepoMixin.endpoints[defaultEndpointName];
        }
      }
      
      // Remove any enpoints which have been disabled
      for (var endpointName in endpoints) {
        if (endpointsEnable[endpointName] === false) {
          delete endpoints[endpointName];
        }
      }
      
      var aclConfig = {
        rules: repoAclConfig['rules'],
        endpoints: endpoints
      };
      var remoteConfig = {
        path: '/repo/' + repoName,
        endpoints: endpoints
      };
      var remoteObject = new ServerRemoteObject(repos[repoName], remoteConfig);
      remoteObject.setAcl(new ServerAcl(aclConfig));
      remoteObject.initRouter(this.router);
    }
  }
  start()
  {
    this.app.use(bodyParser.json()); // for parsing application/json
    this.app.use(bodyParser.text());
    this.app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    this.app.use(this.config['path'], this.router);
    this.app.use(function (err, req, res, next) {
      console.error(err.stack)
      res.status(500).send('Something broke!')
    });
    this.bootInitScripts().then(function(){
      this.server = this.app.listen(this.config['port'], function(){
        console.log('App listening on port ' + this.config['port']);
      }.bind(this));
    }.bind(this));
  }
  shutdown()
  {
    console.log('Shutting down server');
    return this.modelManager.shutdown().then(function(){
      return this.server ? this.server.close() : undefined;
    }.bind(this));
  }
  addAclRoleAccessor(roleAssessor)
  {
    if (this.modelManager) roleAssessor.repos = this.modelManager.repos;
    this.repos[roleAssessor.role] = roleAssessor;
  }
}
module.exports = Server;
