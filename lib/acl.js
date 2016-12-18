'use strict'

class ServerAcl
{
  constructor(options = {}) 
  {
    this.config = options;
    this.config['rules'] = this.config['rules'] ? this.config['rules'] : [];
    this.config['endpoints'] = this.config['endpoints'] ? this.config['endpoints'] : {};
    this.roleAssessor = {};
  }
  isPermitted(user, endpointName, context)
  {
    endpointName = endpointName ? endpointName : '';
  
    var globalRules = this.config['rules'] ? this.config['rules'] : [];
    var endpoint = this.config['endpoints'][endpointName] ? this.config['endpoints'][endpointName] : {};
    var endpointAcl = endpoint['acl'] ? endpoint['acl'] : {};
    var endpointRules = endpointAcl['rules'] ? endpointAcl['rules'] : [];
    
    // We append the end point rules to the global rules as the endpointrules should override the global rules
    var rules = globalRules.concat(endpointRules);
    
    // We need to execute hasRole() for each rule in squence so we will start with a resolved promise
    var promise = Promise.resolve(true);
    rules.forEach(function(rule){
      // Each rule applies only the specified role
      // To test if a given rule will permit or deny the user we need to check two things
      // - Does the user have the role - if not the rule is no applicable and we can move on
      // - Does the rule permit or deny the user
      promise = promise.then(function(initResult){
        var role = rule['role'];
        return this.hasRole(role, user, context).then(function(userHasRole){
          var allow = rule['allow'] !== undefined ? rule['allow'] : true;
          return userHasRole ? allow : initResult;
        });
      }.bind(this));
    }.bind(this));
    
    return promise.then(function(finalResult){
      return finalResult;
    });
  }
  hasRole(role, user, context, defaultValue)
  {
    defaultValue = (defaultValue === undefined) ? true : defaultValue;
    // If a role assessor has been defined for this role we delegate
    // Otherwise we check if the role was staticaly assigned to the user
    var promise = Promise.resolve(false);
    var roleAssessor = this.roleAssessor[role];
    if (roleAssessor) {
      promise = roleAssessor.hasRole(user, context);
    } else {
      var staticRoles = user && user['acl'] && user['acl']['roles'] ? user['acl']['roles'] : [];
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
