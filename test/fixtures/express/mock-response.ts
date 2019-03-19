export class ExpressMockResponse
{
  mockData: any;
  mockCode: number;
  [key: string]: any;
  
  construct()
  {
    this.mockData = null;
    this.mockCode = 200;
  }
  
  json(data)
  {
    this.send(data);
    return this;
  };
  
  send(data)
  {
    this.mockData = data;
    return this;
  }
  
  status(code)
  {
    this.mockCode = code;
    return this;
  }
}

export default ExpressMockResponse;
