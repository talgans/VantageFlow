# VantageFlow Project Overview Report

## 1. Executive Summary
**VantageFlow** is a comprehensive project management dashboard and KPI tracking application designed for real-time collaboration. It integrates **AI-powered insights** (via Google Gemini) to provide project health analysis and risk identification. The application supports role-based access control, interactive data visualization, and timeline management through Gantt charts.

**Current Status:** Production Ready (v1.0.0) 
**Latest Milestone:** Complete Implementation (Nov 8, 2025)

## 2. Key Features

### Project Management
- **Real-time Tracking:** Live updates across all users via Firestore listeners.
- **Gantt Timeline:** Visual project scheduling and phase management.
- **Task Management:** Nested task structures with subtasks, deliverables, and drag-and-drop reordering.
- **Progress Tracking:** Percentage-based status updates (0%, 25%, 50%, 75%, 100%).

### Role-Based Access Control (RBAC)
- **Admin:** Full access, including project deletion and user role management.
- **Project Manager:** Create and edit projects, manage teams.
- **Team Member:** View-only access to assigned projects and dashboards.

### Artificial Intelligence Integration
- **Engine:** Google Gemini 2.5 Flash.
- **Capabilities:**
    - Automated project health analysis.
    - Risk identification and mitigation suggestions.
    - Actionable recommendations based on project data.

### Analytics & Visualization
- **Dashboard:** Master view of all active projects.
- **Charts:** Interactive status distribution (Pie/Donut), Gantt charts, and member involvement metrics.
- **Reporting:** Visual indicators for "At Risk" projects.

## 3. Technical Architecture

### Frontend Stack
- **Framework:** React 19.2.0
- **Language:** TypeScript 5.8.2
- **Build Tool:** Vite 6.2.0
- **Styling:** Tailwind CSS (CDN/Utility-first)
- **Visualization:** Recharts 3.3.0

### Backend & Infrastructure
- **Platform:** Google Firebase
- **Database:** Cloud Firestore (NoSQL, Real-time)
- **Authentication:** Firebase Auth (Email/Password + Custom Claims for Roles)
- **Serverless:** Firebase Cloud Functions (implied for specific backend logic/admin scripts)
- **AI Service:** Google Gemini API

### Security
- **Authorization:** Firestore Security Rules enforcing RBAC.
- **User Management:** Custom admin scripts for safe role assignment.
- **Data Protection:** Environment variable isolation for API keys.

## 4. Data Model Overview

### Project Core
- **Project:** Top-level entity containing metadata (cost, duration, currency), team composition, and phases.
- **Phase:** Time-bound segments of a project with specific week ranges.
- **Task:** Unit of work with status, start/end dates, and optional subtasks (recursive structure).
- **Users:** Team members with specific roles (Admin/Manager/Member) and profile data.

## 5. Deployment & Maintenance
- **Hosting:** Optimised for Firebase Hosting or Google AI Studio CDN.
- **CI/CD:** Manual deployment workflows documented in `DEPLOYMENT.md`.
- **Maintenance:** Admin scripts provided for database seeding and user role management (`firestore-admin`).

## 6. Recent Work & Active Context
- **Refinements:** Recent updates to task status logic (percentage-based), dashboard filtering, and creating local development environments.
- **Documentation:** Comprehensive guides exist for Setup (`QUICKSTART.md`), Deployment (`DEPLOYMENT.md`), and Admin tasks (`USER_ADMIN_GUIDE.md`).
