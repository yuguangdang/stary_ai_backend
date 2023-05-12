const express = require("express");
const router = express.Router();

const createController = require("../controllers/create");

router.post("/create-story", createController.createStory);
router.post("/create-images", createController.createImages);
router.post("/create-movie", createController.createMovie);
router.get("/get-create-movie-status", createController.getCreateMovieStatus);
router.get("/get-videos", createController.getVideos);
router.get("/get-video", createController.getVideo);

module.exports = router;
