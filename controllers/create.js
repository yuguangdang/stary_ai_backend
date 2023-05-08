const { Configuration, OpenAIApi } = require("openai");
const videoshow = require("videoshow");
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");
const FakeYou = require("fakeyou.js");
const fs = require("fs");
const AWS = require("aws-sdk");
const crypto = require("crypto");

// Start openai API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
// Start FAKEYOU API
const fy = new FakeYou.Client({
  usernameOrEmail: "yuguangdang123@gmail.com",
  password: process.env.FAKEYOU_PASSWORD,
});
fy.start();
// Start SWS S3
const s3 = new AWS.S3();

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
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: "An error occurred during your request.",
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
          message: "An error occurred during your request.",
        },
      });
    }
  }
};

exports.createMovie = async (req, res, next) => {
  const { prompt, story, images, narrator } = req.body;
  const updatedStory = story.map((str) => `,${str}`);

  try {
    // Downloading all the images
    console.log("Start downloading images ...");
    const imagePaths = await Promise.all(
      images.map(async (imageUrl, i) => {
        const imagePath = `/tmp/image${i + 1}-${new Date().toISOString()}.jpg`;
        await downloadImage(imageUrl, imagePath);
        return imagePath;
      })
    );
    console.log("Images downloaded successfully.");
    // Downloading audio files, get each audio duration and merge all audio files
    const { mergedAudioFile, durations, audioFiles } = await downloadAudio(
      updatedStory,
      narrator.id
    );
    // Calculate the total duration for the logo
    const totalDuration = durations.reduce((acc, val) => acc + val, 0);
    // Create the video
    const videoFile = await createVideo(
      prompt,
      imagePaths,
      durations,
      totalDuration,
      narrator,
      mergedAudioFile,
    );
    // Upload the video file to S3
    const bucketName = "staryai";
    const randomString = crypto.randomBytes(8).toString("hex");
    ("AI generated story about tiger narrated by a fake voice of Emma Watson - 2023-05-07T07:18:16.230Z.mp4");
    const fileContent = fs.readFileSync(videoFile);
    const params = {
      Bucket: bucketName,
      Key: randomString,
      Body: fileContent,
    };
    const region = "ap-southeast-2";
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/${randomString}`;
    await s3.putObject(params).promise();
    // Delte all files in the tmp folder
    deleteFiles(audioFiles);
    deleteFiles(imagePaths);
    deleteFiles([mergedAudioFile]);
    deleteFiles([videoFile]);

    console.log(`Video uploaded to S3 bucket: ${bucketName}/${videoFile}`);
    res.status(200).json({
      message: `Video uploaded to S3 bucket: ${url}`,
      url: url,
    });
  } catch (error) {
    // If there's an error with the request, send an error response with a message
    console.error(error);
    res.status(400).json({ error: "Bad request" });
  }
};

exports.getVideoUrls = async (req, res, next) => {
  const bucketName = "staryai";
  const region = "ap-southeast-2";

  try {
    const response = await s3
      .listObjectsV2({
        Bucket: bucketName,
      })
      .promise();

    const urls = response.Contents.map((item) => {
      return `https://${bucketName}.s3.${region}.amazonaws.com/${item.Key}`;
    });

    res.status(200).json({
      message: `Video urls fetched successfully.`,
      urls: urls,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Bad request" });
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

const downloadImage = async (url, path) => {
  const writer = fs.createWriteStream(path);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

const downloadAudio = async (story, voice) => {
  const publicPath = "https://storage.googleapis.com/vocodes-public";
  const audioFiles = [];

  try {
    const model = await fy.models.fetch(voice);

    for (let i = 0; i < story.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(`Creating voiceover audio for story ${i + 1} ...`);
      console.log(story[i]);
      const response = await model.request(story[i]);
      const audioUrl = publicPath + response.audioPath;
      console.log(audioUrl);

      // Save audioUrl to file
      const audioPath = `/tmp/audio${i + 1}-${new Date().toISOString()}.mp3`;
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
      audioFiles.push(audioPath);
      console.log(`Voiceover audio saved to: ${audioPath}`);
    }
    console.log("All audio files have been succesfully downloaded.");

    const durations = await getAudioDurations(audioFiles);
    console.log(durations);
    const mergedAudioFile = await mergeAudioFiles(audioFiles);
    console.log(mergedAudioFile);

    return { mergedAudioFile, durations, audioFiles };
  } catch (error) {
    console.error(error);
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
  mergedAudioFile,
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
