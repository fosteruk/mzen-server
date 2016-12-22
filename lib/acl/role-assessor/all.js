'use strict'

var ServerAclRoleAssessor = require('../role-assessor');

class ServerAclRoleAssessorAll extends ServerAclRoleAssessor
{
  constructor(role) 
  {
    super('all');
  }
  hasRole(user, context) 
  {
    return Promise.resolve(true);
  }
}

module.exports = ServerAclRoleAssessorAll;
