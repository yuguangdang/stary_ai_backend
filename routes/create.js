const express = require("express");
const router = express.Router();

const createController = require("../controllers/create");

router.post("/create-story", createController.createStory);
router.post("/create-images", createController.createImages);
router.post("/create-movie", createController.createMovie);
router.get("/get-video-urls", createController.getVideoUrls);

module.exports = router;
