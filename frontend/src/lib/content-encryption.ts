import { contentStorage } from './supabase';
import { logger } from './logger';

/**
 * Content Encryption Service
 * Handles encryption and storage of post content and previews
 */
export class ContentEncryptionService {
  /**
   * Encrypt and store post content
   */
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
      logger.info('Starting post content encryption', 'ContentEncryptionService');
      
      // Validate input content
      if (!content || content.trim().length === 0) {
        throw new Error('Content cannot be empty');
      }
      if (!preview || preview.trim().length === 0) {
        throw new Error('Preview cannot be empty');
      }
      
      // Generate content and preview hashes using proper cryptographic hashing
      const contentHash = await this.generateHash(content);
      const previewHash = await this.generateHash(preview);
      
      logger.info('Content hashes generated', {
        contentHash: contentHash.substring(0, 20) + '...',
        previewHash: previewHash.substring(0, 20) + '...'
      }, 'ContentEncryptionService');

      // Encrypt the content and preview
      // For now, we'll use a simple base64 encoding
      // In production, you would use proper encryption
      const encryptedContent = this.encryptContent(content);
      const encryptedPreview = this.encryptContent(preview);
      
      logger.info('Content encrypted', {
        originalLength: content.length,
        previewLength: preview.length,
        encryptedContentLength: encryptedContent.length,
        encryptedPreviewLength: encryptedPreview.length
      }, 'ContentEncryptionService');

      // Store in Supabase
      const storedContent = await contentStorage.storeEncryptedContent(
        contentHash,
        previewHash,
        encryptedContent,
        encryptedPreview,
        authorId,
        minTipAmount,
        undefined, // rawPostId - not available in this context
        encryptedPostId
      );

      logger.info('Content stored in Supabase', {
        supabaseId: storedContent.id,
        contentHash: storedContent.content_hash.substring(0, 20) + '...',
        previewHash: storedContent.preview_hash.substring(0, 20) + '...'
      }, 'ContentEncryptionService');

      return {
        contentHash: storedContent.content_hash,
        previewHash: storedContent.preview_hash,
        supabaseId: storedContent.id.toString(),
        encryptedContent: storedContent.encrypted_content,
        encryptedPreview: storedContent.encrypted_preview
      };
    } catch (error) {
      logger.error('Post content encryption failed', error, 'ContentEncryptionService');
      throw new Error(`Failed to encrypt and store post content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt and store reply content
   */
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
      logger.info('Starting reply content encryption', 'ContentEncryptionService');
      
      // Validate input content
      if (!content || content.trim().length === 0) {
        throw new Error('Content cannot be empty');
      }
      if (!preview || preview.trim().length === 0) {
        throw new Error('Preview cannot be empty');
      }
      
      // Generate content and preview hashes using proper cryptographic hashing
      const contentHash = await this.generateHash(content);
      const previewHash = await this.generateHash(preview);
      
      logger.info('Reply content hashes generated', {
        contentHash: contentHash.substring(0, 20) + '...',
        previewHash: previewHash.substring(0, 20) + '...'
      }, 'ContentEncryptionService');

      // Encrypt the content and preview
      const encryptedContent = this.encryptContent(content);
      const encryptedPreview = this.encryptContent(preview);
      
      logger.info('Reply content encrypted', {
        originalLength: content.length,
        previewLength: preview.length,
        encryptedContentLength: encryptedContent.length,
        encryptedPreviewLength: encryptedPreview.length
      }, 'ContentEncryptionService');

      // Store in Supabase
      const storedReply = await contentStorage.storeEncryptedReply(
        postId,
        replyId,
        contentHash,
        previewHash,
        encryptedContent,
        encryptedPreview,
        replierId
      );

      logger.info('Reply content stored in Supabase', {
        supabaseId: storedReply.id,
        contentHash: storedReply.content_hash.substring(0, 20) + '...',
        previewHash: storedReply.preview_hash.substring(0, 20) + '...'
      }, 'ContentEncryptionService');

      return {
        contentHash: storedReply.content_hash,
        previewHash: storedReply.preview_hash,
        supabaseId: storedReply.id.toString(),
        encryptedContent: storedReply.encrypted_content,
        encryptedPreview: storedReply.encrypted_preview
      };
    } catch (error) {
      logger.error('Reply content encryption failed', error, 'ContentEncryptionService');
      throw new Error(`Failed to encrypt and store reply content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt and retrieve post content
   */
  async decryptPostContent(supabaseId: string): Promise<{
    content: string;
    preview: string;
  }> {
    try {
      logger.info('Starting post content decryption', 'ContentEncryptionService');
      
      // Retrieve from Supabase
      const storedContent = await contentStorage.getEncryptedContent(parseInt(supabaseId));
      
      if (!storedContent) {
        throw new Error('Content not found');
      }

      // Decrypt the content and preview
      const content = this.decryptContent(storedContent.encrypted_content);
      const preview = this.decryptContent(storedContent.encrypted_preview);
      
      logger.info('Post content decrypted', {
        contentLength: content.length,
        previewLength: preview.length
      }, 'ContentEncryptionService');

      return { content, preview };
    } catch (error) {
      logger.error('Post content decryption failed', error, 'ContentEncryptionService');
      throw new Error(`Failed to decrypt post content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt and retrieve reply content
   */
  async decryptReplyContent(postId: number, replyId: number): Promise<{
    content: string;
    preview: string;
  }> {
    try {
      logger.info('Starting reply content decryption', 'ContentEncryptionService');
      
      // Retrieve from Supabase
      const storedReply = await contentStorage.getEncryptedReply(postId, replyId);
      
      if (!storedReply) {
        throw new Error('Reply content not found');
      }

      // Decrypt the content and preview
      const content = this.decryptContent(storedReply.encrypted_content);
      const preview = this.decryptContent(storedReply.encrypted_preview);
      
      logger.info('Reply content decrypted', {
        contentLength: content.length,
        previewLength: preview.length
      }, 'ContentEncryptionService');

      return { content, preview };
    } catch (error) {
      logger.error('Reply content decryption failed', error, 'ContentEncryptionService');
      throw new Error(`Failed to decrypt reply content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a proper hash for content
   * Uses Web Crypto API for secure hashing
   */
  async generateHash(content: string): Promise<string> {
    try {
      // Use Web Crypto API for proper hashing
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return '0x' + hashHex;
    } catch (error) {
      logger.warn('Web Crypto API not available, using fallback hash', error, 'ContentEncryptionService');
      // Fallback to improved simple hash
      return this.generateFallbackHash(content);
    }
  }

  /**
   * Fallback hash function for environments without Web Crypto API
   */
  private generateFallbackHash(content: string): string {
    // Improved hash implementation that generates proper 32-byte hashes
    let hash1 = 0x811c9dc5; // FNV offset basis
    let hash2 = 0x01000193; // FNV prime
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash1 ^= char;
      hash1 = (hash1 * hash2) >>> 0; // Unsigned 32-bit multiplication
    }
    
    // Generate additional entropy using content length and position
    const lengthHash = (content.length * 0x9e3779b9) >>> 0;
    const combinedHash = (hash1 ^ lengthHash) >>> 0;
    
    // Create a proper 32-byte hash by combining multiple hash values
    const hashBytes = new Uint8Array(32);
    const view = new DataView(hashBytes.buffer);
    
    // Fill the hash with multiple variations
    for (let i = 0; i < 8; i++) {
      const offset = i * 4;
      const value = (combinedHash + (i * 0x9e3779b9)) >>> 0;
      view.setUint32(offset, value, false); // Big-endian
    }
    
    // Convert to hex string
    const hashHex = Array.from(hashBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return '0x' + hashHex;
  }

  /**
   * Simple content encryption
   * In production, use proper encryption (AES, etc.)
   */
  encryptContent(content: string): string {
    // Simple base64 encoding for now
    // In production, use proper encryption with a secret key
    return btoa(unescape(encodeURIComponent(content)));
  }

  /**
   * Simple content decryption
   * In production, use proper decryption
   */
  decryptContent(encryptedContent: string): string {
    // Simple base64 decoding for now
    // In production, use proper decryption
    try {
      return decodeURIComponent(escape(atob(encryptedContent)));
    } catch (error) {
      logger.error('Decryption error', error, 'ContentEncryptionService');
      throw new Error('Failed to decrypt content');
    }
  }
}

// Export singleton instance
export const contentEncryptionService = new ContentEncryptionService();
