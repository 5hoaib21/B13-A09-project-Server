const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
dotenv.config();
const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // database name and collections
    const db = client.db("studyNook");
    const roomCollection = db.collection("rooms");
    const bookingCollection = db.collection("bookings");

    app.get("/room", async (req, res) => {
      const result = await roomCollection.find().toArray();
      res.json(result);
    });

    app.post("/room", async (req, res) => {
      const roomData = req.body;
      console.log(roomData);
      const result = await roomCollection.insertOne(roomData);
      res.json(result);
    });

    app.get("/room/:id", async (req, res) => {
      const { id } = req.params;

      const result = await roomCollection.findOne({ _id: new ObjectId(id) });

      res.json(result);
    });

    app.patch("/room/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      const result = await roomCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.json(result);
    });

    app.delete("/room/:id", async (req, res) => {
      const { id } = req.params;
      const result = await roomCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.post("/booking", async (req, res) => {
      const bookingData = req.body;
      const result = await bookingCollection.insertOne(bookingData);

      res.json(result);
    });

    app.get("/booking/:userId", async (req, res) => {
      const { userId } = req.params;

      const result = await bookingCollection.find({ userId: userId }).toArray();

      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running fine!!!!");
});

app.listen(PORT, () => {
  console.log(`server running on port: ${PORT}`);
});
