from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from backend.app.database import get_db
from backend.app.models import Channel, Message, User
from backend.app.schemas import ChannelResponse, MessageResponse, MessageCreate, ChannelToggleRequest
from backend.app.auth_deps import get_current_user

router = APIRouter(prefix="/channels", tags=["Channels Simulator & Privacy"])

@router.get("", response_model=List[ChannelResponse])
def get_channels(db: Session = Depends(get_db)):
    """List all team channels and their SyncBrief AI privacy opt-in status."""
    return db.query(Channel).all()

@router.patch("/{channel_id}/toggle", response_model=ChannelResponse)
def toggle_channel_opt_in(
    channel_id: int,
    req: ChannelToggleRequest,
    db: Session = Depends(get_db)
):
    """Enable or disable SyncBrief AI reading messages in this channel (Privacy First)."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel.is_syncbrief_enabled = req.is_syncbrief_enabled
    db.commit()
    db.refresh(channel)
    return channel

@router.get("/{channel_name}/messages", response_model=List[MessageResponse])
def get_channel_messages(channel_name: str, db: Session = Depends(get_db)):
    """Get chat thread history for the Teams channel simulator."""
    clean_name = channel_name if channel_name.startswith("#") else f"#{channel_name}"
    messages = db.query(Message).filter(Message.channel_name == clean_name).order_by(Message.timestamp.asc()).all()
    return messages

@router.post("/{channel_name}/messages", response_model=MessageResponse)
def post_channel_message(
    channel_name: str,
    req: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Post a new message in the channel simulator (evidence source)."""
    clean_name = channel_name if channel_name.startswith("#") else f"#{channel_name}"
    channel = db.query(Channel).filter(Channel.name == clean_name).first()
    if not channel:
        raise HTTPException(status_code=404, detail=f"Channel {clean_name} not found")

    # Generate next ID
    count = db.query(Message).count()
    new_id = f"msg_{clean_name[1:]}_{count + 1:03d}"

    msg = Message(
        id=new_id,
        channel_id=channel.id,
        channel_name=channel.name,
        author_id=current_user.id,
        author_name=current_user.full_name,
        author_avatar=current_user.avatar_url,
        content=req.content,
        thread_id=req.thread_id,
        timestamp=datetime.utcnow()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
