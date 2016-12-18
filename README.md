# mZen-Server
## NodeJS REST API server for mZen domain model
### If you dont know what mZen domain model is you should read about that first: [mZen](https://github.com/kevin-foster/mZen)

- Expose both data repositories and services as REST endpoints
  - No configuration required
  - By default all of your model repositories are exposed via the API server
  - Repository exposure may be configured for each repository
- Validation and type-casting of request data
- Built-in user authentication 
  - Currently supports simple auth tokens but you may implement a custom authentication process
- Built-in user authorisation with access control lists
 - Buit-in and custom dynamic roles allowing user roles to be assessed on each request
- mZen Server is a wrapper around [ExpressJS](http://expressjs.com) and so can be used with ExpressJS middlware
