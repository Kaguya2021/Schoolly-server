const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware проверки токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Forbidden' });
    req.user = user;
    next();
  });
};

// Эндпоинт авторизации (тестовый выдатчик токенов)
app.post('/api/auth/login', async (req, res) => {
  const { email } = req.body;
  // Для теста выдаем токен с ID = 1
  const token = jwt.sign({ id: 1, email: email }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token });
});

// Синхронизация расписания
app.post('/api/sync/schedule', authenticateToken, async (req, res) => {
  const { schedule } = req.body;
  const userId = req.user.id;

  try {
    for (let item of schedule) {
      await pool.query(
        `INSERT INTO schedule (user_id, weekday, lesson_number, subject, start_time, end_time, classroom)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, weekday, lesson_number) 
         DO UPDATE SET subject = EXCLUDED.subject, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, classroom = EXCLUDED.classroom`,
        [userId, item.weekday, item.lessonNumber, item.subject, item.startTime, item.endTime, item.classroom]
      );
    }
    res.json({ success: true, message: "Синхронизировано" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
