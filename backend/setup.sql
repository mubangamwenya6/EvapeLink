-- EvapeLink Full Setup Script
-- Run this in phpMyAdmin SQL tab

CREATE DATABASE IF NOT EXISTS evapelink CHARACTER SET utf8 COLLATE utf8_general_ci;
USE evapelink;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(64)  NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'student',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Grades (teacher-managed)
CREATE TABLE IF NOT EXISTS grades (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Subjects (teacher-managed)
CREATE TABLE IF NOT EXISTS subjects (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Homework
CREATE TABLE IF NOT EXISTS homework (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    title         VARCHAR(255) NOT NULL,
    subject       VARCHAR(100) DEFAULT 'General',
    class_name    VARCHAR(100) DEFAULT 'Grade 9A',
    hw_type       VARCHAR(20)  DEFAULT 'manual',
    description   TEXT,
    due           DATE         NOT NULL,
    assigned_date DATE         DEFAULT (CURRENT_DATE),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Difficulty ratings
CREATE TABLE IF NOT EXISTS difficulty_ratings (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    hw_id      INT NOT NULL,
    rating     INT NOT NULL COMMENT '1=Easy 2=Medium 3=Hard',
    comment    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hw_id)   REFERENCES homework(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Policies
CREATE TABLE IF NOT EXISTS policies (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(20) DEFAULT 'pending',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Quiz submissions
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    hw_id        INT NOT NULL,
    score        INT NOT NULL,
    total        INT NOT NULL,
    pct          INT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hw_id)   REFERENCES homework(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ── Default grades & subjects ──────────────────────────────────────────────
INSERT IGNORE INTO grades (name) VALUES
('Grade 8A'),('Grade 8B'),('Grade 9A'),('Grade 9B'),('Grade 10A'),('Grade 10B');

INSERT IGNORE INTO subjects (name) VALUES
('Mathematics'),('English'),('Science'),('History'),('Geography'),
('Art'),('Physical Education'),('Technology'),('General');

-- ── Test accounts ──────────────────────────────────────────────────────────
--  admin@evapelink.com   → admin123   (Teacher)
--  parent@evapelink.com  → parent123  (Parent)
--  student@evapelink.com → student123 (Student)
INSERT INTO users (email, password_hash, role) VALUES
('admin@evapelink.com',   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'teacher'),
('parent@evapelink.com',  '82e3edf5f5f3a46b5f94579b61817fd9a1f356adcef5ee22da3b96ef775c4860', 'parent'),
('student@evapelink.com', '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', 'student');

-- ── Sample homework ────────────────────────────────────────────────────────
INSERT INTO homework (user_id,title,subject,class_name,hw_type,description,due,assigned_date) VALUES
(1,'Quadratic Equations – Exercise 4B','Mathematics','Grade 9A','manual',
 'Complete problems 1-20 on page 87 of your Mathematics textbook. Show all working clearly.',
 '2026-03-27','2026-03-22'),
(1,'Essay: My Role Model','English','Grade 9A','manual',
 'Write a 500-word essay about a person who inspires you.',
 '2026-03-25','2026-03-20'),
(1,'Lab Report – Photosynthesis','Science','Grade 9A','manual',
 'Document your observations from the photosynthesis experiment.',
 '2026-03-30','2026-03-23'),
(1,'Timeline: Colonial Africa','History','Grade 9B','manual',
 'Create a detailed illustrated timeline covering African colonial history from 1880 to 1960.',
 '2026-03-28','2026-03-21'),
(1,'Fractions & Decimals – Online Quiz','Mathematics','Grade 9A','quiz',
 'Complete this online auto-marked quiz on fractions and decimals. 5 questions, 20 minutes.',
 '2026-03-26','2026-03-24');

-- ── Sample difficulty ratings ──────────────────────────────────────────────
INSERT INTO difficulty_ratings (user_id,hw_id,rating,comment) VALUES
(3,1,3,'The completing the square section was very tricky.'),
(3,2,2,'Writing 500 words was hard. Struggled with the conclusion.');

-- ── Sample policies ────────────────────────────────────────────────────────
INSERT INTO policies (title,description,status) VALUES
('Late Submission Policy',
 'Homework submitted more than 2 days late will receive a 20% grade deduction.',
 'approved'),
('Screen Time for Digital Homework',
 'Students may use devices for homework between 4pm and 8pm on school nights.',
 'pending'),
('Weekend Homework Limit',
 'No more than 2 hours of total homework should be assigned over the weekend.',
 'rejected');

-- ── Sample quiz submission ─────────────────────────────────────────────────
INSERT INTO quiz_submissions (user_id,hw_id,score,total,pct) VALUES (3,5,4,5,80);
