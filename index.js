import express from 'express';
import cors from 'cors'
import 'dotenv/config'
import { MongoClient } from 'mongodb';

const app = express();
const port = process.env.PORT || 8000


// middleware
app.use(express.json());
app.use(cors())

// in here connect to the mongodb

/* ==========================================================
   DATABASE
   ========================================================== */

const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

if (!dbUser || !dbPassword) {
  throw new Error(
    "Missing MongoDB credentials. Create a .env file in Luma-server with DB_USER and DB_PASSWORD."
  );
}

const client = new MongoClient(`mongodb+srv://${dbUser}:${dbPassword}@businessmanagement.ypdfgxh.mongodb.net/`);

export async function connectToMongoDB() {
  try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.error("MongoDB connection failed:", err);
        throw err;
    }
}



 const connectedClient = await connectToMongoDB();
 const database = connectedClient.db('luma');
 const services = database.collection('services');
 


/* ==========================================================
   API ROUTES
   ========================================================== */

   // ---------- Services ----------

   // POST /services -> add a new service (admin only)

   app.post('/services', async(req, res)=>{
    const service = req.body
    const result = await services.insertOne(service);
    res.send(result);
   })


   // GET /service -> get the services

   app.get('/services', async (req, res)=>{
    try{
      const query = {}
      console.log('query', req.query);

      if(req.query){
        if(req.query.status){
          query.status = req.query.status
        }

        if(req.query.category){
          query.category = req.query.category
        }
        if(req.query.adminId){
          query.adminId = req.query.adminId
        }

        // search filter

        if(req.query.search){
          const searchText = req.query.search;

          query.$or = [
            {
                        serviceName: {
                            $regex: searchText,
                            $options: 'i'
                        }
                    },
                    {
                        description: {
                            $regex: searchText,
                            $options: 'i'
                        }
                    },
                    {
                        category: {
                            $regex: searchText,
                            $options: 'i'
                        }
                    }
          ]
        }
      }
      const result = await services.find(query).sort({_id: -1}).toArray();
      res.send(result);

    }catch(er){
      console.log(er);
      res.status(500).send({message: `failed to load service`})
    }
   })















app.get('/', (req,res)=>{
    res.send('Luma haircut is running as a backend')
})


app.listen(port, ()=>{
    console.log(`luma haircut is running at ${port}`)
})