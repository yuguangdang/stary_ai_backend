const { Configuration, OpenAIApi } = require("openai");
const videoshow = require("videoshow");
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");
const FakeYou = require("fakeyou.js");
const fs = require("fs");
const AWS = require("aws-sdk");
const crypto = require("crypto");
const Bottleneck = require("bottleneck");

// Start openai API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
// Start FAKEYOU API
const fy = new FakeYou.Client({
  usernameOrEmail: process.env.FY_USERNAME,
  password: process.env.FAKEYOU_PASSWORD,
});
// Set up the Bottleneck limiter for FakeYou API
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: (2 * 1000) / 3, // Allow 3 requests per 2 seconds
});
fy.start();
// Start SWS S3
const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;
const region = process.env.AWS_REGION;
// Create a DynamoDB instance
AWS.config.update({ region: region });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
// Initiate process status
let processingRequests = {};

exports.createStory = async (req, res, next) => {
  const subject = req.body.prompt;
  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message:
          "OpenAI API key not configured, please follow instructions in README.md",
      },
    });
    return;
  }

  try {
    console.log(`Creating a story about ${subject} ...`);
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: generatePrompt(subject),
      max_tokens: 500,
      temperature: 0.6,
    });
    console.log("A story successfully created.");
    res.status(200).json({ result: completion.data.choices[0].text });
  } catch (error) {
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: "An error occurred during requesting to openai.",
        },
      });
    }
  }
};

exports.createImages = async (req, res, next) => {
  const prompts = req.body.prompts;
  const style = req.body.style;

  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message:
          "OpenAI API key not configured, please follow instructions in README.md",
      },
    });
    return;
  }

  try {
    console.log("Asking OpenAI to create images ...");
    const image_promises = prompts.map((prompt) => createImage(prompt, style));
    const images = await Promise.all(image_promises);
    console.log("Images created successfully.");
    res.status(200).json({ images: images });
  } catch (error) {
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: "An error occurred during requesting to openai.",
        },
      });
    }
  }
};

exports.createMovie = async (req, res, next) => {
  const { prompt, story, images, narrator } = req.body;
  const updatedStory = story.map((str) => `,${str}`);
  const requestId = crypto.randomBytes(8).toString("hex");
  // Save the request's initial status
  processingRequests[requestId] = { status: "processing", progress: 5 };

  res.status(200).json({ requestId: requestId });

  try {
    // Downloading images to tmp and upload them to S3 bucket.
    const { imagePaths, imageUrls } = await downloadAndUploadImages(images);
    processingRequests[requestId] = { status: "processing", progress: 10 };
    // Downloading audio files, get each audio duration and merge all audio files
    const { mergedAudioFile, durations, audioFiles } = await downloadAudio(
      updatedStory,
      narrator.id,
      requestId
    );
    processingRequests[requestId] = { status: "processing", progress: 85 };

    // Calculate the total duration for the logo
    const totalDuration = durations.reduce((acc, val) => acc + val, 0);

    // Create the video
    const videoFile = await createVideo(
      prompt,
      imagePaths,
      durations,
      totalDuration,
      narrator,
      mergedAudioFile
    );
    processingRequests[requestId] = { status: "processing", progress: 95 };

    // Upload the video file to S3
    const videoFileName = crypto.randomBytes(8).toString("hex") + ".mp4";
    const fileContent = fs.readFileSync(videoFile);
    const params = {
      Bucket: bucketName,
      Key: videoFileName,
      Body: fileContent,
      ContentType: "video/mp4",
    };
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/${videoFileName}`;
    await s3.putObject(params).promise();

    // Update the final status and video url
    processingRequests[requestId] = {
      status: "finished",
      progress: 100,
      url: url,
    };

    // Store video name and S3 URL into DynamoDB
    const videoName = `${
      prompt.charAt(0).toUpperCase() + prompt.slice(1).toLowerCase()
    } narrated by ${narrator.name}`;
    const dbParams = {
      TableName: "staryai",
      Item: {
        videoId: videoFileName,
        videoName: videoName,
        S3Url: url,
        imageUrls: imageUrls,
        story: story,
      },
    };
    try {
      await dynamoDB.put(dbParams).promise();
      console.log(`${videoName} is added into db successfully.`);
    } catch (error) {
      console.error(`Error storing data to DynamoDB: ${error}`);
      throw error;
    }

    // Delete all files in the tmp folder
    deleteFiles(audioFiles);
    deleteFiles(imagePaths);
    deleteFiles([mergedAudioFile]);
    deleteFiles([videoFile]);

    console.log(`Video uploaded to S3 bucket: ${bucketName}/${videoFile}`);
    // Update the status to 'finished'
  } catch (error) {
    console.error(error);
    processingRequests[requestId].status = "error";
    processingRequests[requestId].errorMessage = error.message;
  }
};

exports.getCreateMovieStatus = async (req, res) => {
  const { requestId } = req.query;

  if (!requestId || !processingRequests[requestId]) {
    return res.status(404).json({ error: "Request not found" });
  }

  const requestStatus = processingRequests[requestId];
  if (requestStatus.status === "finished" || requestStatus.status === "error") {
    delete processingRequests[requestId];
  }

  res.status(200).json(requestStatus);
};

exports.getVideos = async (req, res, next) => {
  const params = {
    TableName: "staryai",
  };

  try {
    const data = await dynamoDB.scan(params).promise();
    res.status(200).json(data.Items);
  } catch (error) {
    console.error(`Error retrieving data from DynamoDB: ${error}`);
    res.status(500).json({ error: "Error retrieving data from DynamoDB" });
  }
};

exports.getVideo = async (req, res, next) => {
  const { videoId } = req.query;
  console.log(videoId)
  try {
    const params = {
      TableName: "staryai",
      Key: { videoId: videoId },
    };

    const data = await dynamoDB.get(params).promise();

    if (data.Item) {
      res.json(data.Item);
    } else {
      res.status(404).send("Video not found");
    }
  } catch (error) {
    console.error("Error in get video:", error);
    res.status(500).send("An error occurred while retrieving the video");
  }
};

const generatePrompt = (animal) => {
  const capitalizedAnimal =
    animal[0].toUpperCase() + animal.slice(1).toLowerCase();
  return `Make a story about ${capitalizedAnimal}.`;
};

const createImage = async (prompt, style) => {
  try {
    const response = await openai.createImage({
      prompt: `In ${style} style, create an image about ${prompt}`,
      n: 1,
      size: "512x512",
    });
    return response.data.data[0].url;
  } catch (error) {
    throw error;
  }
};

const downloadAndUploadImages = async (images) => {
  try {
    const imageDetails = await Promise.all(
      images.map(async (imageUrl, i) => {
        // Define the local image path and S3 key
        const imagePath = `/tmp/image${i + 1}-${new Date().toISOString()}.jpg`;
        const imageKey = `image${i + 1}-${new Date().toISOString()}.jpg`;

        // Download the image and save it locally
        const response = await axios({
          url: imageUrl,
          method: "GET",
          responseType: "stream",
        });
        const writer = fs.createWriteStream(imagePath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        // Upload the image to S3
        const fileContent = fs.createReadStream(imagePath);

        const uploadParams = {
          Bucket: bucketName,
          Key: imageKey,
          Body: fileContent,
          ContentType: "image/jpeg",
          ContentDisposition: "inline",
        };
        await s3.upload(uploadParams).promise();

        // Create the S3 URL of the image
        const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${imageKey}`;

        // Return the local path and S3 URL
        return { path: imagePath, url: s3Url };
      })
    );

    const imagePaths = imageDetails.map((detail) => detail.path);
    const imageUrls = imageDetails.map((detail) => detail.url);

    console.log("Images downloaded and uploaded to S3 successfully.");
    return { imagePaths, imageUrls };
  } catch (error) {
    console.error(
      "Error occurred while downloading and uploading images:",
      error
    );
    throw error;
  }
};

const downloadAudio = async (story, voice, requestId) => {
  const publicPath = "https://storage.googleapis.com/vocodes-public";
  const audioFiles = [];

  try {
    const model = await fy.models.fetch(voice);

    const processStoryPart = async (part, index) => {
      console.log(`Creating voiceover audio for story ${index + 1} ...`);
      const response = await limiter.schedule(() => model.request(part));
      const audioUrl = publicPath + response.audioPath;
      console.log(audioUrl);

      // Save audioUrl to file
      const audioPath = `/tmp/audio${
        index + 1
      }-${new Date().toISOString()}.mp3`;
      const audioFile = fs.createWriteStream(audioPath);
      const audioResponse = await axios.get(audioUrl, {
        responseType: "stream",
      });
      // Wait for the file to be fully written to the disk
      await new Promise((resolve, reject) => {
        audioResponse.data
          .pipe(audioFile)
          .on("finish", () => {
            resolve();
          })
          .on("error", (err) => {
            reject(err);
          });
      });
      console.log(`Voiceover audio saved to: ${audioPath}`);

      // Update the status after each file is downloaded
      processingRequests[requestId].status = "processing";
      processingRequests[requestId].progress = Math.round(
        ((index + 1) / (story.length + 1)) * 100
      );

      return audioPath;
    };

    const audioPathsPromises = story.map((part, index) =>
      processStoryPart(part, index)
    );

    const audioPaths = await Promise.all(audioPathsPromises);
    audioFiles.push(...audioPaths);

    console.log("All audio files have been successfully downloaded.");

    const durations = await getAudioDurations(audioFiles);
    console.log(durations);
    const mergedAudioFile = await mergeAudioFiles(audioFiles);
    console.log(mergedAudioFile);

    return { mergedAudioFile, durations, audioFiles };
  } catch (error) {
    console.error(error);
    // Update status to error if something goes wrong
    processingRequests[requestId].status = "error";
    processingRequests[requestId].error = error.message;
    throw error;
  }
};

const mergeAudioFiles = (audioFiles) => {
  const outputFile = "/tmp/mergedAudio.mp3";
  const command = ffmpeg();

  for (const audioFile of audioFiles) {
    command.input(audioFile);
  }

  return new Promise((resolve, reject) => {
    command
      .concat(outputFile)
      .on("error", (err) => {
        console.error(err);
        reject(err);
      })
      .on("end", () => {
        console.log("Audio files merged successfully!");
        resolve(outputFile);
      })
      .save(outputFile);
  });
};

const getAudioDurations = async (audioFiles) => {
  const durationPromises = audioFiles.map((audioFile) => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioFile, (err, metadata) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          const durationInSeconds = metadata.format.duration;
          resolve(durationInSeconds);
        }
      });
    });
  });

  const durations = await Promise.all(durationPromises);
  return durations;
};

const createVideo = async (
  prompt,
  imagePaths,
  durations,
  totalDuration,
  narrator,
  mergedAudioFile
) => {
  // Create fames for showvideo()
  const frames = imagePaths.map((imagePath, index) => {
    return { path: imagePath, loop: durations[index] };
  });

  var videoOptions = {
    transition: false,
  };

  var audioParams = {
    fade: false,
    delay: 0.1, // seconds
  };

  var logoParams = {
    start: 0.1,
    end: totalDuration,
  };

  const outputFile = `/tmp/${prompt}_${narrator.name}.mp4`;

  return new Promise((resolve, reject) => {
    // Create the final video
    videoshow(frames, videoOptions)
      .audio(mergedAudioFile, audioParams)
      .logo("./image/logo.png", logoParams)
      .save(outputFile)
      .on("start", function (command) {
        console.log("ffmpeg process started:", command);
      })
      .on("error", function (err) {
        console.error("Error:", err);
        reject(err);
      })
      .on("end", function (output) {
        console.log("Video created in:", output);
        resolve(outputFile);
      });
  });
};

const deleteFiles = (files) => {
  for (const file of files) {
    fs.unlink(file, (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`Deleted file: ${file}`);
      }
    });
  }
};
