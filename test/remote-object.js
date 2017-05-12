'use strict'
var should = require('should');
var ServerRemoteObject = require('../lib/remote-object');
var ServerAcl = require('../lib/acl');
var ExpressMockRequest = require('./express/mock-request');
var ExpressMockResponse = require('./express/mock-response');

describe('ServerRemoteObject', function(){
  describe('getMiddlewareConfig()', function(){
    it('generates middleware for configured endpoints', function(done){
      var targetObject = {
        save: function(){
          return Promise.resolve('save response');
        },
        getLatest: function(){
          return Promise.resolve('getLatest response');
        },
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post']
          },
          'get-latest': {
            path: '/latest',
            method: 'getLatest',
            verbs: ['get']
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      should(middlewareConfigs['post-save']['post']['verb']).eql('post');
      should(middlewareConfigs['post-save']['post']['path']).eql('/api/save');
      should(middlewareConfigs['get-latest']['get']['verb']).eql('get');
      should(middlewareConfigs['get-latest']['get']['path']).eql('/api/latest');
      
      var promises = [];
      
      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      promises.push(middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data).eql('save response');
      }));
      
      var reqGetLatest = new ExpressMockRequest;
      var resGetLatest = new ExpressMockResponse;
      promises.push(middlewareConfigs['get-latest']['get']['callback'](reqGetLatest, resGetLatest).then(function(){
        should(resGetLatest.data).eql('getLatest response');
      }));
      
      Promise.all(promises).then(function(){
        done()
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured body as argument to remote method', function(done){
      var targetObject = {
        save: function(requestBody){
          return Promise.resolve(requestBody);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: [
              {src: 'body'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      should(middlewareConfigs['post-save']['post']['verb']).eql('post');
      should(middlewareConfigs['post-save']['post']['path']).eql('/api/save');
      
      var reqSave = new ExpressMockRequest({body: 'post body'});
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data).eql('post body');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured body as field on argument to remote method', function(done){
      var targetObject = {
        save: function(data){
          return Promise.resolve(data.theBody);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: {
              theBody: {src: 'body'}
            }
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      should(middlewareConfigs['post-save']['post']['verb']).eql('post');
      should(middlewareConfigs['post-save']['post']['path']).eql('/api/save');
      
      var reqSave = new ExpressMockRequest({body: 'post body'});
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data).eql('post body');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured body-field as argument to remote method', function(done){
      var targetObject = {
        save: function(content){
          return Promise.resolve(content);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: [
              {srcName: 'content', src: 'body-field'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqSave = new ExpressMockRequest({body: {content: 'content value'}});
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data).eql('content value');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured body-field as field on argument to remote method', function(done){
      var targetObject = {
        save: function(data){
          return Promise.resolve(data.theBodyField);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: { 
              theBodyField: {srcName: 'content', src: 'body-field'}
            }
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqSave = new ExpressMockRequest({body: {content: 'content value'}});
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data).eql('content value');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured param as argument to remote method', function(done){
      var targetObject = {
        getByPkey: function(pkey){
          return Promise.resolve(pkey);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-byPkey': {
            path: '/:pkey',
            method: 'getByPkey',
            verbs: ['get'],
            args: [
              {srcName: 'pkey', src: 'param'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetByPkey = new ExpressMockRequest({params: {pkey: 123}});
      var resGetByPkey = new ExpressMockResponse;
      middlewareConfigs['get-byPkey']['get']['callback'](reqGetByPkey, resGetByPkey).then(function(){
        should(resGetByPkey.data).eql(123);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured params as argument to remote method', function(done){
      var targetObject = {
        getByPkey: function(params){
          return Promise.resolve(params);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-byPkey': {
            path: '/:pkey',
            method: 'getByPkey',
            verbs: ['get'],
            args: [
              {src: 'params'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetByPkey = new ExpressMockRequest({params: {pkey: 123}});
      var resGetByPkey = new ExpressMockResponse;
      middlewareConfigs['get-byPkey']['get']['callback'](reqGetByPkey, resGetByPkey).then(function(){
        should(resGetByPkey.data).eql({pkey: 123});
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured query-field as argument to remote method', function(done){
      var targetObject = {
        getAll: function(offset){
          return Promise.resolve(offset);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            args: [
              {srcName: 'offset', src: 'query-field'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](reqGetAll, resGetAll).then(function(){
        should(resGetAll.data).eql(50);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured query as argument to remote method', function(done){
      var targetObject = {
        getAll: function(query){
          return Promise.resolve(query);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            args: [
              {src: 'query'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](reqGetAll, resGetAll).then(function(){
        should(resGetAll.data).eql({offset: 50});
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured request as argument to remote method', function(done){
      var targetObject = {
        getAll: function(request){
          return Promise.resolve(request);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            args: [
              {src: 'request'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](reqGetAll, resGetAll).then(function(){
        should(resGetAll.data).eql(reqGetAll);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured response as argument to remote method', function(done){
      var targetObject = {
        getAll: function(response){
          return Promise.resolve(response);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            args: [
              {src: 'response'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](reqGetAll, resGetAll).then(function(){
        should(resGetAll.data).eql(resGetAll);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns 200 response code by default', function(done){
      class CustomerErrorValidation extends Error {}
      class CustomerErrorNotFound extends Error {}
      
      var targetObject = {
        save: function(){
          return Promise.resolve('success');
        },
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post']
          },
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.code).eql(200);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns configured success response code', function(done){
      class CustomerErrorValidation extends Error {}
      class CustomerErrorNotFound extends Error {}
      
      var targetObject = {
        save: function(){
          return Promise.resolve('success');
        },
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            response: {
              success: {http: {code: 202}}
            }
          },
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.code).eql(202);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns 500 response code on error', function(done){
      var targetObject = {
        getAll: function(){
          return Promise.reject(new Error('Error message'));
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get']
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest;
      var resGetAll = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](reqGetAll, resGetAll).then(function(){
        should(resGetAll.code).eql(500);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns configured error response code', function(done){
      class CustomerErrorValidation extends Error {}
      class CustomerErrorNotFound extends Error {}
      
      var targetObject = {
        save: function(){
          return Promise.reject(new CustomerErrorValidation('403 error message'));
        },
        getOne: function(){
          return Promise.reject(new CustomerErrorNotFound('404 error message'));
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            response: {
              error: {
                CustomerErrorValidation: {http: {code: 403}},
                CustomerErrorNotFound: {http: {code: 404}}
              }
            }
          },
          'get-one': {
            path: '/getOne',
            method: 'getOne',
            verbs: ['get'],
            response: {
              error: {
                CustomerErrorValidation: {http: {code: 403}},
                CustomerErrorNotFound: {http: {code: 404}}
              }
            }
          },
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var promises = [];

      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.code).eql(403);
      }).catch(function(error){
        should(error).eql('403 error message');
      });
      
      var reqGetOne = new ExpressMockRequest;
      var resGetOne = new ExpressMockResponse;
      middlewareConfigs['get-one']['get']['callback'](reqGetOne, resGetOne).then(function(){
        should(resGetOne.code).eql(404);
      }).catch(function(error){
        should(error).eql('404 error message');
      });
      
      Promise.all(promises).then(function(){
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('typecasts injected arguments', function(done){
      var targetObject = {
        save: function(stringToNumber, stringToBooleanTrue, stringToBooleanFalse, stringToDate, stringToObjectId){
          return Promise.resolve({
            stringToNumber: stringToNumber,
            stringToBooleanTrue: stringToBooleanTrue,
            stringToBooleanFalse: stringToBooleanFalse,
            stringToDate: stringToDate,
            stringToObjectId: stringToObjectId
          });
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: [
              {srcName: 'stringToNumber', type: Number, src: 'body-field'},
              {srcName: 'stringToBooleanTrue', type: Boolean, src: 'body-field'},
              {srcName: 'stringToBooleanFalse', type: Boolean, src: 'body-field'},
              {srcName: 'stringToDate', type: Date, src: 'body-field'},
              {srcName: 'stringToObjectId', type: 'ObjectID', src: 'body-field'}
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqSave = new ExpressMockRequest({body: {
        stringToNumber: '456',
        stringToBooleanTrue: '1',
        stringToBooleanFalse: '0',
        stringToDate: '2016-12-08T17:25:55.588Z',
        stringToObjectId: '507f191e810c19729de860ea'
      }});
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data.stringToNumber).eql(456);
        should(resSave.data.stringToNumber.constructor).eql(Number);
        should(resSave.data.stringToBooleanTrue).eql(true);
        should(resSave.data.stringToBooleanTrue.constructor).eql(Boolean);
        should(resSave.data.stringToBooleanFalse).eql(false);
        should(resSave.data.stringToBooleanFalse.constructor).eql(Boolean);
        should(resSave.data.stringToDate.constructor).eql(Date);
        should(resSave.data.stringToObjectId.constructor.name).eql('ObjectID');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns 403 error response code on arg "required" validation error', function(done){
      var targetObject = {
        save: function(name){
          return Promise.resolve(name);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: [
              {srcName: 'name', type: String, src: 'body-field', required: true},
            ]
          }
        }
      };
      
      var promises = [];
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqSaveFail = new ExpressMockRequest;
      var resSaveFail = new ExpressMockResponse;
      promises.push(middlewareConfigs['post-save']['post']['callback'](reqSaveFail, resSaveFail).then(function(){
        should(resSaveFail.code).eql(403);
      }));
      
      var reqSaveSuccess = new ExpressMockRequest({body: {name: 'Kevin'}});
      var resSaveSuccess = new ExpressMockResponse;
      promises.push(middlewareConfigs['post-save']['post']['callback'](reqSaveSuccess, resSaveSuccess).then(function(){
        should(resSaveSuccess.data).eql('Kevin');
      }));
      
      Promise.all(promises).then(function(){
        done();
      }).catch(function(err){
        done(err)
      });
    });
    it('returns 403 error response code on arg "notNull" validation error', function(done){
      var targetObject = {
        save: function(name){
          return Promise.resolve(name);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: [
              {srcName: 'name', type: String, src: 'body-field', notNull: true},
            ]
          }
        }
      };
      
      var promises = [];
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqSaveFail = new ExpressMockRequest({body: {name: 'NULL'}});
      var resSaveFail = new ExpressMockResponse;
      promises.push(middlewareConfigs['post-save']['post']['callback'](reqSaveFail, resSaveFail).then(function(){
        should(resSaveFail.code).eql(403);
      }));
      
      var reqSaveSuccess = new ExpressMockRequest({body: {name: 'Kevin'}});
      var resSaveSuccess = new ExpressMockResponse;
      promises.push(middlewareConfigs['post-save']['post']['callback'](reqSaveSuccess, resSaveSuccess).then(function(){
        should(resSaveSuccess.data).eql('Kevin');
      }));
      
      Promise.all(promises).then(function(){
        done();
      }).catch(function(err){
        done(err)
      });
    });
    it('injects callback arg with default value for undefined input', function(done){
      var targetObject = {
        save: function(name){
          return Promise.resolve(name);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: [
              {srcName: 'name', type: String, src: 'body-field', defaultValue: 'Kevin'},
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data).eql('Kevin');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects callback arg with default value for null input', function(done){
      var targetObject = {
        save: function(name){
          return Promise.resolve(name);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            args: [
              {srcName: 'name', type: String, src: 'body-field', defaultValue: 'Kevin'},
            ]
          }
        }
      };
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var reqSave = new ExpressMockRequest({body: {name: null}});
      var resSave = new ExpressMockResponse;
      middlewareConfigs['post-save']['post']['callback'](reqSave, resSave).then(function(){
        should(resSave.data).eql('Kevin');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns 401 unauthorized if not permitted by ACL', function(done){
      var targetObject = {
        getAll: function(){
          return Promise.resolve();
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            args: [],
            acl: {
              rules: [
                {allow: false, role: 'all'}
              ]
            }
          }
        }
      };
      
      var acl = new ServerAcl({
        endpoints: config.endpoints
      });
      acl.loadDefaultRoleAssessors();
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      remoteObject.setAcl(acl);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var req = new ExpressMockRequest;
      var res = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](req, res).then(function(){
        should(res.code).eql(401);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('executes remote method if ACL permits', function(done){
      var targetObject = {
        getAll: function(){
          return Promise.resolve('success');
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            args: [],
            acl: {
              rules: [
                {allow: true, role: 'all'}
              ]
            }
          }
        }
      };
      
      var acl = new ServerAcl({
        endpoints: config.endpoints
      });
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      remoteObject.setAcl(acl);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var req = new ExpressMockRequest;
      var res = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](req, res).then(function(){
        should(res.data).eql('success');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects acl-context into callack method', function(done){
      var targetObject = {
        getAll: function(aclContext){
          return Promise.resolve(aclContext);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            args: [
              {srcName: 'acl-context'},
            ],
            acl: {
              rules: [
                {allow: true, role: 'all'}
              ]
            }
          }
        }
      };

      var mockRoleAssessor = {
        role: 'user',
        initContext: function(request, context) {
          context['user'] = {id: '123'};
          return Promise.resolve();
        }
      };
      
      var acl = new ServerAcl({
        endpoints: config.endpoints
      });
      acl.addRoleAssessor(mockRoleAssessor);
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      remoteObject.setAcl(acl);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var req = new ExpressMockRequest;
      var res = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](req, res).then(function(){
        should(res.data.user.id).eql('123');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects acl-conditions into callack method', function(done){
      var targetObject = {
        getAll: function(aclConditions){
          return Promise.resolve(aclConditions);
        }
      };
      
      var config = {
        path: '/api',
        endpoints: {
          'get-all': {
            path: '/',
            method: 'getAll',
            verbs: ['get'],
            args: [
              {srcName: 'acl-conditions'},
            ],
            acl: {
              rules: [
                {allow: true, role: 'user'}
              ]
            }
          }
        }
      };

      var mockRoleAssessor = {
        role: 'user',
        initContext: function(request, context) {
          return Promise.resolve();
        },
        hasRole: function(context) {
          return Promise.resolve({userId: '123'});
        }
      };
      
      var acl = new ServerAcl({
        endpoints: config.endpoints
      });
      acl.addRoleAssessor(mockRoleAssessor);
      
      var remoteObject = new ServerRemoteObject(targetObject, config);
      remoteObject.setAcl(acl);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();
      
      var req = new ExpressMockRequest;
      var res = new ExpressMockResponse;
      middlewareConfigs['get-all']['get']['callback'](req, res).then(function(){
        should(res.data.userId).eql('123');
        done();
      }).catch(function(err){
        done(err);
      });
    });
  });
});
