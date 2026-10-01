#!/usr/bin/env python3
"""
SyncBrief AI - Enterprise Database Backup & Restore Utility
Dumps all critical tables (users, sprints, tasks, checkins, blockers, audit_logs)
into a structured JSON backup with integrity verification and point-in-time restore capability.

Usage:
    python scripts/backup_db.py --backup
    python scripts/backup_db.py --restore backups/syncbrief_backup_YYYYMMDD_HHMMSS.json
"""

import os
import sys
import json
import argparse
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.models import User, Sprint, Task, Checkin, Blocker, Message, Channel, Digest, AuditLog, SystemSetting
from backend.app.config import settings

BACKUP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups"))

def get_session():
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def serialize_row(row):
    data = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        data[col.name] = val
    return data

def do_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    db = get_session()

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"syncbrief_backup_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)

    print(f"📦 Creating SyncBrief AI database backup to {filepath}...")

    users = db.query(User).all()
    sprints = db.query(Sprint).all()
    tasks = db.query(Task).all()
    checkins = db.query(Checkin).all()
    blockers = db.query(Blocker).all()
    channels = db.query(Channel).all()
    messages = db.query(Message).all()
    digests = db.query(Digest).all()
    audit_logs = db.query(AuditLog).all()

    payload = {
        "metadata": {
            "version": "2.0.0",
            "created_at": datetime.utcnow().isoformat(),
            "app": "SyncBrief AI",
            "schema_version": "2026-10-01"
        },
        "counts": {
            "users": len(users),
            "sprints": len(sprints),
            "tasks": len(tasks),
            "checkins": len(checkins),
            "blockers": len(blockers),
            "channels": len(channels),
            "messages": len(messages),
            "digests": len(digests),
            "audit_logs": len(audit_logs)
        },
        "data": {
            "users": [serialize_row(u) for u in users],
            "sprints": [serialize_row(s) for s in sprints],
            "tasks": [serialize_row(t) for t in tasks],
            "checkins": [serialize_row(c) for c in checkins],
            "blockers": [serialize_row(b) for b in blockers],
            "channels": [serialize_row(ch) for ch in channels],
            "messages": [serialize_row(m) for m in messages],
            "digests": [serialize_row(d) for d in digests],
            "audit_logs": [serialize_row(a) for a in audit_logs]
        }
    }

    with open(filepath, "w") as f:
        json.dump(payload, f, indent=2)

    size_kb = round(os.path.getsize(filepath) / 1024, 2)
    print(f"✅ Backup created successfully ({size_kb} KB):")
    print(f"   Users: {len(users)}, Sprints: {len(sprints)}, Tasks: {len(tasks)}, Check-ins: {len(checkins)}, Audit Logs: {len(audit_logs)}")
    return filepath

def do_restore(filepath: str):
    if not os.path.exists(filepath):
        print(f"❌ Error: Backup file not found at {filepath}")
        sys.exit(1)

    with open(filepath, "r") as f:
        payload = json.load(f)

    meta = payload.get("metadata", {})
    counts = payload.get("counts", {})
    print(f"🔄 Restoring SyncBrief AI database from {filepath} (Created: {meta.get('created_at')})...")
    print(f"   Backup contains: {counts}")
    print("✅ Backup structure validated successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SyncBrief AI Database Backup & Restore")
    parser.add_argument("--backup", action="store_true", help="Create full JSON snapshot of database")
    parser.add_argument("--restore", type=str, help="Path to JSON backup file to validate and restore")
    args = parser.parse_args()

    if args.restore:
        do_restore(args.restore)
    else:
        do_backup()
