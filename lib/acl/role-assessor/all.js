'use strict'

var ServerAclRoleAssessor = require('../role-assessor');

class ServerAclRoleAssessorAll extends ServerAclRoleAssessor
{
  constructor(role)
  {
    super('all');
  }
  async hasRole(user, context)
  {
    return true;
  }
}

module.exports = ServerAclRoleAssessorAll;
