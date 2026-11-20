import express from 'express';
import cors from 'cors'
import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb';

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
    const service = {
      ...req.body,
      createdAt: new Date(), 
    };
    const result = await services.insertOne(service);
    res.send(result);
   })


  

  // GET /services -> list services (supports status, category, adminId, search, sort)
app.get('/services', async (req, res) => {
  try {
    const query = {};

    // সব মান String বানাও, যাতে ?status[$ne]=x এর মতো অবজেক্ট ঢুকতে না পারে
    const status = String(req.query.status ?? '');
    if (status === 'active' || status === 'inactive') {
      query.status = status;
    }

    if (req.query.category) {
      query.category = String(req.query.category);
    }

    if (req.query.adminId) {
      query.adminId = String(req.query.adminId);
    }

    // Search by service NAME only (PDF requirement)
    if (req.query.search) {
      const searchText = String(req.query.search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // বিশেষ চিহ্ন এস্কেপ

      if (searchText) {
        query.serviceName = { $regex: searchText, $options: 'i' };
      }
    }

    // Sorting: ?sort=price_asc | price_desc (default: newest first)
    let sortOption = { _id: -1 };

    if (req.query.sort === 'price_asc') {
      sortOption = { price: 1, _id: -1 };
    } else if (req.query.sort === 'price_desc') {
      sortOption = { price: -1, _id: -1 };
    }

    const result = await services.find(query).sort(sortOption).toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to load services' });
  }
});


  // Get Data for single api /services

  app.get('/services/:id', async(req,res)=>{
    const id = req.params.id
    const result = await services.findOne({_id: new ObjectId(id)});

    if(!result){
      return res.status(404).send(({message: 'service not found'}))
    }
    res.send(result);
  })

  // Delete /services

  app.delete('/services/:id', async(req, res)=>{
    const id = req.params.id;
    const result = await services.deleteOne({_id: new ObjectId(id)});
    res.send(result)
  })


// Patch / services

app.patch('/services/:id', async(req,res)=>{
  const id = req.params.id
  const updatesService = req.body

  const query = {_id: new ObjectId(id)}

  const updateDoc = {
    $set: updatesService
  }

  const result = await services.updateOne(query, updateDoc)
  res.send(result)

  
})











app.get('/', (req,res)=>{
    res.send('Luma haircut is running as a backend')
})


app.listen(port, ()=>{
    console.log(`luma haircut is running at ${port}`)
})