<h1>Overview</h1>

Stary AI website: http://www.stary-ai.com

Stary AI is a web APP that enables users to enter a prompt, such as a character or a subject, which is then used to generate a story using the ChatGPT API. Users can also choose a style of image for each paragraph in the created story, which is generated using Dalle 2. Additionally, users can select a narrative voice, which can be that of a celebrity or even an anime character. The story text is then sent to FakeYou, which returns an audio file in the chosen character's voice. Finally, the application creates a video that displays images with the narration for the user to enjoy.

The APP combines various AI technologies such as natural language processing, computer vision, and text-to-speech to create a unique and personalized user experience. It could potentially be used for various purposes such as entertainment, education, or marketing.

<h1>Architecture</h1>

This web application is a single-page application (SPA) created using React and Redux for the frontend, while the backend is a RESTful API developed with NodeJS and Express. The API communicates with multiple third-party APIs such as ChatGPT, Dalle 2, and FakeYou to provide its functionalities.

The video and image files are stored in AWS S3, while the metadata associated with the videos is saved in AWS DynamoDB. The backend of the application is deployed on AWS Beanstalk, while the frontend resides in an S3 bucket. Both the frontend and backend are configured with a CodePipeline for continuous integration and continuous deployment (CI/CD).

<h1>Workflow</h1>

<h3>Intro info</h3>
<img width="500" alt="Intro" src="https://user-images.githubusercontent.com/55920971/236075153-ac839a0c-f672-4ec3-bc39-83cbf65d7f51.png">

<h3>Step 1</h3>
<img width="500" alt="step 1" src="https://user-images.githubusercontent.com/55920971/236075976-0346699a-2f3d-4b3f-ae98-1abfebf81fde.png">

<h3>Step 2</h3>
<img width="500" alt="step 2" src="https://user-images.githubusercontent.com/55920971/236076795-513226f5-ff78-4d2e-ae1d-7af0304f0011.png">

<h3>Step 3</h3>
<img width="500" alt="step3" src="https://user-images.githubusercontent.com/55920971/236076817-969f926d-99ed-4868-bd40-1d3c92083423.png">

<h3>About page</h3>
<img width="500" alt="step3" src="https://user-images.githubusercontent.com/55920971/236164388-43145c48-2855-4ca0-a94a-3d404a6254c7.png">

<h3>Videos page</h3>
<img width="500" alt="videos" src="https://github.com/yuguangdang/stary_ai_frontend/assets/55920971/053b8d79-d26c-4efa-ab9b-25cbdb848c4e">

<h3>Video detail page</h3>
<img width="500" alt="videoDetail" src="https://github.com/yuguangdang/stary_ai_frontend/assets/55920971/03eeeb0c-8509-47c0-9941-272aa732fbd8">


<h3>An example of the final video</h3>
http://www.stary-ai.com/videoDetail/a7c78ffd21ae6fc8.mp4

<h3>Responsive Web Design</h3>
The App adopts responsive web design to provide an optimal viewing and interaction experience across a wide range of devices, including desktop computers, laptops, tablets, and smartphones. For example, the App adjusts the size and placement of images and text, reorganize navigation menus, and adjust the flow of content to make it easier to read and interact with on smaller screens. Below are screenshots of how the App looks like in a mobile size screen.
<hr/>
<div>
  <img width="150" height="300" alt="intro-m" src="https://user-images.githubusercontent.com/55920971/236356556-c23f49e1-0ee8-42fb-9ce2-08fc3f091653.png">
  <img width="150" height="300" alt="step1-m" src="https://user-images.githubusercontent.com/55920971/236356538-057660d5-cd46-4144-b1e5-32577e448b26.png">
  <img width="150" height="300" alt="step2-m" src="https://user-images.githubusercontent.com/55920971/236356550-cb63cd42-2c44-4157-8f82-3e1cc5f20ac7.png">
  <img width="150" height="300" alt="step3-m" src="https://user-images.githubusercontent.com/55920971/236356557-2a866b68-52ea-403e-bdd6-7d184f303f76.png">
  <img width="150" height="300" alt="about-m" src="https://user-images.githubusercontent.com/55920971/236356560-b8bd2003-98e3-4648-83a2-2058965230b0.png">
  <img width="150" height="300" alt="videos-m" src="https://github.com/yuguangdang/stary_ai_frontend/assets/55920971/0959dd4a-46a2-4760-867e-d2017f81b00a">
</div>
