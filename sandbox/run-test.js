const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.log': 'text/plain',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png'
};

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        res.writeHead(404);
                        res.end('404 Not Found');
                    } else {
                        res.writeHead(500);
                        res.end('500 Internal Server Error');
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content);
                }
            });
        });

        server.listen(PORT, () => {
            console.log(`🖼️ Servidor corriendo en http://localhost:${PORT}`);
            resolve(server);
        });
    });
}

async function runTest() {
    const { chromium } = require('../audit/node_modules/playwright');

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('🖼️ TEST DE COMPRESIÓN DE IMÁGENES - ENOTE');
    console.log('═══════════════════════════════════════════════════════════\n');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const logOutput = [];
    let screenshotsTaken = false;

    page.on('console', msg => {
        const text = msg.text();
        logOutput.push(text);
        console.log(text);
    });

    try {
        console.log('📂 Cargando test...');
        await page.goto(`http://localhost:${PORT}`, { timeout: 10000 });
        await page.waitForTimeout(1500);

        console.log('▶ Ejecutando test de compresión...');
        await page.click('button:has-text("Ejecutar Test")');
        await page.waitForTimeout(4000);

        const imgOriginal = await page.$('#img-original');
        const img60 = await page.$('#img-60');
        const img40 = await page.$('#img-40');

        if (imgOriginal && img60 && img40) {
            screenshotsTaken = true;
        }

    } catch (error) {
        console.log('❌ Error ejecutando test:', error.message);
    } finally {
        await browser.close();
    }

    return logOutput;
}

async function main() {
    const server = await startServer();

    try {
        const logOutput = await runTest();

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📦 Generando resultados.log...\n');

        const logContent = logOutput.join('\n');
        fs.writeFileSync(path.join(ROOT_DIR, 'resultados.log'), logContent, 'utf8');

        console.log('✅ resultados.log creado');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        server.close();
        console.log('🔚 Servidor detenido');
    }
}

main();