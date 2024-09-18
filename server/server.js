const express = require('express');
const cors = require('cors');
const fs = require('fs-extra'); 
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 
const app = express();
const port = 3000;


const http = require('http'); // http モジュールを require
const server = http.createServer(app); // HTTP サーバーを作成
const io = require('socket.io')(server); // Socket.IO を初期化

const { learnTransferModel, validateImages } = require('./TFhelper'); // TFhelper.js から関数をインポート

const rootDir = path.join(__dirname,'../');

// uploadsディレクトリがなければ作成する
if (!fs.existsSync(rootDir)) {
  fs.mkdirSync(rootDir);
}

io.on('connection', (socket) => {
  console.log('クライアントが接続しました');

  // 画像アップロードイベント
  socket.on('upload', async (data) => {
  const { projectName, labelName, fileData, fileName } = data; 
  const uploadPath = path.join(rootDir, 'projects', projectName, 'training-data', labelName);

    try {
      // アップロード先ディレクトリが存在しない場合は作成
      await fs.ensureDir(uploadPath);

      // ファイル名を UUID に変更
      const fileExtension = path.extname(fileName); // 拡張子を取得
      const newFileName = `${uuidv4()}${fileExtension}`; 
      // ファイルを保存 (Blob データを直接保存)
      const filePath = path.join(uploadPath, newFileName);
      await fs.writeFile(filePath, fileData); 
      // 成功メッセージをクライアントに送信
      socket.emit('uploadSuccess', { message: 'ファイルアップロード成功', fileName: newFileName });
      }
    catch (err) {
      console.error('ファイルアップロードエラー:', err);
      socket.emit('uploadError', { error: 'ファイルアップロード失敗', details: err.message });
      }
  });
  
  socket.on('uploadComp',() => {
    // 画像データが変更されたことを通知
    io.emit('image-data-changed');
  })


   // 画像移動イベント
   socket.on('moveImage', async (data) => {
    const { projectName, imageName, sourceLabel, targetLabel } = data;

    // パスチェック
    const sourcePath = path.join(rootDir, 'projects', projectName,'training-data', sourceLabel, imageName);
    const targetPath = path.join(rootDir, 'projects', projectName,'training-data', targetLabel, imageName);

    try {
      // sourcePath のファイルが存在するかチェック
      if (!fs.existsSync(sourcePath)) {
        return socket.emit('moveImageError', { error: '画像が見つかりません' });
      }

      // targetPath のフォルダが存在するかチェック
      if (!fs.existsSync(path.dirname(targetPath))) {
        await fs.mkdir(path.dirname(targetPath));
      }

      // 画像を移動
      await fs.move(sourcePath, targetPath);

      // 成功メッセージをクライアントに送信
      socket.emit('moveImageSuccess', { message: '画像が移動されました' });
    } catch (err) {
      console.error('画像移動エラー:', err);
      socket.emit('moveImageError', { error: '画像の移動に失敗しました', details: err.message });
    }
  });

  // 画像移動完了イベント
  socket.on('moveImageComp', () => {
    // 画像データが変更されたことを通知
    io.emit('image-data-changed'); 
  });

   // 画像削除イベント
   socket.on('deleteImage', async (data) => {
    const { projectName, imageName, labelName } = data;

    // パスチェック
    const filePath = path.join(rootDir, 'projects', projectName,'training-data',labelName, imageName);

    try {
      // ファイルが存在するかチェック
      if (!fs.existsSync(filePath)) {
        return socket.emit('deleteImageError', { error: 'ファイルが見つかりません' });
      }

      // ファイルを削除
      await fs.unlink(filePath);

      // 成功メッセージをクライアントに送信
      socket.emit('deleteImageSuccess', { message: 'ファイル削除成功' });
    } catch (err) {
      console.error('ファイル削除エラー:', err);
      socket.emit('deleteImageError', { error: 'ファイル削除失敗', details: err.message });
    }
  });

  // 画像削除完了イベント
  socket.on('deleteImageComp', () => {
    // 画像データが変更されたことを通知
    io.emit('image-data-changed'); 
  });

  // プロジェクト作成イベント
  socket.on('createProject', async (projectName) => {
    const projectDir = path.join(rootDir, 'projects', projectName); // パスを変更

    try {
      await fs.mkdir(projectDir);
      await fs.mkdir(path.join(projectDir, 'training-data'));
      await fs.mkdir(path.join(projectDir, 'verify-data'));
      socket.emit('createProjectSuccess', { message: 'プロジェクトが作成されました' });

      // プロジェクトデータが変更されたことを通知
      io.emit('project-data-changed'); 
    } catch (err) {
      console.error('プロジェクト作成エラー:', err);
      socket.emit('createProjectError', { error: 'プロジェクトの作成に失敗しました', details: err.message });
    }
  });

  

  // ラベル作成イベント
  socket.on('createLabel', async (data) => {
    const { projectName, labelName } = data;

    // パスチェック
    const labelDir = path.join(rootDir, 'projects', projectName, 'training-data',labelName);

    try {
      // ラベル名が既に存在する場合はエラーを返す
      if (fs.existsSync(labelDir)) {
        return socket.emit('createLabelError', { error: 'ラベル名が既に存在します' });
      }

      // ラベルフォルダを作成
      await fs.mkdir(labelDir);

      // 成功メッセージをクライアントに送信
      socket.emit('createLabelSuccess', { message: 'ラベルが作成されました' });

      // 画像データが変更されたことを通知
      io.emit('image-data-changed');
    } catch (err) {
      console.error('ラベル作成エラー:', err);
      socket.emit('createLabelError', { error: 'ラベルの作成に失敗しました', details: err.message });
    }
  });

  // ラベル削除イベント
  socket.on('deleteLabel', async (data) => {
    const { projectName, labelName } = data;

    // パスチェック
    const labelDir = path.join(rootDir, 'projects', projectName, 'training-data',labelName);

    try {
      // フォルダが存在するかチェック
      if (!fs.existsSync(labelDir)) {
        return socket.emit('deleteLabelError', { error: 'ラベルが見つかりません' });
      }

      // ラベルフォルダを削除
      await fs.rm(labelDir, { recursive: true });

      // 成功メッセージをクライアントに送信
      socket.emit('deleteLabelSuccess', { message: 'ラベルが削除されました' });

      // 画像データが変更されたことを通知
      io.emit('image-data-changed');
    } catch (err) {
      console.error('ラベル削除エラー:', err);
      socket.emit('deleteLabelError', { error: 'ラベルの削除に失敗しました', details: err.message });
    }
  });

   // フォルダアップロードイベント
   socket.on('uploadFolder', async (data) => {
    const { projectName, originalFolderName, files } = data;
    let folderName = originalFolderName;
    let counter = 1;
    let uploadPath = path.join(rootDir, 'projects', projectName, 'verify-data', folderName); // パスを変更

    try {
      // アップロード先ディレクトリが存在する場合は、連番を付与してフォルダ名を作成
      while (fs.existsSync(uploadPath)) {
        folderName = `${originalFolderName}-${counter}`;
        uploadPath = path.join(rootDir, 'projects', projectName, 'verify-data', folderName);
        counter++;
      }

      // アップロード先ディレクトリを作成
      await fs.ensureDir(uploadPath);

      // 各ファイルを移動
      await Promise.all(
        files.map(async (file) => {
          const fileData = Buffer.from(new Uint8Array(file.fileData)); // ArrayBuffer から Buffer に変換
          const destination = path.join(uploadPath, file.fileName);
          await fs.writeFile(destination, fileData); // Blob データを直接保存
        })
      );

      // 成功メッセージをクライアントに送信
      socket.emit('uploadFolderSuccess', { message: 'フォルダのアップロードに成功しました。', folderName: folderName });
    } catch (err) {
      console.error('ファイルアップロードエラー:', err);
      socket.emit('uploadFolderError', { error: 'フォルダのアップロードに失敗しました。', details: err.message });
    }
  });


  // 学習開始イベント
  socket.on('yourBeginLearnMsg', async (data) => {

    const { projectName } = data;
    const projectPath = path.join(rootDir, 'projects', projectName, 'training-data');
    try {
      await learnTransferModel(projectPath, socket); 

      // 学習完了とモデル保存のメッセージをクライアントに送信
      socket.emit('learnCompleted', { message: '学習が完了し、モデルが保存されました。' });
    } catch (err) {
      console.error('学習エラー:', err);
      socket.emit('learnError', { error: '学習に失敗しました。', details: err.message });
    }
  });
  
  
  // 検証開始イベント
  socket.on('startVerification', async (data) => {
    const { projectName, folderName } = data;
    const verifyPath = path.join(rootDir, 'projects', projectName, 'verify-data', folderName); // 検証用画像フォルダのパス
    try {
      const result = await validateImages(verifyPath);
      // console.log('検証結果:', result); // コンソール出力は削除

      // 検証結果をクライアントに送信
      socket.emit('verificationResult', { projectName, folderName, result }); 
    } catch (err) {
      console.error('検証エラー:', err);
      socket.emit('verificationError', { error: '検証に失敗しました', details: err.message });
    }
  });
  
});

// CORSを許可するミドルウェアを追加
app.use(cors({
  origin: 'http://127.0.0.1:5500', // クライアント側のドメインを指定
  methods: ['GET', 'POST', 'DELETE', 'PUT'], // 許可するHTTPメソッドを指定
  allowedHeaders: ['Content-Type'], // 許可するHTTPヘッダーを指定
}));

// JSON Body Parsing Middlewareを追加
app.use(express.json()); 

// 画像ファイルを公開する
app.use('/uploads', express.static('C:/research_merged/projects'));

// 静的ファイルを公開する
app.use(express.static(path.join(rootDir, '/client/public'))); // 静的ファイルのルートパスを指定

// 静的ファイルを公開する
app.use('/projects', express.static(path.join(rootDir, 'projects'))); // projects ディレクトリ配下のファイルを配信


// EJSの設定
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname,'views')); // テンプレートファイルが置かれているディレクトリを指定 (serverディレクトリ内)

// ルートパスに対するリクエストを処理
app.get('/', async (req, res) => {
  try {
    // プロジェクト一覧をサーバーサイドで取得
    const projects = await fs.readdir(path.join(rootDir, 'projects'), { withFileTypes: true })
      .then(files => files.filter(file => file.isDirectory()).map(file => file.name));

    // index.ejsにプロジェクト一覧を渡してレンダリング
    res.render('index', { projects }); 
  } catch (err) {
    console.error('プロジェクト一覧取得エラー:', err);
    res.status(500).json({ error: 'プロジェクト一覧取得失敗' }); 
  }
});

// ディレクトリ一覧取得 API
app.get('/directory', async (req, res) => {
  const requestedPath = req.query.path;
  // パスチェック
  const directoryPath = requestedPath ? path.join(rootDir, requestedPath) : rootDir; 

  try {
    const files = await fs.readdir(directoryPath, { withFileTypes: true });

    // ディレクトリ内のファイルとフォルダの一覧を返す
    const directoryContent = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      // uploadsディレクトリを基準とした相対パスを返す
      path: path.relative(rootDir, path.join(directoryPath, file.name)) 
    }));

    res.json(directoryContent); 

  } catch (err) {
    console.error('ディレクトリ取得エラー:', err);
    res.status(500).json({ error: 'ディレクトリ取得失敗', details: err.message }); 
  }
});




// 画像を取得するAPIエンドポイント
app.get('/images', async (req, res) => {
  const imagePath = req.query.path ? path.join(rootDir, decodeURIComponent(req.query.path)) : null; // パスをデコード
  if (imagePath) {
    try {
      const imageData = await fs.readFile(imagePath);
      res.setHeader('Content-Type', 'image/jpeg'); // ファイルタイプに応じて適切なMIMEタイプを設定
      res.send(imageData);
    } catch (err) {
      console.error('画像取得エラー:', err);
      res.status(500).json({ error: '画像取得失敗' }); 
    }
  } else {
    res.status(404).send('画像が見つかりません');
  }
});


// 各プロジェクトページへのルーティング
app.get('/project/:projectName', async (req, res) => {
  const projectName = req.params.projectName;

  // プロジェクトの存在チェック
  const projectDir = path.join(rootDir, 'projects', projectName);
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' }); 
  }

  try {
    // プロジェクトフォルダのラベル情報を取得
    const labelList = await getLabelsForProject(projectName); // ラベル情報を取得する関数
    // プロジェクトフォルダの画像情報を取得
    const imageList = await getImagesForProject(projectName); // 画像情報を取得する関数

    // project.ejs にプロジェクト情報を渡してレンダリング
    res.render('project', { projectName, labels: labelList, images: imageList }); 
  } catch (err) {
    console.error('プロジェクト情報取得エラー:', err);
    res.status(500).json({ error: 'プロジェクト情報取得失敗', details: err.message }); 
  }
});

// ラベル情報を取得する関数
async function getLabelsForProject(projectName) {
  const projectDir = path.join(rootDir, 'projects', projectName,'training-data');

  try {
    const files = await fs.readdir(projectDir, { withFileTypes: true });
    const labels = files.filter(file => file.isDirectory()).map(file => ({
      name: file.name,
      // ここではラベルIDは仮で生成
      id: file.name,
      // ラベルごとの画像数をカウント
      count: fs.readdirSync(path.join(projectDir, file.name)).filter(f => !fs.lstatSync(path.join(projectDir, file.name, f)).isDirectory()).length 
    }));
    return labels;
  } catch (err) {
    console.error('ラベル情報取得エラー:', err);
    throw err; 
  }
}

// 画像情報を取得する関数
async function getImagesForProject(projectName) {
  const projectDir = path.join(rootDir, 'projects', projectName,'training-data');

  // フォルダの存在チェック
  if (!fs.existsSync(projectDir)) {
    return []; // フォルダが存在しない場合は空の配列を返す
  }

  try {
    // `flatMap` を使用して、画像情報を取得
    const images = await fs.readdir(projectDir)
      .then(labels => labels.filter(label => fs.lstatSync(path.join(projectDir, label)).isDirectory()))
      .then(labels => labels.flatMap(label => {
        const labelDir = path.join(projectDir, label);
        return fs.readdirSync(labelDir).map(file => ({ name: file, label: label }));
      }));

    return images;
  } catch (err) {
    console.error('画像情報取得エラー:', err);
    throw err; 
  }
}

server.listen(port, () => {
  console.log(`サーバーが起動しました: http://localhost:${port}`);
});