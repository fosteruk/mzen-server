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

    this.roleAssessor = {};
  }
  loadDefaultRoleAssessors()
  {
    this.addRoleAssessor(new RoleAssessorAll);
    this.addRoleAssessor(new RoleAssessorAuthed);
    this.addRoleAssessor(new RoleAssessorOwner);
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

    // We append the end point rules to the global rules as the endpoint rules should override the global rules
    var rules = this.getRules(endpointName);
    
    // We need to execute hasRole() for each rule in squence so we will start with a resolved promise
    // By default everything is permitted so we resolve true
    var promise = Promise.resolve(true);
    rules.forEach((rule) => {
      // Each rule applies only the specified role
      // To test if a given rule will permit or deny the user we need to check two things
      // - Does the user have the role - if not the rule is not applicable and we can move on
      // - Does the rule permit or deny the user
      promise = promise.then((initResult) => {
        const role = rule['role'];
        return this.hasRole(role, context).then((userHasRole) => {
          // If the user does not have the role then we dont modify the permitted value
          // - we would return the initResult, so we can default to that value
          var result = initResult;
          var initConditions = (typeof initResult == 'object') ? initResult : null;
          if (typeof userHasRole == 'object') {
            // An object was returned - this represents the conditions under which the user has the role 
            if (initConditions) {
              // If we already had role ownership conditions we need to merge the new conditions
              for (var condition in userHasRole) {
                initConditions[condition] = userHasRole[condition];
              }
              result = initConditions;
            } else {
              result = userHasRole;
            }
          } else if (userHasRole === true) {
            if (initConditions) {
              // The previous role assessor returned conditions - these still apply so we return them
              result = initConditions;
            } else {
              result = rule['allow'] !== undefined ? rule['allow'] : true;
            }
          }
          return result;
        });
      });
    });
    
    return promise;
  }
  hasRole(role, context)
  {
    // If a role assessor has been defined for this role we delegate
    // Otherwise we check if the role was staticaly assigned to the user
    var promise = Promise.resolve(false);
    const roleAssessor = this.roleAssessor[role];
    if (roleAssessor) {
      promise = roleAssessor.hasRole(context);
    } else {
      var staticRoles = (context && context['user'] && context['user']['acl'] && context['user']['acl']['roles']) ? context['user']['acl']['roles'] : [];
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
    const globalRules = this.config['rules'] ? this.config['rules'] : [];
    const endpoint = endpointName && this.config['endpoints'][endpointName] ? this.config['endpoints'][endpointName] : {};
    const endpointAcl = endpoint['acl'] ? endpoint['acl'] : {};
    const endpointRules = endpointAcl['rules'] ? endpointAcl['rules'] : [];
    
    // We append the end point rules to the global rules as the endpointrules should override the global rules
    const rules = globalRules.concat(endpointRules);
    
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
