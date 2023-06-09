require("dotenv").config();

const cors = require("cors");
const express = require("express");
const bodyParser = require("body-parser");

const createRoute = require("./routes/create");

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://stary-ai.com",
    "http://www.stary-ai.com",
  ],
};
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use("/create", createRoute);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Story AI backend is up.",
  });
});

app.listen(8080, () => {
  console.log("Server started on port 8080");
});
