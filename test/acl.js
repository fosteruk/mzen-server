'use strict'
var should = require('should');
var ServerAcl = require('../lib/acl');
var ServerAclRoleAssessor = require('../lib/acl/role-assessor');
var ServerAclRoleAssessorAll = require('../lib/acl/role-assessor/all');

describe('ServerAcl', function(){
  describe('hasRole()', function(){
    it('returns true for role "all"', function(done){
      var acl = new ServerAcl();
      acl.addRoleAssessor(new ServerAclRoleAssessorAll);
      acl.hasRole('all').then(function(hasRole){
        should(hasRole).eql(true);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('delegates to role assessor', function(done){
      var config = {
        rules: [
          {role: 'admin'}
        ]
      };
      
      class TestAssessorTrue extends ServerAclRoleAssessor 
      {
        constructor() {super('admin');}
        hasRole(user, context) {return Promise.resolve(true);}
      }
      
      class TestAssessorFalse extends ServerAclRoleAssessor 
      {
        constructor() {super('admin');}
        hasRole(user, context) {return Promise.resolve(false);}
      }
      
      var promises = [];
      
      // Test that the assessor can return true
      var aclA = new ServerAcl(config);
      aclA.addRoleAssessor(new TestAssessorTrue);
      promises.push(aclA.hasRole('admin').then(function(hasRole){
        should(hasRole).eql(true);
      }));
      
      // Test that the assessor can return false
      var aclB = new ServerAcl(config);
      aclB.addRoleAssessor(new TestAssessorFalse);
      promises.push(aclB.hasRole('admin').then(function(hasRole){
        should(hasRole).eql(false);
      }));
      
      Promise.all(promises).then(function(){
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('role accessor evaluates context', function(done){
      var config = {
        rules: [
          {role: 'admin'}
        ]
      };
      
      class TestAssessor extends ServerAclRoleAssessor 
      {
        constructor() {super('admin');}
        hasRole(user, context) {return Promise.resolve(context.adminPassword == 'qwerty');}
      }

      var acl = new ServerAcl(config);
      acl.addRoleAssessor(new TestAssessor);
      acl.hasRole('admin', null, {adminPassword: 'qwerty'}).then(function(hasRole){
        should(hasRole).eql(true);
        done();
      });
    });
  });
  describe('isPermitted()', function(){
    it('rule allow option defaults to true', function(done){
      var config = {
        rules: [
          {role: 'all'}
        ]
      };
      var acl = new ServerAcl(config);
      acl.addRoleAssessor(new ServerAclRoleAssessorAll);
      acl.isPermitted().then(function(permitted){
        should(permitted).eql(true);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('rule allow option can be set to false', function(done){
      var config = {
        rules: [
          {allow: false, role: 'all'}
        ]
      };
      var acl = new ServerAcl(config);
      acl.addRoleAssessor(new ServerAclRoleAssessorAll);
      acl.isPermitted().then(function(permitted){
        should(permitted).eql(false);
        done();
      }).catch(function(err){
        done(err);
      });
    });
    it('processes rules in sequence', function(done){
      var config = {
        rules: [
          {allow: true, role: 'all'},
          {allow: false, role: 'guest'},
          {allow: true, role: 'admin'},
          {allow: false, role: 'public'},
        ]
      };
      
      class AclAssessorGuest extends ServerAclRoleAssessor 
      {
        constructor() {super('guest');}
        hasRole(user, context) {return Promise.resolve(true);}
      }
      
      class AclAssessorAdmin extends ServerAclRoleAssessor 
      {
        constructor() {super('admin');}
        hasRole(user, context) {return Promise.resolve(true);}
      }
      
      class AclAssessorPublic extends ServerAclRoleAssessor 
      {
        constructor() {super('public');}
        hasRole(user, context) {return Promise.resolve(true);}
      }
      
      var acl = new ServerAcl(config);
      acl.addRoleAssessor(new AclAssessorGuest);
      acl.addRoleAssessor(new AclAssessorAdmin);
      acl.addRoleAssessor(new AclAssessorPublic);
      acl.isPermitted('guest').then(function(permitted){
        should(permitted).eql(false);
        done();
      }).catch(function(err){
        done(err);
      });
    });
  });
});
