require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev'));
app.use(express.json());

// PostgreSQL Pool Configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Function to initialize database: create tables and seed data if tables don't exist
const initializeDatabase = async () => {
    try {
        // Create tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL
            );
        `);
        console.log('Tables created or confirmed existing');

        // Seed data into the departments table
        const departmentsResult = await pool.query(`
            INSERT INTO departments (name)
            VALUES ('Engineering'), ('Marketing'), ('Sales'), ('HR')
            ON CONFLICT DO NOTHING
            RETURNING id;
        `);

        if (departmentsResult.rowCount > 0) {
            console.log('Departments seeded:', departmentsResult.rows);

            // Seed data into employees table with the created department IDs
            await pool.query(`
                INSERT INTO employees (name, department_id, created_at, updated_at) VALUES
                ('Alice Johnson', ${departmentsResult.rows[0].id}, NOW(), NOW()),
                ('Bob Smith', ${departmentsResult.rows[1].id}, NOW(), NOW()),
                ('Carol White', ${departmentsResult.rows[2].id}, NOW(), NOW()),
                ('David Brown', ${departmentsResult.rows[3].id}, NOW(), NOW())
                ON CONFLICT DO NOTHING;
            `);
            console.log('Employees seeded successfully');
        } else {
            console.log('Departments already seeded, skipping employee seed.');
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

// Initialize database tables and seed data
initializeDatabase();

// Routes

// GET /api/employees - Get all employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM employees');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching employees' });
    }
});

// GET /api/departments - Get all departments
app.get('/api/departments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM departments');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching departments' });
    }
});

// POST /api/employees - Create a new employee
app.post('/api/employees', async (req, res) => {
    const { name, department_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO employees (name, department_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
            [name, department_id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error creating employee' });
    }
});

// DELETE /api/employees/:id - Delete an employee by ID
app.delete('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM employees WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting employee' });
    }
});

// PUT /api/employees/:id - Update an employee by ID
app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { name, department_id } = req.body;
    try {
        const result = await pool.query(
            'UPDATE employees SET name = $1, department_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [name, department_id, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating employee' });
    }
});

// Error Handling Route
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Start Server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});