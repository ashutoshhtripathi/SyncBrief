from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from backend.app.database import get_db
from backend.app.models import Channel, Message, User
from backend.app.schemas import ChannelResponse, MessageResponse, MessageCreate, ChannelToggleRequest
from backend.app.auth_deps import get_current_user

router = APIRouter(prefix="/channels", tags=["Channels Simulator & Privacy"])

@router.get("", response_model=List[ChannelResponse])
def get_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all team channels in current tenant and their SyncBrief AI privacy opt-in status."""
    query = db.query(Channel)
    if current_user.tenant_id is not None:
        query = query.filter(Channel.tenant_id == current_user.tenant_id)
    return query.all()

@router.patch("/{channel_id}/toggle", response_model=ChannelResponse)
def toggle_channel_opt_in(
    channel_id: int,
    req: ChannelToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enable or disable SyncBrief AI reading messages in this channel (Manager/Director only)."""
    if current_user.role_level is not None and current_user.role_level > 2 and current_user.role not in ["admin", "director", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only managers and directors can change channel AI privacy settings."
        )

    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if current_user.tenant_id is not None and channel.tenant_id is not None and current_user.tenant_id != channel.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Channel belongs to a different organization")

    channel.is_syncbrief_enabled = req.is_syncbrief_enabled
    db.commit()
    db.refresh(channel)
    return channel

@router.get("/{channel_name}/messages", response_model=List[MessageResponse])
def get_channel_messages(
    channel_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat thread history for the Teams channel simulator within current tenant."""
    clean_name = channel_name if channel_name.startswith("#") else f"#{channel_name}"
    channel_query = db.query(Channel).filter(Channel.name == clean_name)
    if current_user.tenant_id is not None:
        channel_query = channel_query.filter(Channel.tenant_id == current_user.tenant_id)
    channel = channel_query.first()
    if not channel:
        raise HTTPException(status_code=404, detail=f"Channel {clean_name} not found in current organization")

    messages = db.query(Message).filter(Message.channel_id == channel.id).order_by(Message.timestamp.asc()).all()
    return messages

@router.post("/{channel_name}/messages", response_model=MessageResponse)
def post_channel_message(
    channel_name: str,
    req: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post a new message in the channel simulator (evidence source)."""
    clean_name = channel_name if channel_name.startswith("#") else f"#{channel_name}"
    channel_query = db.query(Channel).filter(Channel.name == clean_name)
    if current_user.tenant_id is not None:
        channel_query = channel_query.filter(Channel.tenant_id == current_user.tenant_id)
    channel = channel_query.first()
    if not channel:
        raise HTTPException(status_code=404, detail=f"Channel {clean_name} not found in current organization")

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

