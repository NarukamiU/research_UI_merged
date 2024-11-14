// ==============================
// 1. グローバル変数と定数
// ==============================

// APIのベースURLを設定
const API_BASE_URL = 'http://localhost:3000';

// グローバルスコープで socket 変数を定義
let socket;

// 画像縮小率 (0.1 - 1.0), 0.2 で元のサイズの 20%
let imageScale = 0.2; 

// ==============================
// 2. ヘルパー関数
// ==============================

/**
 * 要素の表示・非表示を切り替える関数
 * @param {HTMLElement} element - 表示を切り替える対象の要素
 */
function toggleElementDisplay(element) {
  element.style.display = element.style.display === 'block' ? 'none' : 'block';
}

/**
 * 共通のエラーハンドリング関数
 * @param {Error} error - 発生したエラー
 * @param {string} message - ユーザーに表示するメッセージ
 */
function handleError(error, message) {
  console.error(error);
  alert(message);
}

/**
 * 共通のリクエスト送信関数
 * @param {string} url - リクエスト先のURL
 * @param {string} method - HTTPメソッド
 * @param {Object} data - 送信するデータ
 * @param {string} errorMessage - エラーメッセージ
 * @returns {Promise<Object>} - レスポンスデータ
 */
async function sendRequest(url, method, data, errorMessage) {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    console.log(responseData.message);
    return responseData;
  } catch (error) {
    handleError(error, errorMessage);
    throw error;
  }
}

// ==============================
// 2.5 API
// ==============================

/**
 * ローディング表示API
 * @param {HTMLElement} element - ローディングを表示する要素
 * @returns {Promise<void>}
 */
function showLoading(element) {
  return new Promise(resolve => {
    element.classList.add('loading');
    const loadingCompleteEvent = new CustomEvent('loadingComplete');
    element.addEventListener('loadingComplete', () => {
      element.classList.remove('loading');
      resolve();
    }, { once: true });
  });
}

/**
 * 画像を縮小して低画質で表示するAPI (DataURLを返す)
 * @param {HTMLImageElement} img - 画像要素
 * @param {number} scale - 縮小率
 * @returns {Promise<string>} - 画像のDataURL
 */
function displayLowQualityImage(img, scale) {
  return new Promise(resolve => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg')); 
    };
  });
}

/**
 * ローディング表示と遅延読み込みを組み合わせたAPI
 * @param {string} imageSrc - 画像のソースURL
 * @param {number} scale - 画像の縮小率
 * @param {HTMLElement} imageContainer - 画像を表示するコンテナ
 * @returns {Promise<void>}
 */
async function lazyLoadImage(imageSrc, scale, imageContainer) {
  const loadingPromise = showLoading(imageContainer);
  try {
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    const scaledImageDataUrl = await displayLowQualityImage(img, scale);
    imageContainer.style.backgroundImage = `url(${scaledImageDataUrl})`;
    imageContainer.dispatchEvent(new CustomEvent('loadingComplete'));
  } catch (error) {
    handleError(error, "画像の取得に失敗しました。");
    imageContainer.dispatchEvent(new CustomEvent('loadingComplete'));
  }
}

// ==============================
// 3. データ取得と表示
// ==============================

/**
 * サーバーからラベルリストを取得する関数
 * @param {string} projectName - プロジェクト名
 * @returns {Promise<Array>} - ラベルリスト
 */
async function fetchLabelList(projectName) {
  const projectPath = `/projects/${projectName}/training-data`; 
  const response = await fetch(`${API_BASE_URL}/directory?path=${projectPath}`);
  if (!response.ok) {
    throw new Error('ラベルリストの取得に失敗しました');
  }
  return await response.json();
}

/**
 * 既存のラベルコンテナをクリアする関数
 */
function clearLabelContainers() {
  const imageGrid = document.getElementById('imageGrid');
  imageGrid.innerHTML = '';
}

/**
 * 画像カードを追加する関数
 * @param {HTMLElement} imageGridInner - 画像グリッド内の要素
 * @param {string} imageSrc - 画像のソースURL
 * @param {string} imageName - 画像名
 * @param {string} labelName - ラベル名
 * @param {IntersectionObserver} observer - 画像の観察者
 */
function addImageCard(imageGridInner, imageSrc, imageName, labelName, observer) {
  const imageCard = document.createElement('div');
  imageCard.classList.add('image-card');
  imageCard.dataset.imageName = imageName;
  imageCard.dataset.labelName = labelName;

  const imagePlaceholder = document.createElement('div');
  imagePlaceholder.classList.add('image-placeholder');
  imageCard.appendChild(imagePlaceholder);

  observer.observe(imageCard);
  lazyLoadImage(imageSrc, imageScale, imagePlaceholder).catch(() => {});

  // Delete ボタン
  const deleteButton = document.createElement('button');
  deleteButton.classList.add('delete-button');
  deleteButton.textContent = 'Delete';
  deleteButton.dataset.imageName = imageName;
  deleteButton.dataset.labelName = labelName;
  deleteButton.style.display = 'none';
  deleteButton.addEventListener('click', handleDeleteButtonClick);
  imageCard.appendChild(deleteButton);

  // ラベル表示
  const labelSpan = document.createElement('span');
  labelSpan.classList.add('image-label');
  labelSpan.textContent = labelName;
  labelSpan.style.display = 'none';
  labelSpan.addEventListener('click', handleLabelClick);
  imageCard.appendChild(labelSpan);

  // 画像名表示
  const imageNameSpan = document.createElement('span');
  imageNameSpan.classList.add('image-name');
  imageNameSpan.style.display = 'none';
  imageCard.appendChild(imageNameSpan);

  // ホバーイベント
  imageCard.addEventListener('mouseover', () => {
    imageNameSpan.textContent = imageName;
    imageNameSpan.style.display = 'block';
  });

  imageCard.addEventListener('mouseout', () => {
    imageNameSpan.style.display = 'none';
  });

  imageGridInner.appendChild(imageCard);
}

/**
 * 指定されたラベルの画像を表示する関数
 * @param {Object} label - ラベルオブジェクト
 * @param {string} projectPath - プロジェクトパス
 * @returns {Promise<void>}
 */
async function displayImagesForLabel(label, projectPath) {
  const response = await fetch(`${API_BASE_URL}/directory?path=${projectPath}/${label.name}`);
  const imageList = await response.json();
  const imageGridInner = document.querySelector(`.label-container[data-label-id="${label.name}"] .image-grid-inner`);
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imageCard = entry.target;
        const imageSrc = `/images?path=${projectPath}/${label.name}/${encodeURIComponent(imageCard.dataset.imageName)}`;
        lazyLoadImage(imageSrc, imageScale, imageCard.querySelector('.image-placeholder')).catch(() => {});
        observer.unobserve(imageCard);
      }
    });
  });

  imageList.filter(image => !image.isDirectory).forEach(image => {
    const imageSrc = `/images?path=${projectPath}/${label.name}/${encodeURIComponent(image.name)}`;
    addImageCard(imageGridInner, imageSrc, image.name, label.name, observer);
  });
}

/**
 * 各ラベルの画像を表示する関数
 * @returns {Promise<void>}
 */
async function displayEachLabelImages() {
  try {
    const projectName = document.getElementById("projectLink").textContent.trim();
    const projectPath = `/projects/${projectName}`;
    clearLabelContainers();

    const labelList = await fetchLabelList(projectName);
    createLabelContainers(labelList);

    await Promise.all(
      labelList.filter(label => label.isDirectory).map(label => displayImagesForLabel(label, `${projectPath}/training-data`).then(() => updateLabelImageCount(label.name)))
    );

    updateImageCount();
  } catch (error) {
    handleError(error, '画像一覧の取得に失敗しました');
  }
}

// ==============================
// 4. DOM操作とイベントリスナー
// ==============================

/**
 * ラベルコンテナを作成する関数
 * @param {string} labelName - ラベル名
 * @returns {HTMLElement} - 作成したラベルコンテナ
 */
function createLabelContainer(labelName) {
  const labelContainer = document.createElement('div');
  labelContainer.classList.add('label-container');
  labelContainer.dataset.labelId = labelName;

  // ラベル名
  const labelNameElement = document.createElement('div');
  labelNameElement.classList.add('label-name');
  labelNameElement.textContent = labelName;
  labelContainer.appendChild(labelNameElement);

  // 削除ボタン
  const deleteButton = document.createElement('button');
  deleteButton.classList.add('label-delete-button');
  deleteButton.textContent = 'Label Delete';
  deleteButton.dataset.projectName = document.getElementById("projectLink").textContent.trim();
  deleteButton.dataset.labelName = labelName;
  deleteButton.addEventListener('click', handleLabelDeleteClick);
  labelContainer.appendChild(deleteButton);

  // 画像グリッド
  const imageGridInner = document.createElement('div');
  imageGridInner.classList.add('image-grid-inner');
  labelContainer.appendChild(imageGridInner);

  // アップロードボタン
  const uploadButton = document.createElement('button');
  uploadButton.classList.add('upload-button');
  uploadButton.textContent = '+';
  uploadButton.addEventListener('click', handleUploadButtonClick);
  labelContainer.appendChild(uploadButton);

  return labelContainer;
}

/**
 * 新しいラベルコンテナを生成する関数
 * @param {Array} labelList - ラベルリスト
 */
function createLabelContainers(labelList) {
  const imageGrid = document.getElementById('imageGrid');
  labelList.filter(label => label.isDirectory).forEach(label => {
    const newLabelContainer = createLabelContainer(label.name);
    imageGrid.appendChild(newLabelContainer);
  });
}

/**
 * プログレスバーを表示する関数
 * @returns {Promise<void>}
 */
async function displayProgress() {
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.createElement('div');
  progressBar.classList.add('progress-bar');
  progressContainer.appendChild(progressBar);

  const percentage = document.createElement('div');
  percentage.classList.add('percentage');
  progressBar.appendChild(percentage);
}

/**
 * プログレスバーを更新する関数
 * @param {number} progress - 進捗率
 */
function updateProgress(progress) {
  const progressBar = document.querySelector('.progress-bar');
  const percentage = document.querySelector('.percentage');
  const angle = progress * 3.6; 
  progressBar.style.backgroundImage = `conic-gradient(#68b7ff 0deg, #68b7ff ${angle}deg, transparent ${angle}deg, transparent 360deg)`; 
  percentage.textContent = `${progress}%`;
}

/**
 * 画像総数を更新する関数
 */
function updateImageCount() {
  const imageListTitle = document.querySelector('.image-list-title');
  const totalImages = document.querySelectorAll('.image-card').length;
  imageListTitle.textContent = `ALL (${totalImages} images)`;
}

/**
 * 各種ラベルの画像数を更新する関数
 * @param {string} labelName - ラベル名
 */
function updateLabelImageCount(labelName) {
  updateContentLabelImageCount(labelName);
  updateSidebarLabelImageCount(labelName);
}

/**
 * コンテンツ内のラベル画像数を更新する関数
 * @param {string} labelName - ラベル名
 */
function updateContentLabelImageCount(labelName) {
  const labelNameElement = document.querySelector(`.label-container[data-label-id="${labelName}"] .label-name`);
  if (labelNameElement) {
    const labelImages = document.querySelectorAll(`.image-card[data-label-name="${labelName}"]`).length;
    labelNameElement.textContent = `${labelName} (${labelImages} images)`;
  }
}

/**
 * サイドバー内のラベル画像数を更新する関数
 * @param {string} labelName - ラベル名
 */
function updateSidebarLabelImageCount(labelName) {
  const sidebarLabelElement = Array.from(document.querySelectorAll('#sidebarLabelList div:not(.image-count)')).find(element => element.textContent === labelName);
  if (sidebarLabelElement) {
    const sidebarImageCountElement = sidebarLabelElement.nextElementSibling; 
    const labelImages = document.querySelectorAll(`.image-card[data-label-name="${labelName}"]`).length;
    sidebarImageCountElement.textContent = `${labelImages} images`;
  }
}

/**
 * ラベルクリックイベントのハンドラー
 * @param {Event} event - クリックイベント
 */
function handleLabelClick(event) {
  const labelElement = event.target;
  const imageCard = labelElement.closest('.image-card'); 
  const existingLabelListContainer = document.querySelector('.label-list-container');

  if (existingLabelListContainer && existingLabelListContainer.parentNode !== labelElement.parentNode) {
    existingLabelListContainer.remove();
  }

  const currentLabelListContainer = labelElement.parentNode.querySelector('.label-list-container');
  if (currentLabelListContainer) {
    currentLabelListContainer.remove();
    return;
  }

  const labelListContainer = document.createElement('div');
  labelListContainer.classList.add('label-list-container');
  const currentLabel = labelElement.textContent;
  const projectName = document.getElementById("projectLink").textContent.trim();
  const projectPath = `/projects/${projectName}/training-data`;

  fetch(`${API_BASE_URL}/directory?path=${projectPath}`)
    .then(response => response.json())
    .then(labelList => {
      labelList.filter(label => label.isDirectory && label.name !== currentLabel).forEach(label => {
        const labelItem = document.createElement('div');
        labelItem.classList.add('label-item');
        labelItem.textContent = label.name;
        labelItem.dataset.labelName = label.name;
        labelItem.addEventListener('click', handleLabelItemClick);
        labelListContainer.appendChild(labelItem);
      });

      const labelRect = labelElement.getBoundingClientRect();
      const imageGridInnerRect = imageCard.parentNode.getBoundingClientRect();
      labelListContainer.style.top = `${labelRect.bottom - imageGridInnerRect.top}px`;
      labelListContainer.style.left = `${labelRect.left - imageGridInnerRect.left}px`;
      imageCard.parentNode.appendChild(labelListContainer);

      // 外部クリックでラベルリストを閉じる
      document.addEventListener('click', (event) => {
        if (!labelListContainer.contains(event.target) && !labelElement.contains(event.target)) {
          labelListContainer.remove();
        }
      });
    })
    .catch(error => {
      console.error('ラベルの取得中にエラーが発生しました:', error);
    });
}

/**
 * ラベル項目クリックイベントのハンドラー
 * @param {Event} event - クリックイベント
 */
async function handleLabelItemClick(event) {
  const selectedImageCards = document.querySelectorAll('.image-card.selected');
  const targetLabel = event.target.dataset.labelName;
  const projectName = document.getElementById("projectLink").textContent.trim();

  try {
    await Promise.all(
      Array.from(selectedImageCards).map(async (imageCard) => {
        const { imageName, labelName: sourceLabel } = imageCard.dataset;
        if (sourceLabel !== targetLabel) {
          await moveImage(projectName, imageName, sourceLabel, targetLabel); 
          const labelSpan = imageCard.querySelector('.image-label');
          labelSpan.textContent = targetLabel;
          labelSpan.style.display = 'none';
          imageCard.dataset.labelName = targetLabel;

          const targetLabelContainer = document.querySelector(`.label-container[data-label-id="${targetLabel}"] .image-grid-inner`);
          targetLabelContainer.appendChild(imageCard);

          updateLabelImageCount(sourceLabel);
          updateLabelImageCount(targetLabel);
        }
      })
    );

    document.querySelector('.label-list-container')?.remove();
    socket.emit('moveImageComp'); 
  } catch (error) {
    handleError(error, '画像の移動に失敗しました');
  }
}

/**
 * "Upload" ボタンクリックイベントのハンドラー
 */
async function handleUploadFolderClick() {
  try {
    const directoryHandle = await window.showDirectoryPicker();
    const projectName = document.getElementById("projectLink").textContent.trim();
    const folderName = directoryHandle.name;

    const folderNameElement = document.createElement('div');
    folderNameElement.id = 'uploadedFolderName';
    folderNameElement.textContent = `Uploaded Folder: ${folderName}`;
    document.getElementById('uploadButtonContainer').appendChild(folderNameElement);

    const files = [];
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (file.size <= 1024 * 1024) { // 1MB
          const fileData = await file.arrayBuffer();
          files.push({ fileName: file.name, fileData });
        } else {
          console.error(`アップロードする画像は1MB未満にしてください (画像名: ${file.name})`);
        }
      }
    }

    socket.emit('uploadFolder', {
      projectName,
      originalFolderName: folderName,
      files
    });
  } catch (error) {
    handleError(error, 'フォルダのアップロードに失敗しました');
  }
}

/**
 * ラベル削除ボタンクリックイベントのハンドラー
 * @param {Event} event - クリックイベント
 */
async function handleLabelDeleteClick(event) {
  const { projectName, labelName } = event.target.dataset;
  const labelContainer = event.target.closest('.label-container');

  try {
    socket.emit('deleteLabel', { projectName, labelName });
    await new Promise((resolve, reject) => {
      socket.once('deleteLabelSuccess', (data) => {
        console.log(data.message);
        labelContainer.remove();
        resolve();
      });

      socket.once('deleteLabelError', (data) => {
        handleError(data.error, data.details);
        reject(new Error(data.error));
      });
    });
  } catch (error) {
    handleError(error, 'ラベルの削除に失敗しました');
  }
}

/**
 * DELETEボタンクリックイベントのハンドラー
 * @param {Event} event - クリックイベント
 */
async function handleDeleteButtonClick(event) {
  const projectName = document.getElementById("projectLink").textContent.trim();
  const selectedImageCards = document.querySelectorAll('.image-card.selected');

  try {
    await Promise.all(
      Array.from(selectedImageCards).map(async (imageCard) => {
        const { imageName, labelName } = imageCard.dataset;
        socket.emit('deleteImage', { projectName, imageName, labelName });

        await new Promise((resolve, reject) => {
          socket.once('deleteImageSuccess', (data) => {
            console.log(data.message);
            imageCard.remove();
            updateLabelImageCount(labelName);
            resolve();
          });

          socket.once('deleteImageError', (data) => {
            handleError(data.error, data.details);
            reject(new Error(data.error));
          });
        });
      })
    );
    socket.emit('deleteImageComp'); 
  } catch (error) {
    handleError(error, '画像の削除に失敗しました');
  }
}

/**
 * ラベル追加フォームの表示/非表示切替関数
 */
function toggleAddLabelForm() {
  const addLabelForm = document.querySelector('.add-label-form');
  toggleElementDisplay(addLabelForm);
}

/**
 * "Train" ボタンクリックイベントのハンドラー
 */
function handleTrainStartClick() {
  const projectName = document.getElementById("projectLink").textContent.trim();
  const trainStartIcon = document.getElementById('trainStartIcon');
  trainStartIcon.textContent = '▶';
  socket.emit('yourBeginLearnMsg', { projectName });
}

/**
 * 新しいラベル作成関数
 */
async function createNewLabel() {
  const newLabelName = document.getElementById('newLabelName').value.trim();
  if (!newLabelName) {
    alert('ラベル名を入力してください');
    return;
  }

  const projectName = document.getElementById("projectLink").textContent.trim();

  try {
    socket.emit('createLabel', { projectName, labelName: newLabelName });
    await new Promise((resolve, reject) => {
      socket.once('createLabelSuccess', (data) => {
        console.log(data.message);
        const newLabelContainer = createLabelContainer(newLabelName);
        document.getElementById('imageGrid').appendChild(newLabelContainer);
        document.getElementById('newLabelName').value = '';
        resolve();
      });

      socket.once('createLabelError', (data) => {
        handleError(data.error, data.details);
        reject(new Error(data.error));
      });
    });
  } catch (error) {
    handleError(error, 'ラベルの作成に失敗しました');
  }
}

/**
 * アップロードボタンクリック処理のハンドラー
 * @param {Event} event - クリックイベント
 */
function handleUploadButtonClick(event) {
  const projectName = document.getElementById("projectLink").textContent.trim();
  const labelName = event.target.closest('.label-container').dataset.labelId;
  const targetDirectory = `/projects/${projectName}/${labelName}`;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', (e) => uploadImages(e.target.files, targetDirectory));
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

/**
 * サイドバーラベル表示関数
 * @param {Array} labelList - ラベルリスト
 */
function displaySidebarLabelList(labelList) {
  const sidebarLabelList = document.getElementById('sidebarLabelList');
  sidebarLabelList.innerHTML = '';

  // All ラベル
  const allLabel = document.createElement('div');
  allLabel.textContent = 'All';
  allLabel.classList.add('active-click');
  const allImageCount = document.createElement('div');
  allImageCount.textContent = `${document.querySelectorAll('.image-card').length} images`;
  allImageCount.classList.add('image-count');
  sidebarLabelList.appendChild(allLabel);
  sidebarLabelList.appendChild(allImageCount);

  allLabel.addEventListener('click', () => {
    document.querySelectorAll('.label-container').forEach(container => container.style.display = 'block');
    sidebarLabelList.querySelectorAll('div:not(.image-count)').forEach(label => label.classList.remove('active-click'));
    allLabel.classList.add('active-click');
    document.querySelector('.image-list-header').style.display = 'block';
    updateActiveLabel();
  });

  // 各ラベルの表示
  labelList.filter(label => label.isDirectory).forEach(label => {
    const labelElement = document.createElement('div');
    labelElement.textContent = label.name;
    const imageCount = document.createElement('div');
    imageCount.textContent = `${document.querySelectorAll(`.image-card[data-label-name="${label.name}"]`).length} images`;
    imageCount.classList.add('image-count');
    sidebarLabelList.appendChild(labelElement);
    sidebarLabelList.appendChild(imageCount);

    labelElement.addEventListener('click', () => {
      document.querySelectorAll('.label-container').forEach(container => {
        container.style.display = container.dataset.labelId === label.name ? 'block' : 'none'; 
      });
      sidebarLabelList.querySelectorAll('div:not(.image-count)').forEach(lbl => lbl.classList.remove('active-click'));
      labelElement.classList.add('active-click');
      updateActiveLabel();
    });
  });
}

/**
 * アクティブラベル更新関数
 */
function updateActiveLabel() {
  const labelContainers = document.querySelectorAll('.label-container');
  const sidebarLabelList = document.getElementById('sidebarLabelList');
  const sidebarLabels = sidebarLabelList.querySelectorAll('div:not(.image-count)');
  sidebarLabels.forEach(label => label.classList.remove('active-scroll'));

  if (window.scrollY === 0 && sidebarLabels[0].classList.contains('active-click')) { 
    sidebarLabels[0].classList.add('active-scroll');
    return;
  }

  let activeLabel = null;
  for (const container of labelContainers) {
    const rect = container.getBoundingClientRect();
    if (rect.top <= 250 && rect.bottom > 250) {
      activeLabel = container.dataset.labelId;
      break;
    }
  }

  if (activeLabel) {
    const activeSidebarLabel = Array.from(sidebarLabels).find(label => label.textContent === activeLabel);
    activeSidebarLabel?.classList.add('active-scroll');
  }
}

/**
 * イベントリスナー設定関数
 */
function setupEventListeners() {
  // アップロードボタン
  document.querySelectorAll('.upload-button').forEach(button => button.addEventListener('click', handleUploadButtonClick));
  
  // 画像ラベルクリック
  document.querySelectorAll('.image-label').forEach(label => label.addEventListener('click', handleLabelClick));
  
  // ラベル項目クリック
  document.querySelectorAll('.label-item').forEach(labelItem => labelItem.addEventListener('click', handleLabelItemClick));
  
  // 画像削除ボタン
  document.querySelectorAll('.delete-button').forEach(button => button.addEventListener('click', handleDeleteButtonClick));
  
  // ラベル削除ボタン
  document.querySelectorAll('.label-delete-button').forEach(button => button.addEventListener('click', handleLabelDeleteClick));
  
  // ラベル追加ボタン
  document.getElementById('addLabelButton').addEventListener('click', toggleAddLabelForm);
  
  // トレーニング開始ボタン
  document.getElementById('LearnStartButton').addEventListener('click', handleTrainStartClick);
  
  // 新しいラベル作成ボタン
  document.getElementById('createNewLabelButton').addEventListener('click', createNewLabel);

  // ハンバーガーメニュークリック
  const hamburgerMenu = document.getElementById('hamburgerMenu');
  const menu = document.getElementById('menu');
  hamburgerMenu.addEventListener('click', () => toggleElementDisplay(menu));

  // ホームリンククリック
  document.getElementById('homeLink').addEventListener('click', () => {
    window.location.href = '/';
  });
}

// ==============================
// 5. 画像アップロード
// ==============================

/**
 * 画像アップロード処理
 * @param {FileList} files - アップロードするファイルリスト
 * @param {string} targetDirectory - アップロード先のディレクトリ
 */
async function uploadImages(files, targetDirectory) {
  const [_, projectName, labelName] = targetDirectory.split('/');
  const uploadPromises = [];

  for (const file of files) {
    if (file.size > 1024 * 1024) {
      console.error(`アップロードする画像は1MB未満にしてください (画像名: ${file.name})`);
      continue;
    }
    try {
      const fileData = await file.arrayBuffer();
      uploadPromises.push(socket.emit('upload', {
        projectName,
        labelName,
        fileData,
        fileName: file.name,
      }));
    } catch (error) {
      handleError(error, '画像のアップロード中にエラーが発生しました');
    }
  }

  await Promise.all(uploadPromises);
  socket.emit('uploadComp'); 
}

/**
 * 画像を移動する関数
 * @param {string} projectName - プロジェクト名
 * @param {string} imageName - 画像名
 * @param {string} sourceLabel - 元のラベル
 * @param {string} targetLabel - 移動先のラベル
 * @returns {Promise<void>}
 */
async function moveImage(projectName, imageName, sourceLabel, targetLabel) {
  socket.emit('moveImage', { projectName, imageName, sourceLabel, targetLabel });

  return new Promise((resolve, reject) => {
    socket.once('moveImageSuccess', (data) => {
      console.log(data.message);
      resolve();
    });

    socket.once('moveImageError', (data) => {
      handleError(data.error, data.details);
      reject(new Error(data.error));
    });
  });
}

// ==============================
// 6. 初期化
// ==============================

/**
 * 初期化関数
 */
async function init() {
  await setupUI();
  socket = io(API_BASE_URL);
  console.log('サーバーに接続しました');

  // ソケットイベントリスナー設定
  socket.on('uploadSuccess', (data) => console.log(data.message, data.fileName));
  socket.on('uploadError', (data) => handleError(data.error, data.details));
  socket.on('updateProgress', (progress) => updateProgress(progress));
  socket.on('learnCompleted', (data) => {
    console.log(data.message);
    alert(data.message);
    document.getElementById('trainStartIcon').textContent = '▷'; 
  });
  socket.on('learnError', (data) => handleError(data.error, data.details));
  socket.on('verificationResult', (data) => {
    const { projectName, folderName, result } = data;
    console.log('検証結果:', result); 
    displayVerificationResult(projectName, folderName, result);
  });
  socket.on('image-data-changed', async () => {
    updateImageCount();
    await displayEachLabelImages();
    const projectName = document.getElementById("projectLink").textContent.trim();
    displaySidebarLabelList(await fetchLabelList(projectName));
    updateActiveLabel();
  });
}

// DOMContentLoadedイベントリスナー設定
document.addEventListener('DOMContentLoaded', init);

// ==============================
// UI 初期設定
// ==============================

/**
 * UI 初期設定関数
 * @returns {Promise<void>}
 */
async function setupUI() {
  setupEventListeners();
  setupImageHoverEvents();
  await displayEachLabelImages();
  setupSidebarLabelToggle();
  setupSidebarCheckToggle();
  const projectName = document.getElementById("projectLink").textContent.trim();
  displaySidebarLabelList(await fetchLabelList(projectName));
  window.addEventListener('scroll', updateActiveLabel);
  updateActiveLabel(); 

  // サイドバー初期状態設定
  document.getElementById('sidebarLabel').classList.add('active');
  document.getElementById('imageList').style.display = 'block';

  await displayProgress(); 
}

// ==============================
// 画像のホバーイベント
// ==============================

/**
 * 画像のホバーイベント設定関数
 */
function setupImageHoverEvents() {
  const imageGrid = document.getElementById('imageGrid');
  if (!imageGrid) return;

  const selectedImages = new Set();

  // マウスオーバー時の処理
  imageGrid.addEventListener('mouseover', (event) => {
    const imageCard = event.target.closest('.image-card');
    if (imageCard) {
      imageCard.querySelector('.image-name').style.display = 'block';
      if (imageCard.classList.contains('selected')) {
        imageCard.querySelector('.delete-button').style.display = 'block';
      }
    }
  });

  // マウスアウト時の処理
  imageGrid.addEventListener('mouseout', (event) => {
    const imageCard = event.target.closest('.image-card');
    if (imageCard) {
      imageCard.querySelector('.image-name').style.display = 'none';
      imageCard.querySelector('.delete-button').style.display = 'none';
    }
  });

  // クリック時の処理
  imageGrid.addEventListener('click', (event) => {
    if (event.target.classList.contains('image-label')) {
      event.stopPropagation();
      return;
    }

    const imageCard = event.target.closest('.image-card');
    if (!imageCard) return;

    const imageName = imageCard.dataset.imageName;
    const deleteButton = imageCard.querySelector('.delete-button');
    const labelSpan = imageCard.querySelector('.image-label');

    if (event.ctrlKey) {
      // Ctrlキー押下時の選択・解除
      if (selectedImages.has(imageName)) {
        selectedImages.delete(imageName);
        imageCard.classList.remove('selected');
        deleteButton.style.display = 'none';
        labelSpan.style.display = 'none';
      } else {
        selectedImages.add(imageName);
        imageCard.classList.add('selected');
        deleteButton.style.display = 'block';
        labelSpan.style.display = 'block';
      }
    } else {
      // 通常クリック時の単一選択
      selectedImages.clear();
      document.querySelectorAll('.image-card').forEach(card => {
        card.classList.remove('selected');
        card.querySelector('.delete-button').style.display = 'none';
        card.querySelector('.image-label').style.display = 'none';
      });
      selectedImages.add(imageName);
      imageCard.classList.add('selected');
      deleteButton.style.display = 'block';
      labelSpan.style.display = 'block';
    }

    console.log('選択された画像:', Array.from(selectedImages));
  });

  // Escapeキー押下時の選択解除
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selectedImages.size > 0) {
      selectedImages.forEach(imageName => {
        const imageCard = document.querySelector(`.image-card[data-image-name="${imageName}"]`);
        if (imageCard) {
          imageCard.classList.remove('selected');
          imageCard.querySelector('.delete-button').style.display = 'none';
          imageCard.querySelector('.image-label').style.display = 'none';
        }
      });
      selectedImages.clear();
    }
  });

  // 右クリックメニューの無効化と画像拡大表示
  imageGrid.addEventListener('contextmenu', (event) => {
    const imageCard = event.target.closest('.image-card');
    if (imageCard) {
      event.preventDefault();
      const projectName = document.getElementById("projectLink").textContent.trim();
      const labelName = imageCard.dataset.labelName;
      const imageName = imageCard.dataset.imageName;
      const imageSrc = `http://localhost:3000/images?path=/projects/${projectName}/training-data/${labelName}/${encodeURIComponent(imageName)}`;
      enlargeImage(imageSrc);
    }
  });

  // 画像外クリック時の選択解除
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.image-card')) {
      selectedImages.forEach(imageName => {
        const imageCard = document.querySelector(`.image-card[data-image-name="${imageName}"]`);
        if (imageCard) {
          imageCard.classList.remove('selected');
          imageCard.querySelector('.delete-button').style.display = 'none';
          imageCard.querySelector('.image-label').style.display = 'none';
        }
      });
      selectedImages.clear();
    }
  });
}

// ==============================
// 画像拡大表示
// ==============================

/**
 * 画像を拡大表示する関数
 * @param {string} imageSrc - 画像のソースURL
 */
async function enlargeImage(imageSrc) {
  let imageContainer = document.querySelector('.enlarged-image-container');

  if (!imageContainer) {
    // 拡大画像コンテナが存在しない場合、新規作成
    imageContainer = document.createElement('div');
    imageContainer.classList.add('enlarged-image-container');

    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.classList.add('close-button');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => imageContainer.remove());
    imageContainer.appendChild(closeButton);

    // 画像プレースホルダー
    const imagePlaceholder = document.createElement('div');
    imagePlaceholder.classList.add('enlarged-image-placeholder');
    imagePlaceholder.style.backgroundRepeat = 'no-repeat';
    imagePlaceholder.style.backgroundSize = 'contain';
    imageContainer.appendChild(imagePlaceholder);

    document.body.appendChild(imageContainer);
  } else {
    // 既存のプレースホルダーをリセット
    const imagePlaceholder = imageContainer.querySelector('.enlarged-image-placeholder');
    imagePlaceholder.style.backgroundImage = '';
  }

  try {
    const imagePlaceholder = imageContainer.querySelector('.enlarged-image-placeholder');
    await lazyLoadImage(imageSrc, 1.0, imagePlaceholder);
  } catch (error) {
    handleError(error, "画像の取得に失敗しました。");
    imageContainer.querySelector('.enlarged-image-placeholder').dispatchEvent(new CustomEvent('loadingComplete'));
  } 
}

// ==============================
// サイドバートグル
// ==============================

/**
 * サイドバーラベルのトグル設定関数
 */
function setupSidebarLabelToggle() {
  const sidebarLabel = document.getElementById('sidebarLabel');
  const sidebarLabelList = document.getElementById('sidebarLabelList');
  const labelToggleIcon = document.getElementById('labelToggleIcon');
  const imageList = document.getElementById('imageList');
  const sidebarCheck = document.getElementById('sidebarCheck');

  sidebarLabel.addEventListener('click', () => {
    toggleElementDisplay(sidebarLabelList);
    labelToggleIcon.textContent = sidebarLabelList.style.display === 'block' ? '︿' : '﹀';
    sidebarLabel.classList.add('active');
    sidebarCheck.classList.remove('active');
    document.getElementById('sidebarCheckList').style.display = 'none'; 
    document.getElementById('checkContent').style.display = 'none';
    imageList.style.display = sidebarLabel.classList.contains('active') ? 'block' : 'none';
    document.querySelector('.add-label-container').style.display = sidebarLabel.classList.contains('active') ? 'block' : 'none';
  });
}

/**
 * サイドバーのチェックトグル設定関数
 */
function setupSidebarCheckToggle() {
  const sidebarCheck = document.getElementById('sidebarCheck');
  const sidebarCheckList = document.getElementById('sidebarCheckList');
  const imageList = document.getElementById('imageList');
  const checkContent = document.getElementById('checkContent');
  const sidebarLabel = document.getElementById('sidebarLabel');

  const uploadButtonContainer = document.getElementById('uploadButtonContainer');
  const uploadButton = document.createElement('button');
  uploadButton.textContent = 'Upload';
  uploadButton.addEventListener('click', handleUploadFolderClick);
  uploadButtonContainer.appendChild(uploadButton);

  const uploadedFolderList = document.createElement('div');
  uploadedFolderList.id = 'uploadedFolderList';
  uploadButtonContainer.appendChild(uploadedFolderList);

  sidebarCheck.addEventListener('click', async () => {
    if (sidebarCheck.classList.contains('active')) return; 

    toggleElementDisplay(sidebarCheckList);
    sidebarCheck.classList.toggle('active');

    if (sidebarCheckList.style.display === 'block') {
      imageList.style.display = 'none';
      checkContent.style.display = 'block';
      uploadButton.style.display = 'block'; 
      await displayUploadedFolderNames();
    } else {
      imageList.style.display = 'block';
      checkContent.style.display = 'none';
      uploadButton.style.display = 'none'; 
    }

    sidebarLabel.classList.remove('active');
    document.getElementById('sidebarLabelList').style.display = 'none'; 
    document.getElementById('labelToggleIcon').textContent = '﹀';
  });
}

// ==============================
// アップロード済みフォルダ名表示
// ==============================

/**
 * アップロード済みフォルダ名を表示する関数
 */
async function displayUploadedFolderNames() {
  const projectName = document.getElementById("projectLink").textContent.trim();
  const uploadedFolderList = document.getElementById('uploadedFolderList');
  uploadedFolderList.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE_URL}/directory?path=projects/${projectName}/verify-data`);
    const folderList = await response.json();

    await Promise.all(
      folderList.filter(folder => folder.isDirectory).map(async (folder) => {
        const folderContainer = document.createElement('div');
        folderContainer.classList.add('uploaded-folder-container');

        const folderNameContainer = document.createElement('div'); 
        const folderIcon = document.createElement('span');
        folderIcon.classList.add('folder-icon');
        folderIcon.textContent = '📁';
        folderNameContainer.appendChild(folderIcon);

        const folderNameElement = document.createElement('div');
        folderNameElement.textContent = folder.name;
        folderNameContainer.appendChild(folderNameElement); 
        folderContainer.appendChild(folderNameContainer);

        const verifyButton = document.createElement('button');
        verifyButton.textContent = 'Verify';
        verifyButton.dataset.folderName = folder.name;
        verifyButton.addEventListener('click', handleVerifyButtonClick);
        folderNameContainer.appendChild(verifyButton);

        const uploadedImagesContainer = document.createElement('div'); 
        uploadedImagesContainer.classList.add('uploaded-images-container'); 
        await displayUploadedImages(projectName, folder.name, uploadedImagesContainer); 
        folderContainer.appendChild(uploadedImagesContainer);

        uploadedFolderList.appendChild(folderContainer);
      })
    );
  } catch (error) {
    handleError(error, 'フォルダ一覧の取得に失敗しました。');
  }
}

/**
 * "Verify" ボタンクリックイベントのハンドラー
 * @param {Event} event - クリックイベント
 */
async function handleVerifyButtonClick(event) {
  const projectName = document.getElementById("projectLink").textContent.trim();
  const folderName = event.target.dataset.folderName;
  socket.emit('startVerification', { projectName, folderName });
}

/**
 * アップロード済みフォルダ内の画像を表示する関数
 * @param {string} projectName - プロジェクト名
 * @param {string} folderName - フォルダ名
 * @param {HTMLElement} container - 画像を表示するコンテナ
 */
async function displayUploadedImages(projectName, folderName, container) {
  try {
    const response = await fetch(`${API_BASE_URL}/directory?path=projects/${projectName}/verify-data/${folderName}`);
    const imageList = await response.json();

    for (const image of imageList) {
      if (!image.isDirectory) {
        const imageCard = createImageCard(projectName, folderName, image.name);
        const imageSrc = `/projects/${projectName}/verify-data/${folderName}/${encodeURIComponent(image.name)}`;
        lazyLoadImage(imageSrc, imageScale, imageCard.querySelector('.image-placeholder')).catch(() => {});
        imageCard.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          enlargeImage(imageSrc);
        });
        container.appendChild(imageCard);
      }
    }
  } catch (error) {
    handleError(error, '画像一覧の取得に失敗しました。');
  }
}

/**
 * 画像カードを作成する関数
 * @param {string} projectName - プロジェクト名
 * @param {string} folderName - フォルダ名
 * @param {string} imageName - 画像名
 * @returns {HTMLElement} - 作成した画像カード
 */
function createImageCard(projectName, folderName, imageName) {
  const imageCard = document.createElement('div');
  imageCard.classList.add('uploaded-image-card');
  imageCard.dataset.imageName = imageName;

  const imagePlaceholder = document.createElement('div');
  imagePlaceholder.classList.add('image-placeholder');
  imageCard.appendChild(imagePlaceholder);

  const imageSrc = `/projects/${projectName}/verify-data/${folderName}/${encodeURIComponent(imageName)}`;
  imagePlaceholder.style.backgroundImage = `url("${imageSrc}")`;

  const imageNameSpan = document.createElement('span');
  imageNameSpan.classList.add('image-name');
  imageNameSpan.style.display = 'none';
  imageCard.appendChild(imageNameSpan);

  // マウスオーバー時の処理
  imageCard.addEventListener('mouseover', () => {
    imageNameSpan.textContent = imageName;
    imageNameSpan.style.display = 'block';
    imageCard.classList.add('hovered'); 
  });

  // マウスアウト時の処理
  imageCard.addEventListener('mouseout', () => {
    imageNameSpan.style.display = 'none';
    imageCard.classList.remove('hovered'); 
  });

  const confidenceSpan = document.createElement('span');
  confidenceSpan.classList.add('confidence');
  imageCard.appendChild(confidenceSpan); 

  const labelConfidenceContainer = document.createElement('div');
  labelConfidenceContainer.classList.add('label-confidence-container');
  labelConfidenceContainer.style.overflowY = 'auto';
  labelConfidenceContainer.style.maxHeight = '80px';
  imageCard.appendChild(labelConfidenceContainer);

  // 右クリックメニューの無効化と画像拡大表示
  imageCard.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    enlargeImage(imageSrc);
  });

  return imageCard;
}

/**
 * 検証結果を表示する関数
 * @param {string} projectName - プロジェクト名
 * @param {string} folderName - フォルダ名
 * @param {Object} result - 検証結果
 */
async function displayVerificationResult(projectName, folderName, result) {
  const uploadedFolderList = document.getElementById('uploadedFolderList');
  const folderContainer = Array.from(uploadedFolderList.querySelectorAll('.uploaded-folder-container')).find(container => container.textContent.includes(folderName));
  const uploadedImagesContainer = folderContainer.querySelector('.uploaded-images-container');
  uploadedImagesContainer.innerHTML = '';
  uploadedImagesContainer.classList.add('verification-result');

  const predictedLabel = document.createElement('div');
  predictedLabel.textContent = 'Predicted:';
  predictedLabel.classList.add('predicted-label');
  uploadedImagesContainer.appendChild(predictedLabel);

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imageCard = entry.target;
        const imageSrc = `/projects/${projectName}/verify-data/${folderName}/${encodeURIComponent(imageCard.dataset.imageName)}`;
        lazyLoadImage(imageSrc, imageScale, imageCard.querySelector('.image-placeholder')).catch(() => {});
        observer.unobserve(imageCard);
      }
    });
  });

  result.classes.forEach((label, index) => {
    const labelGroup = document.createElement('div');
    labelGroup.classList.add('result-label-group');
    labelGroup.dataset.labelName = label;

    const labelNameElement = document.createElement('div');
    labelNameElement.classList.add('result-label-name');
    labelNameElement.textContent = label;
    labelGroup.appendChild(labelNameElement);

    const imagesContainer = document.createElement('div');
    imagesContainer.classList.add('result-images-container');
    imagesContainer.style.display = 'flex';
    imagesContainer.style.flexWrap = 'wrap';

    result.images.forEach(image => {
      const maxConfidenceIndex = image.confidence.indexOf(Math.max(...image.confidence));
      if (maxConfidenceIndex === index) {
        const imageCard = createImageCard(projectName, folderName, image.name);
        observer.observe(imageCard);
        imageCard.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          const imageSrc = `/projects/${projectName}/verify-data/${folderName}/${encodeURIComponent(image.name)}`;
          enlargeImage(imageSrc);
        });

        const confidenceSpan = imageCard.querySelector('.confidence');
        confidenceSpan.textContent = `${(image.confidence[maxConfidenceIndex] * 100).toFixed(1)}%`; 

        const labelConfidenceContainer = imageCard.querySelector('.label-confidence-container');
        result.classes.forEach((lbl, i) => {
          const labelConfidence = document.createElement('div');
          labelConfidence.classList.add('label-confidence');
          labelConfidence.textContent = `${(image.confidence[i] * 100).toFixed(1)}% ${lbl}`;
          labelConfidenceContainer.appendChild(labelConfidence);
        });

        imagesContainer.appendChild(imageCard);
      }
    });

    labelGroup.appendChild(imagesContainer);
    labelNameElement.textContent = `${label} (${imagesContainer.querySelectorAll('.uploaded-image-card').length} images)`;
    uploadedImagesContainer.appendChild(labelGroup);
  });
}