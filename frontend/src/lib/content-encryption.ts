import { contentStorage } from './supabase';
import { logger } from './logger';

export class ContentEncryptionService {
  async encryptAndStorePost(
    content: string,
    preview: string,
    authorId: string,
    userWalletAddress: string,
    minTipAmount?: number,
    encryptedPostId?: string
  ): Promise<{
    contentHash: string;
    previewHash: string;
    supabaseId: string;
    encryptedContent: string;
    encryptedPreview: string;
  }> {
    try {
      if (!content || content.trim().length === 0) {
        throw new Error('Content cannot be empty');
      }
      if (!preview || preview.trim().length === 0) {
        throw new Error('Preview cannot be empty');
      }
      
      const contentHash = await this.generateHash(content);
      const previewHash = await this.generateHash(preview);

      const encryptedContent = this.encryptContent(content);
      const encryptedPreview = this.encryptContent(preview);

      const storedContent = await contentStorage.storeEncryptedContent(
        contentHash,
        previewHash,
        encryptedContent,
        encryptedPreview,
        authorId,
        minTipAmount,
        undefined,
        encryptedPostId
      );

      return {
        contentHash: storedContent.content_hash,
        previewHash: storedContent.preview_hash,
        supabaseId: storedContent.id.toString(),
        encryptedContent: storedContent.encrypted_content,
        encryptedPreview: storedContent.encrypted_preview
      };
    } catch (error) {
      throw new Error(`Failed to encrypt and store post content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async encryptAndStoreReply(
    postId: number,
    replyId: number,
    content: string,
    preview: string,
    replierId: string,
    userWalletAddress: string
  ): Promise<{
    contentHash: string;
    previewHash: string;
    supabaseId: string;
    encryptedContent: string;
    encryptedPreview: string;
  }> {
    try {
      if (!content || content.trim().length === 0) {
        throw new Error('Content cannot be empty');
      }
      if (!preview || preview.trim().length === 0) {
        throw new Error('Preview cannot be empty');
      }
      
      const contentHash = await this.generateHash(content);
      const previewHash = await this.generateHash(preview);

      const encryptedContent = this.encryptContent(content);
      const encryptedPreview = this.encryptContent(preview);

      const storedReply = await contentStorage.storeEncryptedReply(
        postId,
        replyId,
        contentHash,
        previewHash,
        encryptedContent,
        encryptedPreview,
        replierId
      );

      return {
        contentHash: storedReply.content_hash,
        previewHash: storedReply.preview_hash,
        supabaseId: storedReply.id.toString(),
        encryptedContent: storedReply.encrypted_content,
        encryptedPreview: storedReply.encrypted_preview
      };
    } catch (error) {
      throw new Error(`Failed to encrypt and store reply content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decryptPostContent(supabaseId: string): Promise<{
    content: string;
    preview: string;
  }> {
    try {
      const storedContent = await contentStorage.getEncryptedContent(parseInt(supabaseId));
      
      if (!storedContent) {
        throw new Error('Content not found');
      }

      const content = this.decryptContent(storedContent.encrypted_content);
      // Preview content removed for security - never decrypt preview
      const preview = '[Content preview removed for security]';

      return { content, preview };
    } catch (error) {
      throw new Error(`Failed to decrypt post content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decryptReplyContent(postId: number, replyId: number): Promise<{
    content: string;
    preview: string;
  }> {
    try {
      const storedReply = await contentStorage.getEncryptedReply(postId, replyId);
      
      if (!storedReply) {
        throw new Error('Reply content not found');
      }

      const content = this.decryptContent(storedReply.encrypted_content);
      // Preview content removed for security - never decrypt preview
      const preview = '[Content preview removed for security]';

      return { content, preview };
    } catch (error) {
      throw new Error(`Failed to decrypt reply content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateHash(content: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return '0x' + hashHex;
    } catch (error) {
      return this.generateFallbackHash(content);
    }
  }

  private generateFallbackHash(content: string): string {
    let hash1 = 0x811c9dc5;
    let hash2 = 0x01000193;
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash1 ^= char;
      hash1 = (hash1 * hash2) >>> 0;
    }
    
    const lengthHash = (content.length * 0x9e3779b9) >>> 0;
    const combinedHash = (hash1 ^ lengthHash) >>> 0;
    
    const hashBytes = new Uint8Array(32);
    const view = new DataView(hashBytes.buffer);
    
    for (let i = 0; i < 8; i++) {
      const offset = i * 4;
      const value = (combinedHash + (i * 0x9e3779b9)) >>> 0;
      view.setUint32(offset, value, false);
    }
    
    const hashHex = Array.from(hashBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return '0x' + hashHex;
  }

  encryptContent(content: string): string {
    return btoa(unescape(encodeURIComponent(content)));
  }

  decryptContent(encryptedContent: string): string {
    try {
      return decodeURIComponent(escape(atob(encryptedContent)));
    } catch (error) {
      throw new Error('Failed to decrypt content');
    }
  }
}

export const contentEncryptionService = new ContentEncryptionService();
