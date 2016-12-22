'use strict'

var RoleAssessorAll = require('./acl/role-assessor/all');
var RoleAssessorAuthed = require('./acl/role-assessor/authed');
var RoleAssessorOwner = require('./acl/role-assessor/owner');

class ServerAcl
{
  constructor(options = {}) 
  {
    this.config = options;
    this.config['rules'] = this.config['rules'] ? this.config['rules'] : [];
    this.config['endpoints'] = this.config['endpoints'] ? this.config['endpoints'] : {};

    this.roleAssessor = {
      all: new RoleAssessorAll,
      authed: new RoleAssessorAuthed,
      owner: new RoleAssessorOwner
    };
  }
  populateContext(request, context)
  {
    // Initialise assessors
    var promises = [];
    for (var role in this.roleAssessor) {
      promises.push(this.roleAssessor[role].initContext(request, context));
    }
    return Promise.all(promises);
  }
  isPermitted(endpointName, context)
  {
    endpointName = endpointName ? endpointName : '';
    context = context ? context : {};

    // We append the end point rules to the global rules as the endpointrules should override the global rules
    var rules = this.getRules(endpointName);
    
    // We need to execute hasRole() for each rule in squence so we will start with a resolved promise
    var promise = Promise.resolve(true);
    rules.forEach(function(rule){
      // Each rule applies only the specified role
      // To test if a given rule will permit or deny the user we need to check two things
      // - Does the user have the role - if not the rule is no applicable and we can move on
      // - Does the rule permit or deny the user
      promise = promise.then(function(initResult){
        var role = rule['role'];
        return this.hasRole(role, context).then(function(userHasRole){
          var result = undefined;
          var initConditions = (typeof initResult == 'object') ? initResult : null;
          if (typeof userHasRole == 'object') {
            if (initConditions) {
              for (var condition in userHasRole) {
                initConditions[condition] = userHasRole[condition];
              }
              result = initConditions;
            } else {
              result = userHasRole;
            }
          } else if (userHasRole === true) {
            if (initConditions) {
              result = initConditions;
            } else {
              result = rule['allow'] !== undefined ? rule['allow'] : true;
            }
          }
          return result;
        });
      }.bind(this));
    }.bind(this));
    
    return promise.then(function(finalResult){
      return finalResult;
    });
  }
  hasRole(role, context)
  {
    // If a role assessor has been defined for this role we delegate
    // Otherwise we check if the role was staticaly assigned to the user
    var promise = Promise.resolve(false);
    var roleAssessor = this.roleAssessor[role];
    if (roleAssessor) {
      promise = roleAssessor.hasRole(context);
    } else {
      var staticRoles = (context['user'] && context['user']['acl'] && context['user']['acl']['roles']) ? context['user']['acl']['roles'] : [];
      promise = Promise.resolve(staticRoles.indexOf(role) !== -1);
    }
    
    return promise;
  }
  addRule(rule)
  {
    if (Array.isArray(rule)) {
      this.config['rules'] = this.config['rules'].concat(rule);
    } else {
      this.config['rules'].push(rule);
    }
  }
  getRules(endpointName)
  {
    var globalRules = this.config['rules'] ? this.config['rules'] : [];
    var endpoint = this.config['endpoints'][endpointName] ? this.config['endpoints'][endpointName] : {};
    var endpointAcl = endpoint['acl'] ? endpoint['acl'] : {};
    var endpointRules = endpointAcl['rules'] ? endpointAcl['rules'] : [];
    
    // We append the end point rules to the global rules as the endpointrules should override the global rules
    var rules = globalRules.concat(endpointRules);
    
    return rules;
  }
  setRepos(repos)
  {
    for (var role in this.roleAssessor) {
      this.roleAssessor[role].setRepos(repos);
    }
    this.repos = repos;
  }
  addRoleAssessor(assessor)
  {
    this.roleAssessor[assessor.role] = assessor;
    this.roleAssessor.repos = repos;
  }
}

/*
acl: {
  rules: [
    {allow: true, role: 'all'},
    {allow: true, role: 'authed'},
    {allow: true, role: 'unauthed'},
    {allow: true, role: 'owner'},
    {allow: true, role: 'rolename'},
    {allow: true, role: 'teamAdmin', contextArgs: {
      order: 'order'
    }},
  ]
}.
endpoints: {
  'post-create': {
    path: '/create',
    method: 'create',
    verbs: ['post'],
    args: [
      {srcName: 'email', src: 'body-field', required: true},
      {srcName: 'password', src: 'body-field', required: true}
    ],
    acl: {
      rules: [
        {allow: true, role: 'all'},
        {allow: true, role: 'authed'},
        {allow: true, role: 'unauthed'},
        {allow: true, role: 'owner'},
        {allow: true, role: 'rolename'},
        {allow: true, role: 'teamAdmin', contextArgs: {
          order: 'order'
        }},
      ]
    }
  },
*/

module.exports = ServerAcl;
