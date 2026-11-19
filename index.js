import express from 'express';
import cors from 'cors'

const app = express();
const port = process.env.PORT || 8000


// middleware
app.use(express.json());
app.use(cors())

// in here connect to the mongodb

import { MongoClient } from 'mongodb';
/* ==========================================================
   DATABASE
   ========================================================== */

const client =new MongoClient(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@businessmanagement.ypdfgxh.mongodb.net/`);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const services = database.collection('services')


/* ==========================================================
   API ROUTES
   ========================================================== */

   // ---------- Services ----------

   // POST /services -> add a new service (admin only)

   app.post('services', async(req, res)=>{
    const service = req.body
    const result = await services.insertOne(service);
    res.send(result);
   })
















app.get('/', (req,res)=>{
    res.send('Luma haircut is running as a backend')
})


app.listen(port, ()=>{
    console.log(`ruma haircut is running at ${port}`)
})