# SUGAR-OP Project Charter
> **Smart Sugarcane Dashboard** - OCR Receipt Scanning for Sugarcane Farmers

---

## 1. Mission Statement

Empower sugarcane farmers with an intelligent, accessible platform to digitize and manage their transaction receipts through AI-powered OCR, reducing manual data entry errors and providing actionable financial insights.

---

## 2. Core Features (MVP Scope)

### 2.1 Receipt Upload & Processing
| Feature | Description | Priority |
|---------|-------------|----------|
| Image Upload | Multi-format support (JPEG, PNG, PDF) with drag-and-drop UI | P0 |
| Gemini OCR | Extract structured data using Google Gemini 2.0 Flash | P0 |
| Data Verification | User review and correction of OCR results before saving | P0 |

### 2.2 Dashboard & Analytics
| Feature | Description | Priority |
|---------|-------------|----------|
| Transaction History | Paginated list with search and filter capabilities | P0 |
| Summary Cards | Key metrics: Total Weight, Revenue, Pending Receipts | P0 |
| Export Data | CSV/Excel export for accounting integration | P1 |

### 2.3 User Management
| Feature | Description | Priority |
|---------|-------------|----------|
| Authentication | Supabase Auth (Email/Password) | P0 |
| Profile Settings | Basic user profile management | P1 |

---

## 3. Timeline - 72-Hour MVP Plan

```
┌─────────────────────────────────────────────────────────────────────┐
│                    72-HOUR DEVELOPMENT SPRINT                       │
├─────────────────────────────────────────────────────────────────────┤
│  PHASE 1: Foundation (0-24 Hours)                                   │
│  ├── Project Setup (Next.js 15, Tailwind, Shadcn)                  │
│  ├── Supabase Configuration (Auth + Database)                       │
│  ├── Core Layout & Navigation                                       │
│  └── Authentication Flow                                            │
├─────────────────────────────────────────────────────────────────────┤
│  PHASE 2: AI Integration (24-48 Hours)                              │
│  ├── Gemini Client Singleton Setup                                  │
│  ├── Receipt Upload Component                                       │
│  ├── OCR Processing Pipeline                                        │
│  └── Data Verification UI                                           │
├─────────────────────────────────────────────────────────────────────┤
│  PHASE 3: Dashboard & Polish (48-72 Hours)                          │
│  ├── Dashboard Summary Cards                                        │
│  ├── Transaction History Table                                      │
│  ├── Error Handling & Edge Cases                                    │
│  └── Testing & Deployment Prep                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| OCR Accuracy | ≥85% field extraction accuracy | Manual verification sampling |
| Processing Time | <10 seconds per receipt | Gemini API response time |
| User Satisfaction | Intuitive UI for non-tech users | Usability testing with farmers |

---

## 5. Constraints & Assumptions

### Technical Constraints
- **Free Tier Usage**: Supabase (500MB), Gemini API (15 RPM / 1M TPM)
- **No Custom ML Models**: Rely entirely on Gemini's vision capabilities
- **Thai Language Support**: OCR must handle Thai text on receipts

### Assumptions
- Users have smartphone cameras capable of capturing legible receipt images
- Internet connectivity is available at point of use
- Receipts follow semi-structured formats from sugarcane cooperatives

---

## 6. Stakeholders

| Role | Responsibility |
|------|----------------|
| Product Owner | Define requirements, acceptance criteria |
| Lead Developer | Architecture, implementation, deployment |
| End Users (Farmers) | Validation, feedback during UAT |

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini OCR inaccuracy on Thai text | High | Implement confidence scoring, manual override |
| API rate limiting | Medium | Implement queue system, retry logic |
| Poor image quality from users | High | Add image quality validation pre-upload |

---

*Document Version: 1.0*  
*Last Updated: 2026-01-19*
