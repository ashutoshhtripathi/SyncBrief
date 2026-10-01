from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def run_migrations():
    """Ensure SQLite columns added in newer versions exist without dropping existing tables."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            # Check users
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)"))]
            if cols:
                if "refresh_token" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token VARCHAR(500)"))
                if "deleted_at" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN deleted_at DATETIME"))
            # Check sprints
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(sprints)"))]
            if cols and "deleted_at" not in cols:
                conn.execute(text("ALTER TABLE sprints ADD COLUMN deleted_at DATETIME"))
            # Check tasks
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(tasks)"))]
            if cols:
                if "deleted_at" not in cols:
                    conn.execute(text("ALTER TABLE tasks ADD COLUMN deleted_at DATETIME"))
                if "version" not in cols:
                    conn.execute(text("ALTER TABLE tasks ADD COLUMN version INTEGER DEFAULT 1"))
            # Check audit_logs
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(audit_logs)"))]
            if cols:
                if "actor_id" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_id INTEGER"))
                if "actor_name" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_name VARCHAR(255)"))
                if "entity_type" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(50)"))
                if "entity_id" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_id INTEGER"))
                if "old_values_json" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN old_values_json TEXT"))
                if "new_values_json" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN new_values_json TEXT"))
            conn.commit()
    except Exception:
        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

