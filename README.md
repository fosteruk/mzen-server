# mZen-Server
## NodeJS REST API server for mZen domain model
### If you dont know what mZen domain model is you should read about that first: [mZen](https://github.com/kevin-foster/mZen)

- Expose both data repositories and services as REST endpoints
  - By default all of your repositories are exposed via the API server
  - Repository exposure configurable
- Validation and type-casting of request data
- User authentication 
  - Currently supports simple auth tokens but you may implement a custom authentication process
- User authorisation with access control lists
 - Default and custom dynamic roles allowing user roles to be assessed on each request
- mZen Server is a wrapper around [ExpressJS](http://expressjs.com) and so can be used with ExpressJS middleware
