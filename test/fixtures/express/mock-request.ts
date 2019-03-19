export class ExpressMockRequest
{
  query: any;
  body: any;
  params: any;
  headers: any;
  
  constructor(config?)
  {
    config = config ? config : {}; 
    this.query = config.query ? config.query : {};
    this.body = config.body ? config.body : {};
    this.params = config.params ? config.params : {};
    this.headers = config.headers ? config.headers : {};
  }
  
  get(key)
  {
    return this.headers[key];
  }
}

export default ExpressMockRequest;
