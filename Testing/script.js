let session = null;

// Load model
async function loadModel() {
  session = await ort.InferenceSession.create('model_updated_2.onnx', {
    executionProviders: ['webgl']
  });
  console.log("Model loaded.");
}

loadModel();

// Main prediction function
async function predictImage() {
  const fileInput = document.getElementById('imageFile').files[0];
  const urlInput = document.getElementById('imageURL').value.trim();

  let imageData;

  if (fileInput) {
    imageData = await preprocessImageFromFile(fileInput);
  } else if (urlInput) {
    imageData = await preprocessImageFromURL(urlInput);
  } else {
    document.getElementById('result').innerText = "Please upload a file or enter an image URL.";
    return;
  }

  const inputTensor = new ort.Tensor('float32', imageData, [1, 3, 128, 128]);

  const feeds = {};
  feeds[session.inputNames[0]] = inputTensor;

  const results = await session.run(feeds);
  const output = results[session.outputNames[0]].data;
  console.log("Raw Output:", output);

  const label = output[0] > 0.5 ? "Fake" : "Real"; // flip if needed
  document.getElementById('result').innerText = `Prediction: ${label}`;
}

// Preprocess image from file input
async function preprocessImageFromFile(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => resolve(processImageToTensor(img));
  });
}

// Preprocess image from URL
async function preprocessImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed to load external images
    img.src = url;
    img.onload = () => resolve(processImageToTensor(img));
    img.onerror = () => reject("Failed to load image from URL.");
  });
}

// Common image to tensor function
function processImageToTensor(img) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 128, 128);
  const imageData = ctx.getImageData(0, 0, 128, 128).data;

  let inputData = new Float32Array(3 * 128 * 128);
  for (let i = 0; i < 128 * 128; i++) {
    inputData[i] = (imageData[i * 4] / 255 - 0.485) / 0.229; // R
    inputData[128 * 128 + i] = (imageData[i * 4 + 1] / 255 - 0.456) / 0.224; // G
    inputData[2 * 128 * 128 + i] = (imageData[i * 4 + 2] / 255 - 0.406) / 0.225; // B
  }

  return inputData;
}
