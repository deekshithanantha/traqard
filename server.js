const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_super_secret_key_change_this_in_production';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // Serve static files from current directory

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Auth Routes ---

app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const hashedPassword = bcrypt.hashSync(password, 8);

    db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, [username, hashedPassword], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'User created successfully', userId: this.lastID });
    });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
        if (!passwordIsValid) return res.status(401).json({ token: null, error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: 86400 }); // 24 hours
        res.json({ auth: true, token: token, username: user.username });
    });
});

// --- Data Routes ---

// Get entry for a specific date
app.get('/api/entry/:date', authenticateToken, (req, res) => {
    const date = req.params.date;
    const userId = req.user.id;

    db.get(`SELECT data FROM entries WHERE user_id = ? AND date = ?`, [userId, date], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json(JSON.parse(row.data));
        } else {
            res.json(null); // No data for this date
        }
    });
});

// Save or Update entry for a specific date
app.post('/api/entry', authenticateToken, (req, res) => {
    const { date, data } = req.body;
    const userId = req.user.id;
    const dataString = JSON.stringify(data);

    db.run(`INSERT INTO entries (user_id, date, data) VALUES (?, ?, ?)
            ON CONFLICT(user_id, date) DO UPDATE SET data = ?, updated_at = CURRENT_TIMESTAMP`,
        [userId, date, dataString, dataString],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Saved successfully' });
        });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
