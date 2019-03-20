import should = require('should');
import ServerRemoteObject from '../../lib/remote-object';
import ServerAcl from '../../lib/acl';
import ServerAclRoleAssessor from '../../lib/acl/role-assessor';
import ExpressMockRequest from '../fixtures/express/mock-request';
import ExpressMockResponse from '../fixtures/express/mock-response';

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

      should(middlewareConfigs[0].verb).eql('post');
      should(middlewareConfigs[0].path).eql('/api/save');
      should(middlewareConfigs[1].verb).eql('get');
      should(middlewareConfigs[1].path).eql('/api/latest');

      var promises = [];

      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      promises.push(middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData).eql('save response');
      }));

      var reqGetLatest = new ExpressMockRequest;
      var resGetLatest = new ExpressMockResponse;
      promises.push(middlewareConfigs[1].callback(reqGetLatest, resGetLatest).then(function(){
        should(resGetLatest.mockData).eql('getLatest response');
      }));

      Promise.all(promises).then(function(){
        done()
      }).catch(function(err){
        done(err);
      });
    });
    it('generates middleware array ordered by priority', function(){
      var config = {
        path: '/api',
        endpoints: {
          'a': {
            path: '/a',
            method: 'a',
            verbs: ['post'],
            priority: 10
          },
          'b': {
            path: '/b',
            method: 'b',
            verbs: ['get'],
            priority: -1000
          },
          'c': {
            path: '/c',
            method: 'c',
            verbs: ['get'],
            priority: 90
          },
          'd': {
            path: '/d',
            method: 'd',
            verbs: ['get'],
            priority: 100
          }
        }
      };

      var remoteObject = new ServerRemoteObject({}, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      should(Array.isArray(middlewareConfigs)).eql(true);
      should(middlewareConfigs[0].method).eql('d');
      should(middlewareConfigs[1].method).eql('c');
      should(middlewareConfigs[2].method).eql('a');
      should(middlewareConfigs[3].method).eql('b');
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

      should(middlewareConfigs[0].verb).eql('post');
      should(middlewareConfigs[0].path).eql('/api/save');

      var reqSave = new ExpressMockRequest({body: 'post body'});
      var resSave = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData).eql('post body');
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

      should(middlewareConfigs[0]['verb']).eql('post');
      should(middlewareConfigs[0]['path']).eql('/api/save');

      var reqSave = new ExpressMockRequest({body: 'post body'});
      var resSave = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData).eql('post body');
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
              {srcKey: 'content', src: 'body'}
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest({body: {content: 'content value'}});
      var resSave = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData).eql('content value');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured body-field as field on argument to remote method', function(done){
      var targetObject = {
        save: function(data){
          return Promise.resolve(data.thebody);
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
              thebody: {srcKey: 'content', src: 'body'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest({body: {content: 'content value'}});
      var resSave = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData).eql('content value');
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
              {srcKey: 'pkey', src: 'param'}
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetByPkey = new ExpressMockRequest({params: {pkey: 123}});
      var resGetByPkey = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqGetByPkey, resGetByPkey).then(function(){
        should(resGetByPkey.mockData).eql(123);
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
              {src: 'param'}
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetByPkey = new ExpressMockRequest({params: {pkey: 123}});
      var resGetByPkey = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqGetByPkey, resGetByPkey).then(function(){
        should(resGetByPkey.mockData).eql({pkey: 123});
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
              {srcKey: 'offset', src: 'query'}
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqGetAll, resGetAll).then(function(){
        should(resGetAll.mockData).eql(50);
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
      middlewareConfigs[0].callback(reqGetAll, resGetAll).then(function(){
        should(resGetAll.mockData).eql({offset: 50});
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
      middlewareConfigs[0].callback(reqGetAll, resGetAll).then(function(){
        should(resGetAll.mockData).eql(reqGetAll);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured request field as argument to remote method', function(done){
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
              {srcKey: 'query', src: 'request'}
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqGetAll, resGetAll).then(function(){
        should(resGetAll.mockData).eql(reqGetAll.query);
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
      middlewareConfigs[0].callback(reqGetAll, resGetAll).then(function(){
        should(resGetAll.mockData).eql(resGetAll);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects configured response field as argument to remote method', function(done){
      var targetObject = {
        getAll: function(test){
          return Promise.resolve(test);
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
              {srcKey: 'test', src: 'response'}
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest();
      var resGetAll = new ExpressMockResponse();
      resGetAll.test = 'a';
      middlewareConfigs[0].callback(reqGetAll, resGetAll).then(function(){
        should(resGetAll.mockData).eql('a');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns 200 response code by default', function(done){
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
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockCode).eql(200);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('returns configured success response code', function(done){
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
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockCode).eql(202);
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
      middlewareConfigs[0].callback(reqGetAll, resGetAll).then(function(){
        should(resGetAll.mockCode).eql(500);
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
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockCode).eql(403);
      }).catch(function(error){
        should(error).eql('403 error message');
      });

      var reqGetOne = new ExpressMockRequest;
      var resGetOne = new ExpressMockResponse;
      middlewareConfigs[1].callback(reqGetOne, resGetOne).then(function(){
        should(resGetOne.mockCode).eql(404);
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
              {srcKey: 'stringToNumber', type: Number, src: 'body'},
              {srcKey: 'stringToBooleanTrue', type: Boolean, src: 'body'},
              {srcKey: 'stringToBooleanFalse', type: Boolean, src: 'body'},
              {srcKey: 'stringToDate', type: Date, src: 'body'},
              {srcKey: 'stringToObjectId', type: 'ObjectID', src: 'body'}
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
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData.stringToNumber).eql(456);
        should(resSave.mockData.stringToNumber.constructor).eql(Number);
        should(resSave.mockData.stringToBooleanTrue).eql(true);
        should(resSave.mockData.stringToBooleanTrue.constructor).eql(Boolean);
        should(resSave.mockData.stringToBooleanFalse).eql(false);
        should(resSave.mockData.stringToBooleanFalse.constructor).eql(Boolean);
        should(resSave.mockData.stringToDate.constructor).eql(Date);
        should(resSave.mockData.stringToObjectId.constructor.name).eql('ObjectID');
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
              {srcKey: 'name', type: String, src: 'body', required: true},
            ]
          }
        }
      };

      var promises = [];

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSaveFail = new ExpressMockRequest;
      var resSaveFail = new ExpressMockResponse;
      promises.push(middlewareConfigs[0].callback(reqSaveFail, resSaveFail).then(function(){
        should(resSaveFail.mockCode).eql(403);
      }));

      var reqSaveSuccess = new ExpressMockRequest({body: {name: 'Kevin'}});
      var resSaveSuccess = new ExpressMockResponse;
      promises.push(middlewareConfigs[0].callback(reqSaveSuccess, resSaveSuccess).then(function(){
        should(resSaveSuccess.mockData).eql('Kevin');
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
              {srcKey: 'name', type: String, src: 'body', notNull: true},
            ]
          }
        }
      };

      var promises = [];

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSaveFail = new ExpressMockRequest({body: {name: 'NULL'}});
      var resSaveFail = new ExpressMockResponse;
      promises.push(middlewareConfigs[0].callback(reqSaveFail, resSaveFail).then(function(){
        should(resSaveFail.mockCode).eql(403);
      }));

      var reqSaveSuccess = new ExpressMockRequest({body: {name: 'Kevin'}});
      var resSaveSuccess = new ExpressMockResponse;
      promises.push(middlewareConfigs[0].callback(reqSaveSuccess, resSaveSuccess).then(function(){
        should(resSaveSuccess.mockData).eql('Kevin');
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
              {srcKey: 'name', type: String, src: 'body', defaultValue: 'Kevin'},
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData).eql('Kevin');
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
              {srcKey: 'name', type: String, src: 'body', defaultValue: 'Kevin'},
            ]
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest({body: {name: null}});
      var resSave = new ExpressMockResponse;
      middlewareConfigs[0].callback(reqSave, resSave).then(function(){
        should(resSave.mockData).eql('Kevin');
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
      middlewareConfigs[0].callback(req, res).then(function(){
        should(res.mockCode).eql(401);
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
      middlewareConfigs[0].callback(req, res).then(function(){
        should(res.mockData).eql('success');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects aclContext into callack method', function(done){
      var targetObject = {
        // aclContext and aclConditions are always appended as arguments - they are no configurable as with requestArgs
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
            args: [],
            acl: {
              rules: [
                {allow: true, role: 'all'}
              ]
            }
          }
        }
      };

      class MockRoleAssessor extends ServerAclRoleAssessor
      {
        // @ts-ignore - 'request' is declared but its value is never read.
        async initContext(request, context) {
          context.user = {id: '123'};
        }
      }

      var acl = new ServerAcl({
        endpoints: config.endpoints
      });
      acl.addRoleAssessor(new MockRoleAssessor('user'));

      var remoteObject = new ServerRemoteObject(targetObject, config);
      remoteObject.setAcl(acl);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var req = new ExpressMockRequest;
      var res = new ExpressMockResponse;
      middlewareConfigs[0].callback(req, res).then(function(){
        should(res.mockData.user.id).eql('123');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('injects aclConditions into callack method', function(done){
      var targetObject = {
        // aclContext and aclConditions are always appended as arguments - they are no configurable as with requestArgs
        // @ts-ignore - 'aclContext' is declared but its value is never read.
        getAll: function(aclContext, aclConditions){
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
            args: [],
            acl: {
              rules: [
                {allow: true, role: 'user'}
              ]
            }
          }
        }
      };

      class MockRoleAssessor extends ServerAclRoleAssessor
      {
        // @ts-ignore - 'context' is declared but its value is never read.
        async hasRole(context) {
          return {userId: '123'};
        }
      }

      var acl = new ServerAcl({
        endpoints: config.endpoints
      });
      acl.addRoleAssessor(new MockRoleAssessor('user'));

      var remoteObject = new ServerRemoteObject(targetObject, config);
      remoteObject.setAcl(acl);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var req = new ExpressMockRequest;
      var res = new ExpressMockResponse;
      middlewareConfigs[0].callback(req, res).then(function(){
        should(res.mockData.userId).eql('123');
        done();
      }).catch(function(err){
        done(err);
      });
    });
  });
});
