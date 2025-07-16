document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('imageFile');
    const urlInput = document.getElementById('imageURL');
    const predictButton = document.getElementById('predictButton');
    const captureVisibleTabButton = document.getElementById('captureVisibleTabButton');
    const extractImagesButton = document.getElementById('extractImagesButton');
    const imageListDiv = document.getElementById('imageList');
    const predictSelectedImageButton = document.getElementById('predictSelectedImageButton');
    const resultElement = document.getElementById('result');
    const dropZone = document.getElementById('dropZone');
    const fileNameDisplay = document.getElementById('file-name');
    const previewImage = document.getElementById('preview');
    const spinner = document.getElementById('spinner');
    const confidenceBarContainer = document.getElementById('confidenceBarContainer');
    const confidenceBar = document.getElementById('confidenceBar');

    let selectedImageUrl = null;

    // Preview file image
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            const reader = new FileReader();
            reader.onload = e => {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            fileNameDisplay.textContent = 'No file chosen';
            previewImage.style.display = 'none';
        }
    });

    // Drag and drop events
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });

    // Predict image
    predictButton.addEventListener('click', () => {
        showLoading();

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const tensorData = processImageToTensor(img);
                    sendMessageToBackground({ type: 'predictImage', tensorData: tensorData });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (urlInput.value.trim()) {
            sendMessageToBackground({ type: 'predictImage', imageUrl: urlInput.value.trim() });
        } else {
            hideLoading();
            resultElement.textContent = "Please upload a file or enter an image URL.";
        }
    });

    captureVisibleTabButton.addEventListener('click', () => {
        showLoading("Capturing visible tab and processing...");
        sendMessageToBackground({ type: 'captureAndPredict' });
    });

    extractImagesButton.addEventListener('click', async () => {
        showLoading("Extracting images from page...");
        imageListDiv.innerHTML = '<p>Loading images...</p>';
        selectedImageUrl = null;
        predictSelectedImageButton.style.display = 'none';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const urls = Array.from(document.images).map(img => img.src);
                    return urls;
                },
            }, (results) => {
                if (results && results[0]?.result) {
                    displayExtractedImages(results[0].result);
                } else {
                    imageListDiv.innerHTML = '<p>No images found or error extracting.</p>';
                    resultElement.innerText = "No images extracted.";
                    hideLoading();
                }
            });
        }
    });

    predictSelectedImageButton.addEventListener('click', () => {
        if (selectedImageUrl) {
            showLoading("Predicting selected image...");
            sendMessageToBackground({ type: 'predictImage', imageUrl: selectedImageUrl });
        }
    });

    function displayExtractedImages(urls) {
        imageListDiv.innerHTML = '';
        if (urls.length === 0) {
            imageListDiv.innerHTML = '<p>No images found on this page.</p>';
            hideLoading();
            return;
        }

        urls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.title = url;
            img.addEventListener('click', () => {
                const selected = imageListDiv.querySelector('.selected');
                if (selected) selected.classList.remove('selected');
                img.classList.add('selected');
                selectedImageUrl = url;
                previewImage.src = url;
                previewImage.style.display = 'block';
                predictSelectedImageButton.style.display = 'block';
            });
            imageListDiv.appendChild(img);
        });

        resultElement.innerText = `Found ${urls.length} images. Click to select one for prediction.`;
        hideLoading();
    }

    function showLoading(message = "Processing...") {
        resultElement.textContent = message;
        spinner.style.display = 'block';
        confidenceBarContainer.style.display = 'none';
        confidenceBar.style.width = '0%';
    }

    function hideLoading() {
        spinner.style.display = 'none';
    }

    chrome.runtime.onMessage.addListener((message) => {
        hideLoading();
        if (message.type === 'predictionResult') {
            resultElement.textContent = `Prediction: ${message.label}`;
            if (message.confidence) {
                confidenceBarContainer.style.display = 'block';
                confidenceBar.style.width = `${Math.floor(message.confidence * 100)}%`;
            }
        } else if (message.type === 'predictionError') {
            resultElement.textContent = `Error: ${message.error}`;
        }
    });

    function sendMessageToBackground(msg) {
        chrome.runtime.sendMessage(msg);
    }

    function processImageToTensor(img) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 128, 128);
        const imageData = ctx.getImageData(0, 0, 128, 128).data;

        let inputData = new Float32Array(3 * 128 * 128);
        for (let i = 0; i < 128 * 128; i++) {
            inputData[i] = (imageData[i * 4] / 255 - 0.485) / 0.229;
            inputData[128 * 128 + i] = (imageData[i * 4 + 1] / 255 - 0.456) / 0.224;
            inputData[2 * 128 * 128 + i] = (imageData[i * 4 + 2] / 255 - 0.406) / 0.225;
        }
        return Array.from(inputData);
    }
});