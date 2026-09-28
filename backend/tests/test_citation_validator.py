import pytest
from datetime import datetime
from backend.app.database import SessionLocal, Base, engine
from backend.app.models import Channel, Message
from backend.app.ai.validator import CitationValidator

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Create test channel and message
    channel = Channel(name="#test-channel", description="Test", is_syncbrief_enabled=True)
    disabled_channel = Channel(name="#private-channel", description="Private", is_syncbrief_enabled=False)
    db.add_all([channel, disabled_channel])
    db.flush()

    msg = Message(
        id="msg_test_100",
        channel_id=channel.id,
        channel_name="#test-channel",
        author_name="Alice Smith",
        content="The database migration script 0042_oauth_tenants.sql is currently blocked on security audit.",
        timestamp=datetime.utcnow()
    )
    msg_private = Message(
        id="msg_test_private_101",
        channel_id=disabled_channel.id,
        channel_name="#private-channel",
        author_name="Bob Jones",
        content="Confidential discussion on secret project.",
        timestamp=datetime.utcnow()
    )
    db.add_all([msg, msg_private])
    db.commit()

    yield db
    db.close()

def test_valid_citation_passes(db_session):
    citation = {
        "message_id": "msg_test_100",
        "channel": "#test-channel",
        "author": "Alice Smith",
        "quote": "database migration script 0042_oauth_tenants.sql is currently blocked"
    }
    validated = CitationValidator.validate_citations([citation], db_session)
    assert len(validated) == 1
    assert validated[0]["status"] == "VERIFIED"
    assert "rejection_reason" not in validated[0] or validated[0]["rejection_reason"] is None

def test_nonexistent_message_fails(db_session):
    citation = {
        "message_id": "msg_fake_9999",
        "channel": "#test-channel",
        "author": "Alice Smith",
        "quote": "This text does not exist anywhere."
    }
    validated = CitationValidator.validate_citations([citation], db_session)
    assert len(validated) == 1
    assert validated[0]["status"] == "UNVERIFIED"
    assert "not found in database" in validated[0]["rejection_reason"]

def test_hallucinated_quote_in_real_message_fails(db_session):
    citation = {
        "message_id": "msg_test_100",
        "channel": "#test-channel",
        "author": "Alice Smith",
        "quote": "We have decided to shut down all servers permanently."
    }
    validated = CitationValidator.validate_citations([citation], db_session)
    assert len(validated) == 1
    assert validated[0]["status"] == "UNVERIFIED"
    assert "hallucination rejected" in validated[0]["rejection_reason"]

def test_opted_out_channel_rejected_for_privacy(db_session):
    citation = {
        "message_id": "msg_test_private_101",
        "channel": "#private-channel",
        "author": "Bob Jones",
        "quote": "Confidential discussion on secret project."
    }
    validated = CitationValidator.validate_citations([citation], db_session)
    assert len(validated) == 1
    assert validated[0]["status"] == "UNVERIFIED"
    assert "opted-out" in validated[0]["rejection_reason"]
