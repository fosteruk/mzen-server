import ServerAclRoleAssessor from '../role-assessor';

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

export default ServerAclRoleAssessorAll;
