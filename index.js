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
 const appointments = database.collection('appointments');
 const users = database.collection('user');
  const transactions = database.collection('transactions');
  const sessionCollection = database.collection('session');

// Prevent two active bookings for the same service, date and time slot
await appointments.createIndex(
  {
    appointmentDate: 1,
    timeSlot: 1
  },
  {
    name: 'unique_active_slot',
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ['pending', 'confirmed']
      }
    }
  }
);
 

// ----------------------------------------------------------------
// verify token related
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send({ message: 'Unauthorised: missing bearer token' });
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
      return res.status(401).send({ message: 'Unauthorised: missing token' });
    }

    const session = await sessionCollection.findOne({ token });
    if (!session) {
      return res.status(401).send({ message: 'Unauthorised: invalid session' });
    }

    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return res.status(401).send({ message: 'Unauthorised: session expired' });
    }

    const userId = session.userId;
    const userQuery = ObjectId.isValid(userId)
      ? { _id: new ObjectId(userId) }
      : { _id: userId };
    let user = await users.findOne(userQuery);

    // Better Auth may store user _id as string
    if (!user && typeof userId === 'string') {
      user = await users.findOne({ id: userId });
    }

    if (!user) {
      return res.status(401).send({ message: 'Unauthorised: user not found' });
    }

    if (user.banned || user.role === 'banned') {
      return res.status(403).send({ message: 'Forbidden: user banned' });
    }

    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    console.error('verifyToken error:', err);
    return res.status(401).send({ message: 'Unauthorised: token verification failed' });
  }
}

// now verifyPatrons Related Code

const verifyPatrons = async (req,res,next)=>{
    if(req.user.role !=='patrons'){
        res.status(403).send({message:'forbidden'})
        return
    }
    next();
}


// verify admin related code;


const verifyAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    res.status(403).send({ message: 'Forbidden' });
    return;
  }

  next();
};











/* ==========================================================
   API ROUTES
   ========================================================== */

// user related apis
app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    const cursor = users.find({});
    const result = await cursor.toArray();
    res.send(result);
})

app.patch('/users/:id/role', verifyToken, verifyAdmin ,async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const updatedDoc = {
        $set: {
            role: req.body.role
        }
    }

    const result =  await users.updateOne(query, updatedDoc)
    res.send(result)
})











   // ---------- Services ----------

   // POST /services -> add a new service (admin only)

   app.post('/services',verifyToken, verifyAdmin, async(req, res)=>{
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

  app.delete('/services/:id', verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id;
    const result = await services.deleteOne({_id: new ObjectId(id)});
    res.send(result)
  })


// Patch / services

app.patch('/services/:id', verifyToken, verifyAdmin, async(req,res)=>{
  const id = req.params.id
  const updatesService = req.body

  const query = {_id: new ObjectId(id)}

  const updateDoc = {
    $set: updatesService
  }

  const result = await services.updateOne(query, updateDoc)
  res.send(result)

  
})



// ---------- Appoinments ----------

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '13:00',
  '13:30', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30', '17:00',
];

// Appointment-এর সঙ্গে Service এবং Customer data জুড়ে ফ্ল্যাট আকারে ফেরত দেয়
const appointmentPipeline = (match, { withCustomer = false } = {}) => [
  { $match: match },
  { $sort: { _id: -1 } },

  {
    $lookup: {
      from: 'services',
      localField: 'serviceId',
      foreignField: '_id',
      as: 'service',
    },
  },
  { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },

  ...(withCustomer
    ? [
        {
          $lookup: {
            from: 'user',
            localField: 'customerId',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      ]
    : []),

  {
    $project: {
      serviceId: 1,
      customerId: 1,
      appointmentDate: 1,
      timeSlot: 1,
      message: 1,
      servicePrice: 1,
      paymentStatus: 1,
      status: 1,
      createdAt: 1,

      serviceName: '$service.serviceName',
      serviceImage: '$service.image',
      serviceCategory: '$service.category',
      customerName: '$customer.name',
      customerEmail: '$customer.email',
    },
  },
];

app.post('/appointments',verifyToken, verifyPatrons, async (req, res) => {
  try {
    const {
      serviceId,
      customerId,
      appointmentDate,
      timeSlot,
      message
    } = req.body;

    if (!serviceId || !customerId || !appointmentDate || !timeSlot) {
      return res.status(400).send({
        message: 'All fields are required'
      });
    }

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).send({
        message: 'Invalid service ID'
      });
    }
    if (!ObjectId.isValid(customerId)) {
      return res.status(400).send({
        message: 'Invalid customer ID'
      });
    }

    if (!TIME_SLOTS.includes(timeSlot)) {
      return res.status(400).send({
        message: 'Invalid time slot'
      });
    }

    // Check service
    const service = await services.findOne({
      _id: new ObjectId(serviceId),
      status: 'active'
    });

    if (!service) {
      return res.status(404).send({
        message: 'Service not found or inactive'
      });
    }

    // Check duplicate appointment
    const existingAppointment = await appointments.findOne({
      appointmentDate,
      timeSlot,
      status: {
        $in: ['pending', 'confirmed']
      }
    });

    if (existingAppointment) {
      return res.status(409).send({
        message: 'This time slot is already booked'
      });
    }

    const newAppointment = {
      serviceId: new ObjectId(serviceId),
      customerId: new ObjectId(customerId),
      appointmentDate,
      timeSlot,
      message: message || '',
      servicePrice: service.price,
      paymentStatus: 'unpaid',
      status: 'pending',
      createdAt: new Date()
    };

    const result = await appointments.insertOne(newAppointment);

    res.status(201).send({
      success: true,
      message: 'Appointment booked successfully',
      insertedId: result.insertedId
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send({
        message: 'This time slot is already booked'
      });
    }

    console.error(error);

    res.status(500).send({
      message: 'Failed to create appointment'
    });
  }
});


// GET /appointments -> list appointments (?customerId=...&status=...)
app.get('/appointments', verifyToken, async (req, res) => {
  try {
    const match = {};
    const role = req.user?.role;

    if (role === 'admin') {
      if (req.query.customerId) {
        const customerId = String(req.query.customerId);
        if (!ObjectId.isValid(customerId)) {
          return res.status(400).send({ message: 'Invalid customer ID' });
        }
        match.customerId = new ObjectId(customerId);
      }
    } else if (role === 'patrons' || role === 'customer' || role === 'patron') {
      const ownId = req.user?._id?.toString();
      if (!ownId || !ObjectId.isValid(ownId)) {
        return res.status(401).send({ message: 'Unauthorised' });
      }
      match.customerId = new ObjectId(ownId);
    } else {
      return res.status(403).send({ message: 'Forbidden' });
    }

    const status = String(req.query.status ?? '');
    if (['pending', 'confirmed', 'cancelled'].includes(status)) {
      match.status = status;
    }

    const result = await appointments
      .aggregate(appointmentPipeline(match, { withCustomer: true }))
      .toArray();

    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to load appointments' });
  }
});






// PATCH /appointments/:id -> update status and/or paymentStatus
//   status: 'confirmed' | 'cancelled'
//   paymentStatus: 'paid' (used by checkout success / admin)
app.patch('/appointments/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, paymentId } = req.body || {};
    const role = req.user?.role;
    const userId = req.user?._id?.toString();

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid appointment ID' });
    }

    const hasStatus = status !== undefined;
    const hasPaymentStatus = paymentStatus !== undefined;

    if (!hasStatus && !hasPaymentStatus) {
      return res.status(400).send({ message: 'Nothing to update' });
    }

    if (hasStatus && !['confirmed', 'cancelled'].includes(status)) {
      return res.status(400).send({ message: 'Status must be confirmed or cancelled' });
    }

    if (hasPaymentStatus && paymentStatus !== 'paid') {
      return res.status(400).send({ message: 'paymentStatus must be paid' });
    }

    const isAdmin = role === 'admin';
    const isPatron = role === 'patrons' || role === 'customer' || role === 'patron';
    if (!isAdmin && !isPatron) {
      return res.status(403).send({ message: 'Forbidden' });
    }

    if (hasStatus && status === 'confirmed' && !isAdmin) {
      return res.status(403).send({ message: 'Only admin can confirm appointments' });
    }

    if (hasPaymentStatus && !isAdmin) {
      return res.status(403).send({ message: 'Only admin can update payment status' });
    }

    const filter = { _id: new ObjectId(id) };
    if (isPatron) {
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(401).send({ message: 'Unauthorised' });
      }
      filter.customerId = new ObjectId(userId);
    }

    if (hasStatus) {
      if (status === 'confirmed') {
        filter.status = 'pending';
      } else {
        filter.status = { $in: ['pending', 'confirmed'] };
        filter.paymentStatus = 'unpaid'; // paid appointment needs refund flow (TODO)
      }
    }

    if (hasPaymentStatus) {
      filter.paymentStatus = { $ne: 'paid' };
    }

    const $set = { updatedAt: new Date() };
    if (hasStatus) $set.status = status;
    if (hasPaymentStatus) {
      $set.paymentStatus = 'paid';
      if (typeof paymentId === 'string' && paymentId) $set.paymentId = paymentId;
      $set.paidAt = new Date();
    }

    const result = await appointments.updateOne(filter, { $set });

    if (result.matchedCount === 0) {
      const existing = await appointments.findOne(
        { _id: new ObjectId(id) },
        { projection: { status: 1, paymentStatus: 1, customerId: 1 } }
      );

      if (!existing) {
        return res.status(404).send({ message: 'Appointment not found' });
      }

      if (isPatron && existing.customerId?.toString() !== userId) {
        return res.status(403).send({ message: 'Forbidden' });
      }

      if (hasStatus && existing.paymentStatus === 'paid' && status === 'cancelled') {
        return res.status(409).send({ message: 'Paid appointments cannot be cancelled here' });
      }

      if (hasPaymentStatus && existing.paymentStatus === 'paid') {
        return res.send({ success: true, message: 'Appointment already marked paid' });
      }

      return res.status(409).send({
        message: hasStatus
          ? `This appointment is already ${existing.status}, so it cannot be ${status}`
          : 'Appointment could not be updated',
      });
    }

    res.send({ success: true, message: 'Appointment updated' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to update appointment' });
  }
});



app.delete('/appointments/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid appointment ID' });
    }

    

    const result = await appointments.deleteOne({
      _id: new ObjectId(id),
      status: 'cancelled',
      paymentStatus: 'unpaid',
    });

    if (result.deletedCount === 0) {
      const existing = await appointments.findOne(
        { _id: new ObjectId(id) },
        { projection: { _id: 1 } }
      );

      if (!existing) {
        return res.status(404).send({ message: 'Appointment not found' });
      }
      return res.status(409).send({
        message: 'Only cancelled, unpaid appointments can be deleted',
      });
    }

    res.send({ success: true, message: 'Appointment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to delete appointment' });
  }
});










// POST /payments/confirm -> idempotent: save transaction + mark appointment paid
app.post('/payments/confirm', async (req, res) => {
  try {
    const {
      appointmentId,
      stripeSessionId,
      paymentIntentId,
      amountTotal,
      currency,
      customerEmail,
    } = req.body || {};

    if (!stripeSessionId || typeof stripeSessionId !== 'string') {
      return res.status(400).send({ message: 'stripeSessionId is required' });
    }

    const existingTx = await transactions.findOne({ stripeSessionId });
    if (existingTx) {
      if (appointmentId && ObjectId.isValid(appointmentId)) {
        await appointments.updateOne(
          { _id: new ObjectId(appointmentId), paymentStatus: { $ne: 'paid' } },
          { $set: { paymentStatus: 'paid', paymentId: paymentIntentId || stripeSessionId, paidAt: new Date(), updatedAt: new Date() } }
        );
      }
      return res.send({ success: true, alreadyProcessed: true, transactionId: existingTx._id });
    }

    const txDoc = {
      appointmentId: appointmentId && ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : appointmentId || null,
      stripeSessionId,
      paymentIntentId: paymentIntentId || null,
      amountTotal: typeof amountTotal === 'number' ? amountTotal : null,
      currency: currency || null,
      customerEmail: customerEmail || null,
      status: 'paid',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const txResult = await transactions.insertOne(txDoc);

    if (appointmentId && ObjectId.isValid(appointmentId)) {
      await appointments.updateOne(
        { _id: new ObjectId(appointmentId) },
        {
          $set: {
            paymentStatus: 'paid',
            paymentId: paymentIntentId || stripeSessionId,
            paidAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    }

    res.send({ success: true, transactionId: txResult.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to confirm payment' });
  }
});

app.get('/', (req,res)=>{
    res.send('Luma haircut is running as a backend')
})


app.listen(port, ()=>{
    console.log(`luma haircut is running at ${port}`)
})
