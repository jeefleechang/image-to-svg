const sharp = require('sharp');
const potrace = require('potrace');
const path = require('path');
const fs = require('fs').promises;

async function convertToSVG(imagePath, userColor, autoColor = true) {
    try {
        console.log('开始转换图片:', imagePath);
        console.log('颜色设置:', { userColor, autoColor });

        // 确保输出目录存在
        const outputDir = path.join('public', 'output');
        try {
            await fs.access(outputDir);
        } catch (error) {
            console.log('创建输出目录:', outputDir);
            await fs.mkdir(outputDir, { recursive: true });
        }

        // 获取图片的主要颜色
        let dominantColor = userColor || '#000000';
        
        if (autoColor) {
            try {
                console.log('分析图片颜色...');
                const imageStats = await sharp(imagePath).stats();
                
                const { r, g, b } = imageStats.channels;
                dominantColor = `#${Math.round(r.mean).toString(16).padStart(2, '0')}${
                    Math.round(g.mean).toString(16).padStart(2, '0')}${
                    Math.round(b.mean).toString(16).padStart(2, '0')}`;
                
                console.log('检测到的主要颜色:', dominantColor);
            } catch (error) {
                console.error('颜色分析失败:', error);
                // 如果颜色分析失败，使用用户提供的颜色或默认颜色
            }
        } else {
            console.log('使用用户指定颜色:', dominantColor);
        }

        // 预处理图片
        const processedImagePath = imagePath + '-processed.png';
        console.log('预处理图片:', processedImagePath);
        
        await sharp(imagePath)
            .png()
            .toFile(processedImagePath);

        // 使用potrace转换为SVG
        const params = {
            threshold: 128,
            turdSize: 2,
            turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
            optCurve: true,
            optTolerance: 0.2,
            color: dominantColor
        };

        return new Promise((resolve, reject) => {
            console.log('开始Potrace转换');
            potrace.trace(processedImagePath, params, async (err, svg) => {
                try {
                    if (err) {
                        console.error('Potrace转换错误:', err);
                        reject(err);
                        return;
                    }

                    console.log('Potrace转换完成');

                    // 保存SVG文件
                    const svgPath = path.join('public', 'output', path.basename(imagePath) + '.svg');
                    console.log('保存SVG文件:', svgPath);
                    
                    // 在SVG中添加原始颜色信息
                    const svgWithColor = svg.replace('<svg', `<svg data-original-color="${dominantColor}"`);
                    await fs.writeFile(svgPath, svgWithColor);

                    // 清理临时文件
                    console.log('清理临时文件');
                    await fs.unlink(imagePath).catch(err => console.error('删除源文件失败:', err));
                    await fs.unlink(processedImagePath).catch(err => console.error('删除处理文件失败:', err));

                    resolve({
                        url: '/output/' + path.basename(svgPath),
                        color: dominantColor
                    });
                } catch (error) {
                    console.error('处理过程发生错误:', error);
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('转换过程发生错误:', error);
        throw new Error('转换失败: ' + error.message);
    }
}

module.exports = {
    convertToSVG
}; 