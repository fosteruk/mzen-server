import ServerRepo from '../../repo';

export class RepoUser extends ServerRepo
{
  constructor()
  {
    super({
      name: 'user',
      schema: {
        _id: {$type: 'ObjectID', $validate: {required: true}},
        email: {$type: String, $validate: {required: true}},
        password: {$type: String, $validate: {required: true}, $filter: {private: 'read'}},
        accessToken: [{accessToken: String, ttl: Number, created: Date, expires: Date}],
        created: {$type: Date, $filter: {defaultValue: 'now'}}
      },
      api: {
        endpointGroupsDisable: {read: true}
      }
    });
  }
}

export default RepoUser;
