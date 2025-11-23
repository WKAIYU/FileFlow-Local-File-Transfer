const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// 配置multer用于文件上传，彻底解决中文文件名乱码问题
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 彻底解决中文文件名乱码问题
    let originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    // 解码可能的URL编码
    try {
      originalName = decodeURIComponent(originalName);
    } catch (e) {
      // 如果不是URL编码，保持原样
    }
    
    // 清理文件名中的非法字符
    originalName = originalName.replace(/[<>:"/\\|?*]/g, '_');
    
    // 检查文件名是否已存在
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    let finalName = originalName;
    let counter = 1;
    
    // 如果文件已存在，添加数字后缀
    while (fs.existsSync(path.join('./uploads', finalName))) {
      finalName = `${baseName}(${counter})${ext}`;
      counter++;
    }
    
    console.log(`上传文件: ${originalName} -> ${finalName}`);
    cb(null, finalName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB限制
  },
  fileFilter: function (req, file, cb) {
    // 允许所有文件类型
    cb(null, true);
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'uploads')));

// 存储文件信息
let files = [];

// 根路径返回前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 获取文件列表
app.get('/api/files', (req, res) => {
  res.json(files);
});

// 上传文件
app.post('/api/upload', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '没有文件被上传' });
  }

  // 添加文件信息到列表
  req.files.forEach(file => {
    // 处理文件名显示 - 使用与存储时相同的逻辑
    let displayName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    try {
      displayName = decodeURIComponent(displayName);
    } catch (e) {
      // 保持原样
    }
    
    // 清理文件名中的非法字符
    displayName = displayName.replace(/[<>:"/\\|?*]/g, '_');
    
    files.push({
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: displayName, // 显示用文件名
      size: formatFileSize(file.size),
      uploadTime: new Date().toLocaleString(),
      filename: file.filename, // 存储的文件名
      path: `/downloads/${encodeURIComponent(file.filename)}` // 编码文件名用于下载
    });
  });

  res.json({ 
    message: `成功上传 ${req.files.length} 个文件`,
    files: files
  });
});

// 删除文件
app.delete('/api/file/:id', (req, res) => {
  const fileId = req.params.id;
  const fileIndex = files.findIndex(f => f.id === fileId);
  
  if (fileIndex === -1) {
    return res.status(404).json({ error: '文件未找到' });
  }
  
  const file = files[fileIndex];
  
  // 删除物理文件
  const filePath = path.join(__dirname, 'uploads', file.filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('删除文件失败:', err);
    }
  });
  
  // 从列表中移除
  files.splice(fileIndex, 1);
  
  res.json({ message: '文件已删除' });
});

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`🚀 文件传输服务器已启动!`);
  console.log(`📍 本地访问: http://localhost:${port}`);
  console.log(`🌐 局域网访问: http://你的IP地址:${port}`);
  console.log(`=================================`);
  console.log(`💡 提示: 其他设备需要连接到同一WiFi网络`);
});