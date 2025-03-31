console.log("Starting server...");
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const db = new sqlite3.Database('database.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to SQLite database');
    db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        duration INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS technicians (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS technician_service (
        technician_id INTEGER,
        service_id INTEGER,
        PRIMARY KEY (technician_id, service_id),
        FOREIGN KEY (technician_id) REFERENCES technicians(id),
        FOREIGN KEY (service_id) REFERENCES services(id)
      );
      CREATE TABLE IF NOT EXISTS technician_schedule (
        technician_id INTEGER,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        FOREIGN KEY (technician_id) REFERENCES technicians(id)
      );
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        service_id INTEGER,
        technician_id INTEGER,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        FOREIGN KEY (service_id) REFERENCES services(id),
        FOREIGN KEY (technician_id) REFERENCES technicians(id)
      );
      INSERT OR IGNORE INTO services (id, name, price, duration) VALUES
        (1, 'Classic Manicure', 20, 30),
        (2, 'Classic Pedicure', 25, 45),
        (3, 'Gel Manicure', 35, 45),
        (4, 'Nail Art', 15, 30),
        (5, 'French Tip Add-On', 10, 15);
      INSERT OR IGNORE INTO technicians (id, name) VALUES
        (1, 'Alice'),
        (2, 'Bob');
      INSERT OR IGNORE INTO technician_service (technician_id, service_id) VALUES
        (1, 1), (1, 2), (1, 3), (1, 4), (1, 5),
        (2, 1), (2, 3), (2, 4);
      INSERT OR IGNORE INTO technician_schedule (technician_id, day_of_week, start_time, end_time) VALUES
        (1, 'Monday', '09:00', '17:00'),
        (1, 'Tuesday', '09:00', '17:00'),
        (2, 'Monday', '10:00', '16:00'),
        (2, 'Tuesday', '10:00', '16:00');
    `, (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Database initialized with sample data');
      }
    });
  }
});

function query(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getDayOfWeek(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-us', { weekday: 'long' });
}

app.get('/services', (req, res) => {
  db.all('SELECT * FROM services', (err, rows) => {
    if (err) res.status(500).send(err.message);
    else res.json(rows);
  });
});

app.get('/technicians', (req, res) => {
  db.all('SELECT t.id, t.name, GROUP_CONCAT(s.name) as services FROM technicians t JOIN technician_service ts ON t.id = ts.technician_id JOIN services s ON ts.service_id = s.id GROUP BY t.id', (err, rows) => {
    if (err) res.status(500).send(err.message);
    else res.json(rows);
  });
});

app.get('/availability', async (req, res) => {
  const { service_id, date } = req.query;
  if (!service_id || !date) {
    res.status(400).send('Missing parameters');
    return;
  }
  const dayOfWeek = getDayOfWeek(date);
  const technicians = await query(db, `SELECT t.id, t.name FROM technicians t JOIN technician_service ts ON t.id = ts.technician_id WHERE ts.service_id = ?`, [service_id]);
  const availableSlots = {};
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

  for (const slot of timeSlots) {
    availableSlots[slot] = [];
    for (const tech of technicians) {
      const scheduleCheck = await get(db, `SELECT 1 FROM technician_schedule WHERE technician_id = ? AND day_of_week = ? AND ? >= start_time AND ? < end_time`, [tech.id, dayOfWeek, slot, slot]);
      if (scheduleCheck) {
        const appointmentCheck = await get(db, `SELECT 1 FROM appointments WHERE technician_id = ? AND date = ? AND time_slot = ?`, [tech.id, date, slot]);
        if (!appointmentCheck) {
          availableSlots[slot].push({ id: tech.id, name: tech.name });
        }
      }
    }
  }
  res.json(availableSlots);
});

app.post('/appointments', (req, res) => {
  const { customer_name, phone, email, service_id, technician_id, date, time_slot } = req.body;
  db.run(`INSERT INTO appointments (customer_name, phone, email, service_id, technician_id, date, time_slot) VALUES (?, ?, ?, ?, ?, ?, ?)`, [customer_name, phone, email, service_id, technician_id, date, time_slot], function(err) {
    if (err) res.status(500).send(err.message);
    else res.json({ message: 'Appointment booked successfully', id: this.lastID });
  });
});

app.get('/appointments', (req, res) => {
  db.all('SELECT a.*, s.name as service_name, t.name as technician_name FROM appointments a JOIN services s ON a.service_id = s.id JOIN technicians t ON a.technician_id = t.id', (err, rows) => {
    if (err) res.status(500).send(err.message);
    else res.json(rows);
  });
});

app.delete('/appointments/:id', (req, res) => {
    const { id } = req.params;
    console.log(`Attempting to delete appointment with id: ${id}`); // Debug log
    db.run('DELETE FROM appointments WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting appointment:', err.message);
        res.status(500).send(err.message);
      } else if (this.changes === 0) {
        console.error(`Appointment with id ${id} not found`);
        res.status(404).send('Appointment not found');
      } else {
        res.json({ message: 'Appointment cancelled successfully' });
      }
    });
  });

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});