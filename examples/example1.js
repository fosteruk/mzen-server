'use strict'

var ModelManager = require('mzen/lib/model-manager');
var Repo = require('mzen/lib/repo');
var Service = require('mzen/lib/service');
var Server = require('mzen-server');

var data = {
  person: [
    {
      _id: '63', 
      name: 'Kevin', 
      bestFriendId: '89', 
      workPlaceId: '1',
      contact: {
        address: '123 Picton Road',
        tel: '123 456 789'
      },
      created: new Date()
    },
    {
      _id: '89', 
      name: 'Tom', 
      bestFriendId: '63', 
      workPlaceId: '2',
      contact: {
        address: '5 Marina Tower',
        tel: '133 436 109'
      }
    },
    {
      _id: '97', 
      name: 'Sarah', 
      bestFriendId: '63', 
      workPlaceId: '1',
      contact: {
        address: '93 Alderson Road',
        tel: '093 238 2349'
      }
    },
    {
      _id: '165', 
      name: 'Sam', 
      bestFriendId: '63', 
      workPlaceId: '2',
      contact: {
        address: '502 Tanjung Bungha',
        tel: '078 131 1847'
      }
    },
    {
      _id: '192', 
      name: 'Paula', 
      bestFriendId: '63', 
      workPlaceId: '1',
      contact: {
        address: '101 King Street',
        tel: '555 555 5555'
      }
    },
  ],
  workPlace: [
    {_id: '1', name: 'Hotel', managerId: '89'},
    {_id: '2', name: 'Bar', managerId: '192'},
  ]
};

var modelManager = new ModelManager({
  dataSources: [{
     name: 'db', type: 'mongodb', url: 'mongodb://localhost:27017/domain-model-api-example'
  }]
});

class Person {
  getName()
  {
    return this.name + ' (' + this._id + ')';
  }
};

class PersonContact {
  getAddress()
  {
    return this.address + ' (@)';
  }
};

var personRepo = new Repo({
  name: 'person',
  dataSource: 'db',
  api: {
    enable: true,
    endpointsEnable: {'get-findByPkey': true},
    acl: {
      rules: [
        {allow: true, role: 'all'}
      ]
    },
    endpoints: {
      'get-findByPkey': {
        path: '/:pkey',
        method: '_findByPkey',
        verbs: ['get', 'head'],
        args: [
          {srcName: 'pkey', src: 'param'}
        ],
        response: {
          success: {http: {code: 200, contentType: 'json'}},
          error: {
            RepoErrorValidation: {http: {code: 403}},
            ServerErrorRepoNotFound: {http: {code: 404}}
          }
        },
        acl: {
          rules: [
            {allow: true, role: 'all'}
          ]
        }
      }
    }
  },
  entityConstructor: Person,
  embeddedConstructors: {
    'contact': PersonContact
  },
  strict: false,
  schema: {
    _id: Number,
    name: {$type: String, $validate: {required: true}},
    bestFriendId: Number,
    workPlaceId: Number,
    created: Date,
    contact: {
      address: String,
      tel: String
    }
  },
  indexes: {
    bestFriendId: {spec: {bestFriendId: 1}},
    workPlaceId: {spec: {workPlaceId: 1}}
  },
  autoIndex: true,
  relations: {
    isConsideredBestFriendBy: {
      type: 'hasMany',
      repo: 'person',
      key: 'bestFriendId',
      sort: ['name', 'asc'],
      populate: true,
      recursion: 0
    },
    isConsideredBestFriendByCount: {
      type: 'hasManyCount',
      repo: 'person',
      key: 'bestFriendId',
      sort: ['name', 'asc'],
      populate: true,
      recursion: 0
    },
    bestFriend: {
      type: 'belongsToOne',
      repo: 'person',
      key: 'bestFriendId',
      populate: true,
      recursion: 0
    },
    workPlace: {
      type: 'belongsToOne',
      repo: 'workPlace',
      key: 'workPlaceId',
      populate: true,
      recursion: 0
    },
  }
});
modelManager.addRepo(personRepo);

var workPlaceRepo = new Repo({
  name: 'workPlace',
  dataSource: 'db',
  schema: {
    _id: Number,
    managerId: Number
  },
  relations: {
    manager: {
      type: 'belongsToOne',
      repo: 'person',
      key: 'managerId',
      populate: true
    }
  }
});
modelManager.addRepo(workPlaceRepo);

class ArtistContactService extends Service
{
  constructor(options) 
  {
    super({
      name: 'artistSignup',
      api: {
        endpoints: 
          {
          'get-sendEmail':  {
            path: 'sendEmail/:artistId',
            method: 'sendEmail',
            desc: 'Sends an email to the artist',
            verbs: ['get'],
            args: [
              {name: 'artistId', type: Number, source: 'param', desc: 'Artist Id'},
              {name: 'artistId', type: Number, source: 'query-field', desc: 'Artist Id', autoload: {repo: 'artist', key: '_id'}},
              {name: 'query', source: 'query-string'},
              {name: 'fromEmail', type: String, source: 'body-field'},
              {name: 'json', type: Object, source: 'body', schema: {
                fromEmail: String
              }}
            ],
            response: {
              desc: 'Response',
              success: {
                http: {
                  code: 200,
                  //contentType: 'html',
                  headers: {'ETag': '12345'} 
                },
                type: Object, 
                schema: {artistId: Number}
              },
              error: {
                CustomError: {
                  http: {
                    code: 404,
                  },
                  type: Object, 
                  schema: {test: {$type: Number, $validation: {required: true}}}
                }
              }
            }
          }
        }
      }
    });
  }
  sendEmail(artistId, artist, query, fromEmail, json)
  {
    return Promise.resolve(artistId);
  }
}
modelManager.addService(new ArtistContactService);

var server = new Server(modelManager);
server.init().then(function(){
  server.start();
}).then(function(){;
  return personRepo.deleteMany();
}).then(function(){
  return workPlaceRepo.deleteMany();
}).then(function(){
  return modelManager.repos['user'].deleteMany();
}).then(function(){
  return personRepo.insertMany(data.person);
}).then(function(savedData){
  return workPlaceRepo.insertOne(data.workPlace[0]);
}).catch(function(err) {
  console.log(JSON.stringify(err.stack, null, 2));
});
