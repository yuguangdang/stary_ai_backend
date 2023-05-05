require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");

const createRoute = require("./routes/create");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use("/create", createRoute);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Story AI backend is up.",
  });
});

app.listen(8080, () => {
  console.log("Server started on port 8080");
});
