class ImageConverter {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.files = [];
        this.dominantColors = [];
    }

    initElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.previewArea = document.getElementById('previewArea');
        this.convertBtn = document.getElementById('convertBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.progressBar = document.getElementById('progressBar');
        this.colorPicker = document.getElementById('svgColor');
        this.autoColorCheckbox = document.getElementById('autoColor');
        this.statusMessage = document.getElementById('statusMessage');
        this.brightnessSlider = document.getElementById('colorBrightness');
        this.saturationSlider = document.getElementById('colorSaturation');
    }

    bindEvents() {
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
        this.fileInput.addEventListener('change', () => {
            this.handleFiles(this.fileInput.files);
        });
        this.convertBtn.addEventListener('click', () => this.convertFiles());
        
        // 自动颜色选择切换
        this.autoColorCheckbox.addEventListener('change', () => {
            this.colorPicker.disabled = this.autoColorCheckbox.checked;
        });

        this.brightnessSlider.addEventListener('input', () => this.updateColorPreview());
        this.saturationSlider.addEventListener('input', () => this.updateColorPreview());
    }

    async handleFiles(fileList) {
        this.files = Array.from(fileList).filter(file => 
            ['image/png', 'image/jpeg', 'image/bmp'].includes(file.type)
        );

        this.previewArea.innerHTML = '';
        this.dominantColors = [];
        
        if (this.files.length === 0) {
            this.convertBtn.disabled = true;
            return;
        }
        
        this.showStatus('正在分析图片...');
        
        // 为每个文件创建预览并分析颜色
        for (const file of this.files) {
            await this.createPreviewWithColor(file);
        }
        
        this.convertBtn.disabled = false;
        this.downloadBtn.disabled = true;
        this.showStatus('');
    }

    async createPreviewWithColor(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            const preview = document.createElement('div');
            preview.className = 'preview-item';
            
            reader.onload = (e) => {
                try {
                    const img = new Image();
                    img.src = e.target.result;
                    
                    img.onload = () => {
                        try {
                            // 分析图片颜色
                            const color = this.analyzeImageColor(img);
                            this.dominantColors.push(color);
                            
                            preview.innerHTML = `
                                <img src="${e.target.result}" alt="${file.name}">
                                <p>${file.name}</p>
                                <div class="color-preview" style="background-color: ${color}"></div>
                            `;
                            
                            this.previewArea.appendChild(preview);
                            resolve();
                        } catch (error) {
                            console.error('图片分析错误:', error);
                            this.dominantColors.push('#3498db'); // 使用默认颜色
                            preview.innerHTML = `
                                <img src="${e.target.result}" alt="${file.name}">
                                <p>${file.name}</p>
                                <div class="color-preview" style="background-color: #3498db"></div>
                            `;
                            this.previewArea.appendChild(preview);
                            resolve();
                        }
                    };
                    
                    img.onerror = () => {
                        console.error('图片加载失败');
                        this.dominantColors.push('#3498db');
                        preview.innerHTML = `
                            <p>${file.name} (加载失败)</p>
                            <div class="color-preview" style="background-color: #3498db"></div>
                        `;
                        this.previewArea.appendChild(preview);
                        resolve();
                    };
                } catch (error) {
                    console.error('预览创建错误:', error);
                    resolve();
                }
            };
            
            reader.onerror = () => {
                console.error('文件读取失败');
                resolve();
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    analyzeImageColor(img) {
        try {
            // 创建一个canvas来分析图片颜色
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 使用适中的尺寸
            const size = Math.min(img.width, img.height, 100);
            canvas.width = size;
            canvas.height = size;
            
            // 绘制图片
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // 获取中心区域的颜色
            const centerX = Math.floor(canvas.width / 2);
            const centerY = Math.floor(canvas.height / 2);
            const radius = Math.floor(Math.min(canvas.width, canvas.height) / 4);
            
            let r = 0, g = 0, b = 0, count = 0;
            
            // 分析中心区域的颜色
            const imageData = ctx.getImageData(
                centerX - radius, 
                centerY - radius, 
                radius * 2, 
                radius * 2
            );
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // 跳过透明像素和接近白/黑的像素
                if (data[i + 3] < 128) continue;
                
                const pixelR = data[i];
                const pixelG = data[i + 1];
                const pixelB = data[i + 2];
                
                // 跳过接近白色的像素
                if (pixelR > 240 && pixelG > 240 && pixelB > 240) continue;
                
                // 跳过接近黑色的像素
                if (pixelR < 15 && pixelG < 15 && pixelB < 15) continue;
                
                r += pixelR;
                g += pixelG;
                b += pixelB;
                count++;
            }
            
            if (count === 0) {
                return '#3498db'; // 默认蓝色
            }
            
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            
            // 增强颜色饱和度
            const [h, s, l] = this.rgbToHsl(r, g, b);
            const [newR, newG, newB] = this.hslToRgb(h, Math.min(1, s * 1.2), l);
            
            // 转换为十六进制颜色
            return `#${Math.round(newR).toString(16).padStart(2, '0')}${
                Math.round(newG).toString(16).padStart(2, '0')}${
                Math.round(newB).toString(16).padStart(2, '0')}`;
        } catch (error) {
            console.error('颜色分析错误:', error);
            return '#3498db'; // 出错时返回默认颜色
        }
    }

    // 添加计算颜色饱和度的辅助方法
    calculateSaturation(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        
        // 避免除以零
        if (max === 0) return 0;
        
        return (max - min) / max;
    }

    async convertFiles() {
        try {
            this.convertBtn.disabled = true;
            this.progressBar.hidden = false;
            this.showStatus('正在转换...');

            const formData = new FormData();
            this.files.forEach((file, index) => {
                formData.append('images', file);
                
                // 添加每个文件的颜色信息
                if (this.autoColorCheckbox.checked && this.dominantColors[index]) {
                    // 应用颜色调整
                    const baseColor = this.dominantColors[index];
                    const adjustedColor = this.adjustColor(baseColor);
                    formData.append('colors', adjustedColor);
                } else {
                    formData.append('colors', this.colorPicker.value);
                }
            });
            
            // 添加自动颜色标志
            formData.append('autoColor', this.autoColorCheckbox.checked);

            const response = await fetch('/convert', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '转换失败');
            }

            const result = await response.json();
            this.handleConversionResult(result);
            this.showStatus('转换成功!');
        } catch (error) {
            this.showStatus(`转换失败: ${error.message}`, true);
            console.error('转换错误:', error);
        } finally {
            this.progressBar.hidden = true;
            this.convertBtn.disabled = false;
        }
    }

    handleConversionResult(result) {
        this.downloadBtn.disabled = false;
        this.downloadBtn.onclick = () => {
            result.svgUrls.forEach(url => {
                const link = document.createElement('a');
                link.href = url;
                link.download = url.split('/').pop();
                link.click();
            });
        };
    }
    
    showStatus(message, isError = false) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = 'status-message';
        if (isError) {
            this.statusMessage.classList.add('error');
        }
    }

    updateColorPreview() {
        if (!this.autoColorCheckbox.checked || this.dominantColors.length === 0) return;
        
        const previewItems = document.querySelectorAll('.preview-item');
        previewItems.forEach((item, index) => {
            if (index >= this.dominantColors.length) return;
            
            const baseColor = this.dominantColors[index];
            const adjustedColor = this.adjustColor(baseColor);
            
            const colorPreview = item.querySelector('.color-preview');
            if (colorPreview) {
                colorPreview.style.backgroundColor = adjustedColor;
            }
        });
    }

    adjustColor(hexColor) {
        try {
            // 确保颜色格式正确
            if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#') || hexColor.length !== 7) {
                console.warn('无效的颜色格式:', hexColor);
                return '#3498db'; // 返回默认颜色
            }
            
            // 解析十六进制颜色
            const r = parseInt(hexColor.slice(1, 3), 16);
            const g = parseInt(hexColor.slice(3, 5), 16);
            const b = parseInt(hexColor.slice(5, 7), 16);
            
            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                console.warn('颜色解析失败:', hexColor);
                return '#3498db';
            }
            
            // 转换为HSL
            const [h, s, l] = this.rgbToHsl(r, g, b);
            
            // 应用亮度和饱和度调整
            const brightnessAdjust = parseInt(this.brightnessSlider.value) / 100;
            const saturationAdjust = parseInt(this.saturationSlider.value) / 100;
            
            const newL = Math.max(0, Math.min(1, l + brightnessAdjust));
            const newS = Math.max(0, Math.min(1, s + saturationAdjust));
            
            // 转回RGB
            const [newR, newG, newB] = this.hslToRgb(h, newS, newL);
            
            // 转回十六进制
            return `#${Math.round(newR).toString(16).padStart(2, '0')}${
                Math.round(newG).toString(16).padStart(2, '0')}${
                Math.round(newB).toString(16).padStart(2, '0')}`;
        } catch (error) {
            console.error('颜色调整错误:', error);
            return hexColor || '#3498db'; // 出错时返回原始颜色或默认颜色
        }
    }

    // RGB转HSL辅助方法
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0; // 灰色
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            
            h /= 6;
        }
        
        return [h, s, l];
    }

    // HSL转RGB辅助方法
    hslToRgb(h, s, l) {
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l; // 灰色
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return [r * 255, g * 255, b * 255];
    }
}

new ImageConverter(); 