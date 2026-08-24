# AI Atlas — Project Reference

## Core Concept

**AI Atlas** — _The global AI race, visualized._

A visually rich, frontend-heavy AI intelligence platform showing:

- Which countries are leading in AI
- Where AI adoption is highest and growing fastest
- Where AI investment is concentrated
- Where AI development/research is strongest
- Which companies are driving the AI ecosystem

The centerpiece should be an **interactive 3D globe** with animated data layers.

---

## V1 Scope

Keep V1 focused on **countries + AI adoption + investment + development + companies**.

### 1. Global Overview

Interactive 3D globe showing global AI activity.

Possible headline metrics:

- AI adoption
- AI investment
- AI models/development
- AI research

Users can switch between data layers.

### 2. AI Adoption

Show:

- Adoption percentage by country
- Adoption ranking
- Adoption growth over time
- Fastest-growing countries

Example:

> UAE 64.0%, Singapore 60.9%, Norway 46.4% (example figures from Microsoft H2 2025 data)

A country click should zoom the globe into that country and open a detailed panel.

### 3. AI Investment

Show:

- Private AI investment by country
- Investment ranking
- Major investment hubs

Example:

> U.S. ~$109B, China ~$9.3B, UK ~$4.5B in 2024 (Stanford AI Index)

### 4. AI Development / Research

Show:

- Notable AI models by country
- AI publications
- AI patents
- Research activity

Stanford AI Index is a major source.

### 5. Companies

Create company profiles for major AI players:

- OpenAI
- Anthropic
- Google
- Meta
- Microsoft
- NVIDIA
- xAI
- DeepSeek
- Mistral
- Alibaba
- etc.

Possible company data:

- Country
- Funding
- Valuation (where reliable)
- Models
- Products
- Major releases
- Timeline
- Geographic presence

---

## Key UX Features

### Country Detail

Click a country → globe smoothly zooms in → country intelligence panel.

Example:

**UNITED STATES**

- AI investment
- AI adoption
- AI companies
- Notable models
- Research
- Trend/growth

### Country Comparison

Compare countries across multiple dimensions rather than creating one arbitrary overall AI score.

Example:

- Development
- Investment
- Adoption
- Research
- Growth

### Fastest Rising

A dedicated section showing countries whose AI adoption/development is accelerating fastest.

Example:

> South Korea #25 → #18

Use animated ranking changes and globe transitions.

### Data Layers

Allow users to switch the globe between:

- AI Adoption
- AI Investment
- AI Development
- AI Research

---

## Main Data Sources

### Microsoft — Global AI Adoption

Best source for country-level AI adoption/diffusion data.

Useful for:

- Adoption percentage
- Country rankings
- H1/H2 comparisons
- Adoption growth
- Fastest-rising countries

Microsoft publishes country-level AI diffusion data and underlying datasets.

### Stanford AI Index

Major source for global AI ecosystem statistics.

Useful for:

- AI investment
- Notable AI models
- AI publications
- AI patents
- Research/development
- Country comparisons

### Hugging Face

Useful later for the model layer.

Useful for:

- AI model metadata
- Models
- Downloads
- Likes
- Tasks/modalities
- Benchmark/evaluation data

### Papers with Code

Useful later for:

- Research papers
- Models
- Benchmarks
- Datasets
- Leaderboards

---

## Later Versions

### V2

Add deeper company intelligence:

- Funding history
- Company timelines
- Model/product relationships
- Geographic presence

### V3

Add AI models:

- Model explorer
- Model comparisons
- Benchmarks
- Model timelines

### V4

Add research:

- Papers → models → benchmarks → companies

### V5

Add AI Analyst:
User asks questions such as:

> "Which countries are adopting AI fastest?"

The AI analyzes the platform's data and highlights the relevant countries/charts.

### V6

Add automated/live updates:

- New models
- New investment data
- New company information
- New adoption/research data

---

## Frontend Direction

The project should primarily showcase frontend engineering.

Potential stack:

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Three Fiber / Three.js
- D3.js
- GSAP and/or Framer Motion

Backend:

- Node.js
- PostgreSQL
- Prisma/Drizzle
- API/data ingestion layer

AI later:

- OpenAI / Gemini

---

## Design Philosophy

Do **not** make it a generic admin dashboard.

Goal:

> **A polished intelligence product that feels like a premium data platform.**

Priorities:

1. Interactive 3D globe
2. Smooth camera/scroll transitions
3. Beautiful data visualization
4. Excellent country/company interactions
5. Responsive design
6. Performance
7. Real data
8. Clean React/Next.js architecture

Prefer a smaller, carefully curated dataset with an exceptional interface over a huge dataset with a generic UI.

---

## Core V1 Navigation

**AI Atlas**

- Global Overview
- Countries
- Companies
- Trends

Possible future:

- Models
- Research
- AI Analyst

---

## Project Positioning

Portfolio description:

> **AI Atlas — Interactive AI Intelligence Platform**
> Built a full-stack data visualization platform for exploring global AI adoption, investment, research, companies, and development using Next.js, React, Three.js, D3.js, PostgreSQL, and real-world AI datasets.

The project should demonstrate:

- Modern React/Next.js
- Complex UI state
- Data visualization
- WebGL / 3D
- Animation
- API/data integration
- Backend/data modeling
- Performance optimization
- Responsive frontend engineering
