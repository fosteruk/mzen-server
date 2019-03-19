import ServerAclRoleAssessor from '../role-assessor';

class ServerAclRoleAssessorAll extends ServerAclRoleAssessor
{
  constructor()
  {
    super('all');
  }
  
  // @ts-ignore - 'user' is declared but its value is never read. 
  async hasRole(user, context?)
  {
    return true;
  }
}

export default ServerAclRoleAssessorAll;
