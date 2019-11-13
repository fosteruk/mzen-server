import ServerService from '../../service';
import { ServerErrorUnauthorized, ServerErrorNotFound } from '../../error';
import bcryptjs = require('bcryptjs');
import crypto = require('crypto');

export class ServiceUserAuth extends ServerService
{
  constructor()
  {
    super({
      name: 'userAuth',
      api: {
        acl: {
          rules: [
            {allow: true, role: 'all'}
          ]
        },
        endpoints: {
          'post-create': {
            path: '/create',
            method: 'create',
            verbs: ['post'],
            args: [
              {srcPath: 'email', src: 'body-field', required: true},
              {srcPath: 'password', src: 'body-field', required: true}
            ]
          },
          'post-login': {
            path: '/login',
            method: 'login',
            verbs: ['post'],
            args: [
              {srcPath: 'email', src: 'body-field', required: true},
              {srcPath: 'password', src: 'body-field', required: true}
            ]
          },
          'all-logout': {
            path: '/logout',
            method: 'logout',
            verbs: ['all'],
            args: [
              {srcPath: 'Authorization', src: 'header-field', required: true}
            ],
            acl: {
              rules: []
            },
          }
        }
      }
    });
  }
  async create(email, password)
  {
    var hash = await bcryptjs.hash(password, 11);
    return this.repos.user.insertOne({
      email: email,
      password: hash
    });
  }
  async login(email, password)
  {
    var user = await this.repos.user.findOne({email: email});

    if (!user) {
      throw new ServerErrorUnauthorized;
    }

    var bcryptjsRes = await bcryptjs.compare(password, user.password);
    if (!bcryptjsRes) {
      throw new ServerErrorUnauthorized;
    }

    const ttl = 604800;
    var token = null;
    if (user.accessToken && user.accessToken.expires > new Date) {
      token = user.accessToken;
      token._id = user._id;
    } else {
      const keySourceString = "" + user._id + user.password + (new Date()).getTime() + (Math.floor(Math.random() * 100000) + 1);
      const hash = crypto.createHash('sha256').update(keySourceString).digest('hex');
      const expires = new Date;
      expires.setTime(expires.getTime() + (ttl * 1000));
      var token: any = {
        accessToken: hash,
        ttl: ttl,
        created: new Date,
        expires: expires
      };
      await this.repos.user.updateOne({_id: user._id}, {$set: {accessToken: token}});
      token._id = user._id;
    }
    return token;
  }
  async logout(accessToken)
  {
    var user = await this.repos.user.findOne({'accessToken.accessToken': accessToken});
    if (!user) {
      throw new ServerErrorNotFound;
    }

    await this.repos.user.updateOne({'accessToken.accessToken': accessToken}, {$unset: {accessToken: ''}});

    return true;
  }
}

export default ServiceUserAuth;
