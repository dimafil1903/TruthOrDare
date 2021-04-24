const MongoClient = require("mongodb").MongoClient;
const uri = process.env.mongo_url
const client = new MongoClient(uri)
const connection = client.connect()
module.exports=connection;
