// using http module
// Since I can't install node-fetch easily without cluttering, I'll use http module or just assume node > 18
// Checking node version first is smart, but let's assume standard environment or use a simple http wrapper.
// Actually, I can use a simple curl command or just a quick script using http.

const http = require('http');

const post = (path, data) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
};

async function runTests() {
    try {
        console.log("Testing Registration...");
        const regData = JSON.stringify({ username: 'testuser_' + Date.now(), password: 'password123' });
        const regRes = await post('/auth/register', regData);
        console.log("Register:", regRes.status, regRes.body);

        if (regRes.status !== 200) throw new Error("Registration failed");

        console.log("Testing Login...");
        const loginRes = await post('/auth/login', regData);
        console.log("Login:", loginRes.status, loginRes.body.auth ? "Auth OK" : "Auth Failed");

        if (!loginRes.body.token) throw new Error("Login failed");

        const token = loginRes.body.token;

        // Test Saving Data
        console.log("Testing Save Data...");
        const saveData = JSON.stringify({
            date: '2023-10-27',
            data: { some: 'test data' }
        });

        const savePromise = new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: '/api/entry',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token,
                    'Content-Length': Buffer.byteLength(saveData)
                }
            };
            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: body }));
            });
            req.on('error', reject);
            req.write(saveData);
            req.end();
        });

        const saveRes = await savePromise;
        console.log("Save:", saveRes.status, saveRes.body);

        console.log("All backend tests passed!");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

// Wait for server to definitely be up
setTimeout(runTests, 2000);
