'use strict'
var Service = require('mzen').Service;
var ServerRemoteObject = require('../../remote-object');
var bcrypt = require('bcrypt');
var crypto = require('crypto');

class ServiceUserAuth extends Service
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
              {srcName: 'email', src: 'body-field', required: true},
              {srcName: 'password', src: 'body-field', required: true}
            ]
          },
          'post-login': {
            path: '/login',
            method: 'login',
            verbs: ['post'],
            args: [
              {srcName: 'email', src: 'body-field', required: true},
              {srcName: 'password', src: 'body-field', required: true}
            ]
          },
          'all-logout': {
            path: '/logout',
            method: 'logout',
            verbs: ['all'],
            args: [
              {srcName: 'Authorization', src: 'header-field', required: true}
            ],
            acl: {
              rules: []
            },
          }
        }
      }
    });
  }
  create(email, password)
  {
    return bcrypt.hash(password, 11).then(function(hash) {
      return this.repos['user'].insertOne({
        email: email,
        password: hash
      }).then(function(result){
        return result;
      }); 
    }.bind(this));
  }
  login(email, password)
  {
    return this.repos['user'].findOne({email: email}).then(function(user){
      if (user) {
        return bcrypt.compare(password, user.password).then(function(res) {
          if (!res) {
            // Invalid password
            return Promise.reject(new ServerRemoteObject.error.ErrorUnauthorized);
          }
        }).then(function(){
          const ttl = 604800;
          var token = null;
          if (user.accessToken && user.accessToken.expires > new Date) {
            token = user.accessToken;
            token['_id'] = user._id;
            return token;
          } else {
            const keySourceString = "" + user._id + user.password + (new Date()).getTime() + (Math.floor(Math.random() * 100000) + 1);
            const hash = crypto.createHash('sha256').update(keySourceString).digest('hex');
            const expires = new Date;
            expires.setTime(expires.getTime() + (ttl * 1000));
            var token = {
              accessToken: hash,
              ttl: ttl, 
              created: new Date,
              expires: expires
            };
            return this.repos['user'].updateOne({_id: user._id}, {$set: {accessToken: token}}).then(function(){
              token['_id'] = user._id;
              return token;
            });
          }
        }.bind(this));
      } else {
        // User not found
        return Promise.reject(new ServerRemoteObject.error.ErrorUnauthorized);
      }
    }.bind(this));
  }
  logout(accessToken)
  {
    return this.repos['user'].findOne({'accessToken.accessToken': accessToken}).then(function(user){
      if (!user) {
        // User not found
        return Promise.reject(new ServerRemoteObject.error.ErrorNotFound);
      }
    }).then(function(){
      return this.repos['user'].updateOne({'accessToken.accessToken': accessToken}, {$unset: {accessToken: ''}}).then(function(){
        return true;
      });
    }.bind(this));
  }
}

module.exports = ServiceUserAuth;
