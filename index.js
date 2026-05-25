const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config();
const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;
app.use(cors());
app.use(express.json());

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeAmenities = (value) => {
  if (!value) return [];

  return (Array.isArray(value) ? value : String(value).split(","))
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const buildRentExpr = (minRent, maxRent) => {
  const rentValue = {
    $convert: {
      input: "$rent",
      to: "double",
      onError: null,
      onNull: null,
    },
  };

  const conditions = [];

  if (minRent !== undefined) {
    conditions.push({ $gte: [rentValue, minRent] });
  }

  if (maxRent !== undefined) {
    conditions.push({ $lte: [rentValue, maxRent] });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];

  return { $and: conditions };
};

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const header = req?.headers?.authorization;

  if (!header) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    // await client.connect();

    // database name and collections
    const db = client.db("studyNook");
    const roomCollection = db.collection("rooms");
    const bookingCollection = db.collection("bookings");

    const getRooms = async (req, res) => {
      const { search, amenity, amenities, price, minRent, maxRent } = req.query;
      const query = {};

      if (typeof search === "string" && search.trim()) {
        query.room_name = { $regex: search.trim(), $options: "i" };
      }

      const amenityList = normalizeAmenities(amenities || amenity);
      if (amenityList.length > 0) {
        query.amenities = { $in: amenityList };
      }

      let minValue = parseNumber(minRent);
      let maxValue = parseNumber(maxRent);

      if (price === "low") {
        minValue = 0;
        maxValue = 10;
      } else if (price === "mid") {
        minValue = 10;
        maxValue = 25;
      } else if (price === "high") {
        minValue = 25;
      }

      const rentExpr = buildRentExpr(minValue, maxValue);
      if (rentExpr) {
        query.$expr = rentExpr;
      }

      const result = await roomCollection.find(query).toArray();
      res.json(result);
    };

    app.get("/room", getRooms);
    app.get("/api/rooms", getRooms);
    // middleware 1
    app.post("/room", verifyToken, async (req, res) => {
      const roomData = req.body;
      console.log(roomData);
      const result = await roomCollection.insertOne(roomData);
      res.json(result);
    });

    // middleware for test
    app.get("/room/:id", async (req, res) => {
      const { id } = req.params;

      const result = await roomCollection.findOne({ _id: new ObjectId(id) });

      res.json(result);
    });
    app.get("/myroom/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const result = await roomCollection.find({ userId: id }).toArray();

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

    app.delete("/room/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await roomCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.post("/booking", async (req, res) => {
      const bookingData = req.body;

      const { roomId, date, startTime, endTime } = bookingData;

      const verifyTimeSlot = await bookingCollection.findOne({
        roomId,
        date,
        $or: [
          {
            startTime: { $lt: endTime },
            endTime: { $gt: startTime },
          },
        ],
      });

      if (verifyTimeSlot) {
        return res.status(400).json({
          message: "This time slot is already booked!",
        });
      }

      const result = await bookingCollection.insertOne(bookingData);

      res.json(result);
    });
    // middleware 2
    app.get("/booking/:userId", verifyToken, async (req, res) => {
      const { userId } = req.params;

      const result = await bookingCollection.find({ userId: userId }).toArray();

      res.json(result);
    });

    app.patch("/booking/:bookingId/cancel", verifyToken, async (req, res) => {
      const { bookingId } = req.params;
      console.log(bookingId, "result");
      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: "cancelled" } },
      );
      res.json(result);
    });

    // await client.db("admin").command({ ping: 1 });
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
