# ADR 0001: Initial technology stack

- Status: Accepted as initial implementation baseline
- Date: 2026-11-04

## Decision

Use TypeScript in a pnpm monorepo. Mobile: Expo + React Native. API: NestJS. Data: PostgreSQL with PostGIS. Real-time: WebSockets. Routing and payment integrations are adapters.

## Rationale

This keeps one primary language across client, API and shared contracts, supports mobile-first development from a phone through cloud tooling, and leaves critical third-party services replaceable.

## Consequences

The project needs a cloud development/deployment environment and managed PostgreSQL with PostGIS. Provider selection for maps, OTP and payments remains open until cost, coverage, legal requirements and sandbox access are assessed.
