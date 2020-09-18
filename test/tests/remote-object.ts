import should = require('should');
import ServerRemoteObject from '../../lib/remote-object';
import ServerAcl from '../../lib/acl';
import ServerAclRoleAssessor from '../../lib/acl/role-assessor';
import ExpressMockRequest from '../fixtures/express/mock-request';
import ExpressMockResponse from '../fixtures/express/mock-response';

describe('ServerRemoteObject', function(){
  describe('getMiddlewareConfig()', function(){
    it('generates middleware for configured endpoints', async () => {
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
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
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

      await Promise.all(promises);
    });
    it('generates middleware array ordered by priority', function(){
      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
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
    it('injects configured body as field on argument to remote method', async () => {
      var targetObject = {
        save: function(data){
          return Promise.resolve(data.theBody);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              theBody: {srcPath: 'body', src: 'request'}
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
      await middlewareConfigs[0].callback(reqSave, resSave);
      should(resSave.mockData).eql('post body');
    });
    it('injects configured body-field as argument to remote method', async () => {
      var targetObject = {
        save: function({content}){
          return Promise.resolve(content);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              content: {srcPath: 'content', src: 'body'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest({body: {content: 'content value'}});
      var resSave = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqSave, resSave);
      should(resSave.mockData).eql('content value');
    });
    it('injects configured body-field as field on argument to remote method', async () => {
      var targetObject = {
        save: function(data){
          return Promise.resolve(data.thebody);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              thebody: {srcPath: 'content', src: 'body'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest({body: {content: 'content value'}});
      var resSave = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqSave, resSave);
      should(resSave.mockData).eql('content value');
    });
    it('injects configured param to remote method', async () => {
      var targetObject = {
        getByPkey: function({pkey}){
          return Promise.resolve(pkey);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'get-byPkey': {
            path: '/:pkey',
            method: 'getByPkey',
            verbs: ['get'],
            data: {
              pkey: {src: 'param'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetByPkey = new ExpressMockRequest({params: {pkey: 123}});
      var resGetByPkey = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqGetByPkey, resGetByPkey);
      should(resGetByPkey.mockData).eql(123);
    });
    it('injects configured query-field to remote method', async () => {
      var targetObject = {
        getAll: function({offset}){
          return Promise.resolve(offset);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              offset: {src: 'query'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqGetAll, resGetAll);
      should(resGetAll.mockData).eql(50);
    });
    it('injects configured query to remote method', async () => {
      var targetObject = {
        getAll: function({query}){
          return Promise.resolve(query);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              query: {src: 'request'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqGetAll, resGetAll);
      should(resGetAll.mockData).eql({offset: 50});
    });
    it('injects configured request field as argument to remote method', async () => {
      var targetObject = {
        getAll: function({query}){
          return Promise.resolve(query);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              query: {src: 'request'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest({query: {offset: 50}});
      var resGetAll = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqGetAll, resGetAll);
      should(resGetAll.mockData).eql(reqGetAll.query);
    });
    it('injects configured response field to remote method', async () => {
      var targetObject = {
        getAll: function({test}){
          return Promise.resolve(test);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              test: {src: 'response'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest();
      var resGetAll = new ExpressMockResponse();
      resGetAll.test = 'a';
      await middlewareConfigs[0].callback(reqGetAll, resGetAll);
      should(resGetAll.mockData).eql('a');
    });
    it('injects configured config field as argument to remote method', async () => {
      var targetObject = {
        getAll: function({test}){
          return Promise.resolve(test);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              test: {src: 'config'}
            }
          }
        },
        server: {
          test: 123
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest();
      var resGetAll = new ExpressMockResponse();
      await middlewareConfigs[0].callback(reqGetAll, resGetAll);
      should(resGetAll.mockData).eql(123);
    });
    it('injects configured config field path as argument to remote method', async () => {
      var targetObject = {
        getAll: function({test}){
          return Promise.resolve(test);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'get-all': {
            path: '/all',
            method: 'getAll',
            verbs: ['get'],
            data: {
              test: {srcPath: 'test.a.b.c', src: 'config'}
            }
          }
        },
        server: {
          test: {
            a: {
              b: {
                c: 123
              }
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqGetAll = new ExpressMockRequest();
      var resGetAll = new ExpressMockResponse();
      await middlewareConfigs[0].callback(reqGetAll, resGetAll);
      should(resGetAll.mockData).eql(123);
    });
    it('returns 200 response code by default', async () => {
      var targetObject = {
        save: function(){
          return Promise.resolve('success');
        },
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post']
          }
          
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqSave, resSave);
      should(resSave.mockCode).eql(200);
    });
    it('returns configured success response code', async () => {
      var targetObject = {
        save: function(){
          return Promise.resolve('success');
        },
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
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
      await middlewareConfigs[0].callback(reqSave, resSave);
      should(resSave.mockCode).eql(202);
    });
    it('returns 500 response code on error', async () => {
      var targetObject = {
        getAll: function(){
          return Promise.reject(new Error('Error message'));
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
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
      await middlewareConfigs[0].callback(reqGetAll, resGetAll);
      should(resGetAll.mockCode).eql(500);
    });
    it('returns configured error response code', async () => {
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
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
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

      await Promise.all(promises);
    });
    it('typecasts injected arguments', async () => {
      var targetObject = {
        save: function({
          stringToNumber, 
          stringToBooleanTrue, 
          stringToBooleanFalse, 
          stringToDate, 
          stringToObjectId
        }){
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
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              stringToNumber: {type: Number, src: 'body'},
              stringToBooleanTrue: {type: Boolean, src: 'body'},
              stringToBooleanFalse: {type: Boolean, src: 'body'},
              stringToDate: {type: Date, src: 'body'},
              stringToObjectId: {type: 'ObjectID', src: 'body'}
            }
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
      await middlewareConfigs[0].callback(reqSave, resSave);

      should(resSave.mockData.stringToNumber).eql(456);
      should(resSave.mockData.stringToNumber.constructor).eql(Number);
      should(resSave.mockData.stringToBooleanTrue).eql(true);
      should(resSave.mockData.stringToBooleanTrue.constructor).eql(Boolean);
      should(resSave.mockData.stringToBooleanFalse).eql(false);
      should(resSave.mockData.stringToBooleanFalse.constructor).eql(Boolean);
      should(resSave.mockData.stringToDate.constructor).eql(Date);
      should(resSave.mockData.stringToObjectId.constructor.name).eql('ObjectID');
    });
    it('returns 403 error response code on arg "required" validation error', async () => {
      var targetObject = {
        save: function({name}){
          return Promise.resolve(name);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: {type: String, src: 'body', required: true},
            }
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

      await Promise.all(promises);
    });
    it('returns 403 error response code on arg "notNull" validation error', async () => {
      var targetObject = {
        save: function({name}){
          return Promise.resolve(name);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: {type: String, src: 'body', notNull: true},
            }
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

      await Promise.all(promises);
    });
    it('injects callback arg with default value for undefined input', async () => {
      var targetObject = {
        save: function({name}){
          return Promise.resolve(name);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: {type: String, src: 'body', defaultValue: 'Kevin'},
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest;
      var resSave = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqSave, resSave);
      should(resSave.mockData).eql('Kevin');
    });
    it('injects callback arg with default value for null input', async () => {
      var targetObject = {
        save: function({name}){
          return Promise.resolve(name);
        }
      };

      var config = {
        path: '/api',
        acl: {
          rules: [{allow: true, role: 'all'}]
        },
        endpoints: {
          'post-save': {
            path: '/save',
            method: 'save',
            verbs: ['post'],
            data: {
              name: {type: String, src: 'body', defaultValue: 'Kevin'}
            }
          }
        }
      };

      var remoteObject = new ServerRemoteObject(targetObject, config);
      var middlewareConfigs = remoteObject.getMiddlewareConfig();

      var reqSave = new ExpressMockRequest({body: {name: null}});
      var resSave = new ExpressMockResponse;
      await middlewareConfigs[0].callback(reqSave, resSave);
      should(resSave.mockData).eql('Kevin');
    });
    it('returns 401 unauthorized if not permitted by ACL', async () => {
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
            data: [],
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
      await middlewareConfigs[0].callback(req, res);
      should(res.mockCode).eql(401);
    });
    it('executes remote method if ACL permits', async () => {
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
            data: [],
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
      await middlewareConfigs[0].callback(req, res);
      should(res.mockData).eql('success');
    });
    it('injects aclContext into callack method', async () => {
      var targetObject = {
        // aclContext and aclConditions are always appended as arguments - they are no configurable as with requestArgs
        getAll: function({aclContext}){
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
            data: [],
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
      await middlewareConfigs[0].callback(req, res);
      should(res.mockData.user.id).eql('123');
    });
    it('injects aclConditions into callack method', async () => {
      var targetObject = {
        // aclContext and aclConditions are always appended as arguments - they are no configurable as with requestArgs
        // @ts-ignore - 'aclContext' is declared but its value is never read.
        getAll: function({aclContext, aclConditions}){
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
            data: [],
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
      await middlewareConfigs[0].callback(req, res);
      should(res.mockData.userId).eql('123');
    });
  });
});
