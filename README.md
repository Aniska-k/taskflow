# TaskFlow — Complete Full-Stack Project

This version is designed to run cleanly on macOS with Node 22+ and does NOT use native better-sqlite3.

## Stack
- React + Vite
- Node.js + Express
- JWT authentication
- bcrypt password hashing
- Persistent JSON database (`backend/data/data.json`)
- REST CRUD API
- Socket.IO real-time task refresh
- Responsive UI

## Demo
Email: demo@taskflow.local
Password: Demo@12345

## macOS setup

### Terminal 1 — backend
```bash
cd TaskFlow_Complete_Mac/backend
npm install
npm start
```
Backend: http://localhost:5001

### Terminal 2 — frontend
```bash
cd TaskFlow_Complete_Mac/frontend
npm install
npm run dev
```
Frontend: http://localhost:5173

The frontend is already configured for port 5001 in `frontend/.env`.

## Features
Register, login, logout, JWT authorization, create/read/update/delete tasks, completion status, priorities, due dates, search, filters, progress dashboard, persistent backend data and Socket.IO refresh.
