import React, { useState } from 'react';
import styled from 'styled-components';
import { IconDownload, IconFileText, IconImage } from '../ui/icons';
import { attachmentSrc, resolveAttachmentKind } from '../../services/chat';
import type { ChatAttachment } from '../../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ImageWrap = styled.button`
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
  max-width: min(360px, 100%);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-2);
  background: var(--bg-3);

  img {
    display: block;
    width: 100%;
    max-height: 360px;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.25);
  }

  .caption {
    display: block;
    padding: 6px 8px;
    font-size: 11px;
    color: var(--text-3);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-top: 1px solid var(--border-1);
    background: var(--bg-2);
  }
`;

const AttVideo = styled.video`
  display: block;
  max-width: min(360px, 100%);
  max-height: 320px;
  border-radius: 10px;
  background: #000;
  border: 1px solid var(--border-2);
`;

const AttAudio = styled.audio`
  width: min(320px, 100%);
`;

const AttFile = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-2);
  background: var(--bg-2);
  color: var(--text-1);
  text-decoration: none;
  max-width: 320px;
  transition: border-color 0.15s, background 0.15s;

  &:hover { border-color: var(--accent); background: var(--accent-soft); }

  .icon {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 7px;
    display: grid;
    place-items: center;
    background: var(--bg-3);
    color: var(--accent);
  }
  .meta { display: flex; flex-direction: column; min-width: 0; }
  .name {
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .size { font-size: 11px; color: var(--text-4); }
  .dl { margin-left: auto; color: var(--text-3); flex-shrink: 0; }
`;

const Expired = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed var(--border-2);
  background: var(--bg-2);
  color: var(--text-3);
  font-size: 12px;
  max-width: 320px;

  svg { flex-shrink: 0; color: var(--text-4); }
  .name {
    font-size: 11px;
    color: var(--text-4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

function ImagePreview({ att }: { att: ChatAttachment }) {
  const [failed, setFailed] = useState(false);
  const src = attachmentSrc(att);

  if (att.expired || failed) {
    return (
      <Expired title={att.name}>
        <IconImage size={18} />
        <div>
          <div>File deleted from server</div>
          <div className="name">{att.name}</div>
        </div>
      </Expired>
    );
  }

  return (
    <ImageWrap
      type="button"
      title={`Open ${att.name}`}
      onClick={() => window.open(src, '_blank', 'noopener')}
    >
      <img src={src} alt={att.name} loading="lazy" onError={() => setFailed(true)} />
      <span className="caption">{att.name}</span>
    </ImageWrap>
  );
}

const AttachmentPreview: React.FC<{ att: ChatAttachment }> = ({ att }) => {
  if (att.expired) {
    return (
      <Expired title={att.name}>
        <IconImage size={18} />
        <div>
          <div>File deleted from server</div>
          <div className="name">{att.name}</div>
        </div>
      </Expired>
    );
  }

  const kind = resolveAttachmentKind(att);
  const src = attachmentSrc(att);

  if (kind === 'image') return <ImagePreview att={att} />;
  if (kind === 'video') {
    return <AttVideo src={src} controls preload="metadata" />;
  }
  if (kind === 'audio') {
    return <AttAudio src={src} controls preload="metadata" />;
  }

  return (
    <AttFile href={src} target="_blank" rel="noopener" download={att.name}>
      <span className="icon"><IconFileText size={18} /></span>
      <span className="meta">
        <span className="name">{att.name}</span>
        <span className="size">{formatFileSize(att.size)}</span>
      </span>
      <span className="dl"><IconDownload size={16} /></span>
    </AttFile>
  );
};

export default AttachmentPreview;
