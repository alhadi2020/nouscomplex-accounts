# Nous Complex - Account Management System

A complete account management system for educational institutes built with Supabase.

## Features

### Student Management
- Add/Edit/Delete students
- Track roll number, class, course, batch
- Fee tracking with increment and concession
- Joining and exit dates
- Active/Inactive status

### Class Management
- Create classes with section and academic year
- Assign teachers to classes
- Batch number tracking

### Teacher Management
- Full teacher profiles
- Salary with increment/decrement tracking
- Joining and exit dates
- Leave tracking
- Active/Inactive status

### Financial Management
- Fee collection with date tracking
- Salary payments with date tracking
- Expense categories and tracking

### Balance Sheet
- Monthly and annual views
- Summary and detailed reports
- Dues and payable calculation
- Net position tracking

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Supabase (PostgreSQL + Auth)
- **Authentication**: Email/Password

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Enter project details:
   - Name: `nousomplex-accounts`
   - Database Password: (save this somewhere)
   - Region: Choose closest to you
5. Wait for project to be created (1-2 minutes)

### Step 2: Run Database Schema

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the `database.sql` file from this package
4. Copy ALL the SQL code
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

### Step 3: Configure the App

1. In Supabase dashboard, go to **Project Settings > API**
2. Copy your **Project URL** (looks like: `https://xxxxx.supabase.co`)
3. Copy your **anon public** key
4. Open `config.js` in a text editor
5. Replace the placeholder values:
   ```javascript
   SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
   SUPABASE_ANON_KEY: "YOUR_ANON_KEY_HERE"