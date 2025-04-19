const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public'); // 前端文件目录

const initDataFile = async () => {
    try {
        await fs.access(DATA_FILE);
        console.log('data.json 文件已存在');
    } catch (error) {
        console.log('data.json 文件不存在，正在创建...');
        const initialData = { users: [], course_completions: [] };
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
        console.log('data.json 文件创建成功');
    }
};

const server = http.createServer(async (req, res) => {
    console.log(`收到请求: ${req.method} ${req.url}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        console.log('处理 OPTIONS 请求');
        res.writeHead(204);
        res.end();
        return;
    }

    // 提供静态文件服务
    if (req.method === 'GET' && !req.url.startsWith('/register') && !req.url.startsWith('/complete-course') && !req.url.startsWith('/stats') && !req.url.startsWith('/user-completions')) {
        let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
        try {
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }
            const content = await fs.readFile(filePath);
            const ext = path.extname(filePath);
            const contentType = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            }[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
            return;
        } catch (error) {
            console.error('读取静态文件失败:', error.message);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
    }

    const readData = async () => {
        try {
            const rawData = await fs.readFile(DATA_FILE, 'utf8');
            return JSON.parse(rawData);
        } catch (error) {
            console.error('读取 data.json 失败:', error.message);
            throw error;
        }
    };

    const writeData = async (data) => {
        try {
            await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
            console.log('写入 data.json 成功');
        } catch (error) {
            console.error('写入 data.json 失败:', error.message);
            throw error;
        }
    };

    try {
        if (req.method === 'POST' && req.url === '/register') {
            console.log('处理 /register 请求');
            let body = '';
            req.on('data', chunk => {
                console.log('接收数据:', chunk.toString());
                body += chunk;
            });
            req.on('end', async () => {
                console.log('请求体（原始）:', body);
                let parsedBody;
                try {
                    parsedBody = JSON.parse(body);
                    console.log('请求体（解析后）:', parsedBody);
                } catch (error) {
                    console.error('解析请求体失败:', error.message);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '请求体格式错误' }));
                    return;
                }

                const { username, email } = parsedBody;
                if (!username || !email) {
                    console.log('用户名或邮箱为空');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '用户名和邮箱不能为空' }));
                    return;
                }

                const data = await readData();
                const userId = data.users.length + 1;
                const newUser = {
                    id: userId,
                    username,
                    email,
                    register_date: new Date().toISOString()
                };
                data.users.push(newUser);
                console.log('新用户:', newUser);
                await writeData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ user_id: userId }));
            });
        } else if (req.method === 'POST' && req.url === '/complete-course') {
            console.log('处理 /complete-course 请求');
            let body = '';
            req.on('data', chunk => {
                console.log('接收数据:', chunk.toString());
                body += chunk;
            });
            req.on('end', async () => {
                console.log('请求体:', body);
                let parsedBody;
                try {
                    parsedBody = JSON.parse(body);
                } catch (error) {
                    console.error('解析请求体失败:', error.message);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '请求体格式错误' }));
                    return;
                }

                const { user_id, course_id } = parsedBody;
                if (!user_id || !course_id) {
                    console.log('用户ID或课程ID为空');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '用户ID和课程ID不能为空' }));
                    return;
                }

                const data = await readData();
                const completion = {
                    user_id: parseInt(user_id),
                    course_id,
                    completion_date: new Date().toISOString()
                };
                data.course_completions.push(completion);
                console.log('新课程完成记录:', completion);
                await writeData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: '课程完成记录已添加' }));
            });
        } else if (req.method === 'GET' && req.url === '/stats') {
            console.log('处理 /stats 请求');
            const data = await readData();

            const totalUsers = data.users.length;
            const courseCompletions = {};
            data.course_completions.forEach(completion => {
                const courseId = completion.course_id;
                courseCompletions[courseId] = (courseCompletions[courseId] || 0) + 1;
            });

            const stats = {
                total_users: totalUsers,
                course_completions: Object.entries(courseCompletions).map(([course_id, completions]) => ({
                    course_id,
                    completions
                }))
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
        } else if (req.method === 'GET' && req.url.startsWith('/user-completions')) {
            console.log('处理 /user-completions 请求');
            console.log('请求 URL:', req.url);
            const url = new URL(req.url, `http://${req.headers.host}`);
            const user_id = url.searchParams.get('user_id');
            console.log('解析出的 user_id:', user_id);
            if (!user_id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '用户ID不能为空' }));
                return;
            }

            const data = await readData();
            console.log('当前 data.json 内容:', data);
            const userCompletions = data.course_completions.filter(completion => completion.user_id === parseInt(user_id));
            console.log('过滤出的 userCompletions:', userCompletions);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(userCompletions));
        } else {
            console.log('路由未找到');
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '路由未找到' }));
        }
    } catch (error) {
        console.error('服务器错误:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '服务器内部错误' }));
    }
});

const PORT = process.env.PORT || 3001;
initDataFile().then(() => {
    server.listen(PORT, () => {
        console.log(`后端服务器运行在 http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error('初始化失败:', error.message);
    process.exit(1);
});