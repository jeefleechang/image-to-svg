const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { convertToSVG } = require('./converter');

const app = express();
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/bmp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式'));
        }
    }
});

// 确保目录存在
async function ensureDirectoriesExist() {
    const dirs = ['uploads', 'public/output'];
    
    for (const dir of dirs) {
        try {
            await fs.access(dir);
        } catch (error) {
            console.log(`创建目录: ${dir}`);
            await fs.mkdir(dir, { recursive: true });
        }
    }
}

// 启动时确保目录存在
ensureDirectoriesExist().catch(err => {
    console.error('创建目录失败:', err);
});

app.use(express.static(path.join(__dirname, '../../src/client')));
app.use('/output', express.static(path.join(__dirname, '../../public/output')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../src/client/index.html'));
});

app.post('/convert', upload.array('images'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new Error('没有上传文件');
        }

        console.log('收到文件:', req.files.map(f => f.path));
        
        // 获取颜色信息
        const colors = req.body.colors || [];
        const autoColor = req.body.autoColor === 'true';
        
        console.log('颜色设置:', { autoColor, colors });

        // 转换每个文件
        const results = await Promise.all(
            req.files.map((file, index) => {
                const color = Array.isArray(colors) ? colors[index] : colors;
                return convertToSVG(file.path, color, autoColor);
            })
        );

        console.log('转换完成:', results);

        res.json({
            success: true,
            svgUrls: results.map(r => r.url),
            originalColors: results.map(r => r.color)
        });
    } catch (error) {
        console.error('服务器错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

module.exports = app; 