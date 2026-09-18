# SQL Playground

A teaching tool where ~100 students each run arbitrary SQL (including destructive DML) against their own private copy of the LankaKart retail dataset, without affecting each other.

## Language

**Sandbox**:
One student's private, mutable copy of the database. Every browser gets its own; no sandbox can see or affect another.
_Avoid_: Session, user database, instance

**Seed**:
The pristine LankaKart dataset a fresh Sandbox starts from, built from the workbook. Immutable; the single source of truth for what "original" means.
_Avoid_: Fixture, dump, initial data

**Reset**:
A student-triggered action that discards their Sandbox's current state and restores it to the Seed. Self-service only; affects nobody else.
_Avoid_: Re-seed, restore, wipe

**Student**:
Anyone using the playground. Anonymous — there is no login, no identity, no account.
_Avoid_: User, account
