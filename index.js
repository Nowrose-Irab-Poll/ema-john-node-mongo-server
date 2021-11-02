const express = require("express");
const cors = require("cors");
require("dotenv").config();
var admin = require("firebase-admin");

const { MongoClient } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

//firebase admin initialization

var serviceAccount = require("./ema-john-a91bd-firebase-adminsdk-tdsbl-6221e8e2c5.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g5tsn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  try {
    const bearer = req.headers?.authorization;
    if (bearer.startsWith("bearer ")) {
      const idToken = req.headers?.authorization.split(" ")[1];
      const decodedUser = await admin.auth().verifyIdToken(idToken);
      req.decodedUserEmail = decodedUser.email;
    }
  } catch {}
  next();
}

async function run() {
  try {
    await client.connect();
    console.log("Connected to db");

    const database = client.db("online_shop");
    const productsCollection = database.collection("products");
    const ordersCollection = database.collection("orders");

    //GET API
    app.get("/products", async (req, res) => {
      const page = req.query.page;
      const size = parseInt(req.query.size);
      const cursor = productsCollection.find({});
      const count = await cursor.count();

      let products = [];

      if (page) {
        products = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        products = await cursor.toArray();
      }

      res.send({
        count,
        products,
      });
    });

    //Orders GET API
    app.get("/orders", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (email === req.decodedUserEmail) {
        const query = { email: email };

        const cursor = ordersCollection.find(query);
        const orders = await cursor.toArray();
        res.send(orders);
      } else {
        res.status(401).send({ message: "User Not Authorized" });
      }
    });

    //POST API to get data by keys
    app.post("/products/byKeys", async (req, res) => {
      const keys = req.body;
      const query = { key: { $in: keys } };
      const products = await productsCollection.find(query).toArray();

      res.json(products);
    });

    //Orders POST API
    app.post("/orders", async (req, res) => {
      const order = req.body;
      order.createdAt = new Date();
      console.log(order);
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(port, () => {
  console.log("Listening to port:", port);
});
